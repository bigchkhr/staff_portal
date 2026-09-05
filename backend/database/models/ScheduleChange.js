const knex = require('../../config/database');
const Schedule = require('./Schedule');

const OPEN_STATUSES = ['draft', 'returned'];
const VISIBLE_STATUSES = ['draft', 'returned', 'pending'];

function formatDate(val) {
  return Schedule._normalizeDateStr(val);
}

function proposedPayload(item) {
  return {
    action: item.action,
    start_time: item.start_time || null,
    end_time: item.end_time || null,
    leave_type_id: item.leave_type_id || null,
    leave_session: item.leave_session || null,
    store_id: item.store_id || null,
    remarks: item.remarks || null,
    department_group_id: item.department_group_id || null
  };
}

class ScheduleChange {
  static async findSubmissionById(id) {
    const submission = await knex('schedule_change_submissions as s')
      .leftJoin('users as submitter', 's.submitted_by_id', 'submitter.id')
      .leftJoin('users as reviewer', 's.reviewed_by_id', 'reviewer.id')
      .select(
        's.*',
        'submitter.display_name as submitted_by_name',
        'submitter.name_zh as submitted_by_name_zh',
        'reviewer.display_name as reviewed_by_name',
        'reviewer.name_zh as reviewed_by_name_zh'
      )
      .where('s.id', id)
      .first();

    if (!submission) return null;
    submission.items = await this.findItemsBySubmissionId(id);
    return this._formatSubmission(submission);
  }

  static async findOpenSubmission(departmentGroupId, submittedById) {
    const submission = await knex('schedule_change_submissions')
      .where({
        department_group_id: departmentGroupId,
        submitted_by_id: submittedById
      })
      .whereIn('status', OPEN_STATUSES)
      .orderBy('id', 'desc')
      .first();
    if (!submission) return null;
    return this.findSubmissionById(submission.id);
  }

  static async findPendingBySubmitter(departmentGroupId, submittedById) {
    return knex('schedule_change_submissions')
      .where({
        department_group_id: departmentGroupId,
        submitted_by_id: submittedById,
        status: 'pending'
      })
      .first();
  }

  static _applyPendingVisibility(query, userId, isSystemAdmin, approverGroupIds) {
    if (isSystemAdmin) return query;
    return query.andWhere(function () {
      this.where('s.submitted_by_id', userId);
      if (approverGroupIds.length > 0) {
        this.orWhereIn('s.department_group_id', approverGroupIds);
      }
    });
  }

  static async _getApproverGroupIds(userId) {
    const uid = Number(userId);
    return knex('department_groups')
      .where(function () {
        this.whereIn('approver_1_id', function () {
          this.select('id').from('delegation_groups').whereRaw('? = ANY(delegation_groups.user_ids)', [uid]);
        })
          .orWhereIn('approver_2_id', function () {
            this.select('id').from('delegation_groups').whereRaw('? = ANY(delegation_groups.user_ids)', [uid]);
          })
          .orWhereIn('approver_3_id', function () {
            this.select('id').from('delegation_groups').whereRaw('? = ANY(delegation_groups.user_ids)', [uid]);
          });
      })
      .pluck('id');
  }

  static async countPendingItemsByGroupForUser(userId, isSystemAdmin = false) {
    let query = knex('schedule_change_items as i')
      .join('schedule_change_submissions as s', 'i.submission_id', 's.id')
      .where('s.status', 'pending');

    if (!isSystemAdmin) {
      const approverGroupIds = await this._getApproverGroupIds(userId);
      query = this._applyPendingVisibility(query, userId, isSystemAdmin, approverGroupIds);
    }

    const rows = await query
      .select('s.department_group_id')
      .countDistinct('i.id as count')
      .groupBy('s.department_group_id');

    const counts = {};
    rows.forEach((row) => {
      counts[Number(row.department_group_id)] = parseInt(row.count ?? 0, 10);
    });
    return counts;
  }

  static async countPendingItemsForUser(userId, isSystemAdmin = false) {
    const byGroup = await this.countPendingItemsByGroupForUser(userId, isSystemAdmin);
    return Object.values(byGroup).reduce((sum, n) => sum + n, 0);
  }

  static async listForGroup(departmentGroupId, { startDate, endDate, viewerUserId, isApprover, isAdmin } = {}) {
    let query = knex('schedule_change_submissions as s')
      .leftJoin('users as submitter', 's.submitted_by_id', 'submitter.id')
      .leftJoin('users as reviewer', 's.reviewed_by_id', 'reviewer.id')
      .select(
        's.*',
        'submitter.display_name as submitted_by_name',
        'submitter.name_zh as submitted_by_name_zh',
        'reviewer.display_name as reviewed_by_name',
        'reviewer.name_zh as reviewed_by_name_zh'
      )
      .where('s.department_group_id', departmentGroupId)
      .whereIn('s.status', VISIBLE_STATUSES)
      .orderBy('s.updated_at', 'desc');

    if (!isAdmin && !isApprover) {
      query = query.where('s.submitted_by_id', viewerUserId);
    } else {
      query = query.where(function () {
        this.whereIn('s.status', ['pending', 'returned'])
          .orWhere(function () {
            this.where('s.status', 'draft').andWhere('s.submitted_by_id', viewerUserId);
          });
      });
    }

    const submissions = await query;
    if (submissions.length === 0) return [];

    const allItems = await this.findItemsBySubmissionIds(submissions.map(s => s.id));
    const itemsBySubmission = new Map();
    for (const item of allItems) {
      const key = Number(item.submission_id);
      const list = itemsBySubmission.get(key) || [];
      list.push(item);
      itemsBySubmission.set(key, list);
    }

    const result = [];
    for (const submission of submissions) {
      let items = itemsBySubmission.get(Number(submission.id)) || [];
      if (startDate) {
        items = items.filter(item => item.schedule_date >= startDate);
      }
      if (endDate) {
        items = items.filter(item => item.schedule_date <= endDate);
      }
      if (items.length === 0 && (startDate || endDate)) {
        continue;
      }
      result.push(this._formatSubmission({ ...submission, items }));
    }
    return result;
  }

  static async findItemsBySubmissionIds(submissionIds) {
    if (!submissionIds || submissionIds.length === 0) return [];
    const items = await knex('schedule_change_items as i')
      .leftJoin('users', 'i.user_id', 'users.id')
      .leftJoin('leave_types', 'i.leave_type_id', 'leave_types.id')
      .leftJoin('stores', 'i.store_id', 'stores.id')
      .select(
        'i.*',
        'users.display_name as user_name',
        'users.name_zh as user_name_zh',
        'users.employee_number',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'stores.store_code as store_code',
        'stores.store_short_name_ as store_short_name'
      )
      .whereIn('i.submission_id', submissionIds)
      .orderBy('i.schedule_date')
      .orderBy('users.employee_number');
    return items.map(item => this._formatItem(item));
  }

  static async findItemsBySubmissionId(submissionId) {
    return this.findItemsBySubmissionIds([submissionId]);
  }

  static async getOrCreateOpenSubmission(departmentGroupId, submittedById) {
    const pending = await this.findPendingBySubmitter(departmentGroupId, submittedById);
    if (pending) {
      const error = new Error('PENDING_SUBMISSION_EXISTS');
      error.code = 'PENDING_SUBMISSION_EXISTS';
      throw error;
    }

    const existing = await knex('schedule_change_submissions')
      .where({
        department_group_id: departmentGroupId,
        submitted_by_id: submittedById
      })
      .whereIn('status', OPEN_STATUSES)
      .orderBy('id', 'desc')
      .first();
    if (existing) return existing;

    const [created] = await knex('schedule_change_submissions')
      .insert({
        department_group_id: departmentGroupId,
        submitted_by_id: submittedById,
        status: 'draft'
      })
      .returning('*');
    return created;
  }

  static async upsertDraftItems(departmentGroupId, submittedById, items) {
    const submission = await this.getOrCreateOpenSubmission(departmentGroupId, submittedById);
    if (!items || items.length === 0) {
      return this.findSubmissionById(submission.id);
    }

    const uniqueItems = new Map();
    for (const item of items) {
      const dateStr = formatDate(item.schedule_date);
      if (!dateStr || item.user_id == null) continue;
      uniqueItems.set(`${Number(item.user_id)}_${dateStr}`, {
        user_id: item.user_id,
        schedule_date: dateStr,
        action: item.action || 'upsert',
        department_group_id: item.department_group_id || departmentGroupId,
        start_time: item.start_time || null,
        end_time: item.end_time || null,
        leave_type_id: item.leave_type_id || null,
        leave_session: item.leave_session || null,
        store_id: item.store_id || null,
        remarks: item.remarks !== undefined ? item.remarks : null
      });
    }
    const normalized = [...uniqueItems.values()];
    if (normalized.length === 0) {
      return this.findSubmissionById(submission.id);
    }

    await knex.transaction(async (trx) => {
      const userIds = [...new Set(normalized.map(item => item.user_id))];
      const dates = [...new Set(normalized.map(item => item.schedule_date))];
      const officials = await trx('schedules')
        .whereIn('user_id', userIds)
        .whereIn('schedule_date', dates)
        .select('*');
      const officialMap = new Map();
      for (const row of officials) {
        officialMap.set(`${Number(row.user_id)}_${formatDate(row.schedule_date)}`, row);
      }

      const rows = normalized.map((item) => {
        const official = officialMap.get(`${Number(item.user_id)}_${item.schedule_date}`);
        return {
          submission_id: submission.id,
          user_id: item.user_id,
          schedule_date: item.schedule_date,
          action: item.action,
          department_group_id: item.department_group_id,
          start_time: item.start_time,
          end_time: item.end_time,
          leave_type_id: item.leave_type_id,
          leave_session: item.leave_session,
          store_id: item.store_id,
          remarks: item.remarks,
          before_payload: official ? Schedule.snapshot(official) : null,
          updated_at: trx.fn.now()
        };
      });

      await trx('schedule_change_items')
        .insert(rows)
        .onConflict(['submission_id', 'user_id', 'schedule_date'])
        .merge([
          'action',
          'department_group_id',
          'start_time',
          'end_time',
          'leave_type_id',
          'leave_session',
          'store_id',
          'remarks',
          'updated_at'
        ]);

      await trx('schedule_change_submissions')
        .where('id', submission.id)
        .update({ updated_at: trx.fn.now() });
    });

    return this.findSubmissionById(submission.id);
  }

  static async removeDraftItem(itemId, actorId) {
    const item = await knex('schedule_change_items').where('id', itemId).first();
    if (!item) return null;
    const submission = await knex('schedule_change_submissions').where('id', item.submission_id).first();
    if (!submission || !OPEN_STATUSES.includes(submission.status)) {
      const error = new Error('ITEM_NOT_EDITABLE');
      error.code = 'ITEM_NOT_EDITABLE';
      throw error;
    }
    if (Number(submission.submitted_by_id) !== Number(actorId)) {
      const error = new Error('FORBIDDEN');
      error.code = 'FORBIDDEN';
      throw error;
    }

    await knex('schedule_change_items').where('id', itemId).del();
    return this.findSubmissionById(submission.id);
  }

  static async submit(submissionId, actorId) {
    const submission = await this.findSubmissionById(submissionId);
    if (!submission) return null;
    if (Number(submission.submitted_by_id) !== Number(actorId)) {
      const error = new Error('FORBIDDEN');
      error.code = 'FORBIDDEN';
      throw error;
    }
    if (!OPEN_STATUSES.includes(submission.status)) {
      const error = new Error('INVALID_STATUS');
      error.code = 'INVALID_STATUS';
      throw error;
    }
    if (!submission.items || submission.items.length === 0) {
      const error = new Error('EMPTY_SUBMISSION');
      error.code = 'EMPTY_SUBMISSION';
      throw error;
    }

    await knex('schedule_change_submissions')
      .where('id', submissionId)
      .update({
        status: 'pending',
        submitted_at: knex.fn.now(),
        reviewed_by_id: null,
        reviewed_at: null,
        updated_at: knex.fn.now()
      });

    await this.addLogs((submission.items || []).map((item) => ({
      department_group_id: submission.department_group_id,
      submission_id: submissionId,
      user_id: item.user_id,
      schedule_date: item.schedule_date,
      actor_id: actorId,
      action: 'submit',
      before_payload: item.before_payload,
      after_payload: proposedPayload(item)
    })));

    return this.findSubmissionById(submissionId);
  }

  static async approve(submissionId, actorId) {
    const submission = await this.findSubmissionById(submissionId);
    if (!submission) return null;
    if (submission.status !== 'pending') {
      const error = new Error('INVALID_STATUS');
      error.code = 'INVALID_STATUS';
      throw error;
    }

    const applied = [];
    await knex.transaction(async (trx) => {
      for (const item of submission.items) {
        const dateStr = formatDate(item.schedule_date);
        const existing = await trx('schedules')
          .where({ user_id: item.user_id, schedule_date: dateStr })
          .first();

        if (item.action === 'delete') {
          if (existing) {
            await trx('schedules').where('id', existing.id).del();
          }
          applied.push({ item, existing, result: { deleted: true, user_id: item.user_id, schedule_date: dateStr } });
        } else {
          const data = {
            user_id: item.user_id,
            department_group_id: item.department_group_id || submission.department_group_id,
            schedule_date: dateStr,
            start_time: item.start_time || null,
            end_time: item.end_time || null,
            leave_type_id: item.leave_type_id || null,
            leave_session: item.leave_session || null,
            store_id: item.store_id || null,
            remarks: item.remarks || null,
            updated_by_id: actorId,
            updated_at: trx.fn.now()
          };
          let resultRow;
          if (existing) {
            await trx('schedules').where('id', existing.id).update(data);
            resultRow = await trx('schedules').where('id', existing.id).first();
          } else {
            data.created_by_id = actorId;
            const [inserted] = await trx('schedules').insert(data).returning('*');
            resultRow = inserted;
          }
          applied.push({ item, existing, result: resultRow });
        }
      }

      await trx('schedule_change_submissions')
        .where('id', submissionId)
        .update({
          status: 'approved',
          reviewed_by_id: actorId,
          reviewed_at: trx.fn.now(),
          updated_at: trx.fn.now()
        });
    });

    await this.addLogs(applied.map(({ item, existing, result }) => ({
      department_group_id: submission.department_group_id,
      submission_id: submissionId,
      user_id: item.user_id,
      schedule_date: formatDate(item.schedule_date),
      actor_id: actorId,
      action: 'approve',
      before_payload: item.before_payload || (existing ? Schedule.snapshot(existing) : null),
      after_payload: result && result.deleted ? { action: 'delete' } : Schedule.snapshot(result)
    })));

    return { submission: await this.findSubmissionById(submissionId), applied };
  }

  static async returnSubmission(submissionId, actorId, reason) {
    const submission = await this.findSubmissionById(submissionId);
    if (!submission) return null;
    if (submission.status !== 'pending') {
      const error = new Error('INVALID_STATUS');
      error.code = 'INVALID_STATUS';
      throw error;
    }

    await knex('schedule_change_submissions')
      .where('id', submissionId)
      .update({
        status: 'returned',
        reviewed_by_id: actorId,
        reviewed_at: knex.fn.now(),
        return_reason: reason || null,
        updated_at: knex.fn.now()
      });

    await this.addLogs((submission.items || []).map((item) => ({
      department_group_id: submission.department_group_id,
      submission_id: submissionId,
      user_id: item.user_id,
      schedule_date: item.schedule_date,
      actor_id: actorId,
      action: 'return',
      before_payload: item.before_payload,
      after_payload: proposedPayload(item),
      note: reason || null
    })));

    return this.findSubmissionById(submissionId);
  }

  static _logRow(log) {
    return {
      department_group_id: log.department_group_id,
      submission_id: log.submission_id || null,
      user_id: log.user_id || null,
      schedule_date: log.schedule_date || null,
      actor_id: log.actor_id,
      action: log.action,
      before_payload: log.before_payload || null,
      after_payload: log.after_payload || null,
      note: log.note || null
    };
  }

  static async addLogs(logs) {
    if (!logs || logs.length === 0) return [];
    return knex('schedule_change_logs').insert(logs.map((log) => this._logRow(log))).returning('*');
  }

  static async addLog(log) {
    const [row] = await this.addLogs([log]);
    return row;
  }

  static async findLogs({ departmentGroupId, userId, scheduleDate, startDate, endDate, limit = 100 }) {
    let query = knex('schedule_change_logs as l')
      .leftJoin('users as actor', 'l.actor_id', 'actor.id')
      .leftJoin('users as target', 'l.user_id', 'target.id')
      .select(
        'l.*',
        'actor.display_name as actor_name',
        'actor.name_zh as actor_name_zh',
        'target.display_name as user_name',
        'target.name_zh as user_name_zh',
        'target.employee_number'
      )
      .where('l.department_group_id', departmentGroupId)
      .orderBy('l.created_at', 'desc')
      .limit(Math.min(Number(limit) || 100, 300));

    if (userId) query = query.andWhere('l.user_id', userId);
    if (scheduleDate) query = query.andWhere('l.schedule_date', scheduleDate);
    if (startDate) query = query.andWhere('l.schedule_date', '>=', startDate);
    if (endDate) query = query.andWhere('l.schedule_date', '<=', endDate);

    const rows = await query;
    return rows.map(row => ({
      ...row,
      schedule_date: formatDate(row.schedule_date)
    }));
  }

  static _formatItem(item) {
    if (!item) return item;
    return {
      ...item,
      schedule_date: formatDate(item.schedule_date)
    };
  }

  static _formatSubmission(submission) {
    if (!submission) return submission;
    return {
      ...submission,
      submitted_at: submission.submitted_at || null,
      reviewed_at: submission.reviewed_at || null,
      items: (submission.items || []).map(item => this._formatItem(item))
    };
  }
}

module.exports = ScheduleChange;
