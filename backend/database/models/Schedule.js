const knex = require('../../config/database');
const { toHKCalendarDate } = require('../../utils/hkDate');

class Schedule {
  // 取得所有排班記錄（可選篩選條件）
  static async findAll(filters = {}) {
    try {
      let query = knex('schedules')
        .leftJoin('users', 'schedules.user_id', 'users.id')
        .leftJoin('department_groups', 'schedules.department_group_id', 'department_groups.id')
        .leftJoin('users as creator', 'schedules.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'schedules.updated_by_id', 'updater.id')
        .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
        .leftJoin('stores', 'schedules.store_id', 'stores.id')
        .select(
          'schedules.*',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'users.employee_number',
          'department_groups.name as group_name',
          'department_groups.name_zh as group_name_zh',
          'creator.display_name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.display_name as updated_by_name',
          'updater.name_zh as updated_by_name_zh',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh',
          'stores.id as store_id',
          'stores.store_code as store_code',
          'stores.store_short_name_ as store_short_name'
        );

      // 根據群組ID篩選
      if (filters.department_group_id) {
        query = query.where('schedules.department_group_id', filters.department_group_id);
      }

      // 根據用戶ID篩選
      if (filters.user_id) {
        query = query.where('schedules.user_id', filters.user_id);
      }

      // 根據日期範圍篩選
      if (filters.start_date) {
        query = query.where('schedules.schedule_date', '>=', filters.start_date);
      }
      if (filters.end_date) {
        query = query.where('schedules.schedule_date', '<=', filters.end_date);
      }

      // 根據日期篩選
      if (filters.schedule_date) {
        query = query.where('schedules.schedule_date', filters.schedule_date);
      }

      const results = await query.orderBy('schedules.schedule_date', 'desc')
        .orderBy('users.employee_number');
      
      // 確保返回空數組而不是 undefined，並格式化日期
      if (!results || results.length === 0) {
        return [];
      }
      
      return results.map(schedule => this._normalizeScheduleDateField(schedule));
    } catch (error) {
      console.error('Schedule.findAll query error:', error);
      throw error;
    }
  }

  static _scheduleDetailSelect() {
    return knex('schedules')
      .leftJoin('users', 'schedules.user_id', 'users.id')
      .leftJoin('department_groups', 'schedules.department_group_id', 'department_groups.id')
      .leftJoin('users as creator', 'schedules.created_by_id', 'creator.id')
      .leftJoin('users as updater', 'schedules.updated_by_id', 'updater.id')
      .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
      .leftJoin('stores', 'schedules.store_id', 'stores.id')
      .select(
        'schedules.*',
        'users.display_name as user_name',
        'users.name_zh as user_name_zh',
        'users.employee_number',
        'department_groups.name as group_name',
        'department_groups.name_zh as group_name_zh',
        'creator.display_name as created_by_name',
        'creator.name_zh as created_by_name_zh',
        'updater.display_name as updated_by_name',
        'updater.name_zh as updated_by_name_zh',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'stores.id as store_id',
        'stores.store_code as store_code',
        'stores.store_short_name_ as store_short_name'
      );
  }

  static _normalizeScheduleDateField(schedule) {
    if (!schedule?.schedule_date) return schedule;
    schedule.schedule_date = this._normalizeDateStr(schedule.schedule_date) || schedule.schedule_date;
    return schedule;
  }

  // 根據ID取得單一記錄
  static async findById(id) {
    try {
      const result = await this._scheduleDetailSelect()
        .where('schedules.id', id)
        .first();

      if (!result) {
        return null;
      }

      return this._normalizeScheduleDateField(result);
    } catch (error) {
      console.error('Schedule.findById error:', error);
      throw error;
    }
  }

  static async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = [...new Set(ids.map(Number).filter((id) => !Number.isNaN(id)))];
    if (uniqueIds.length === 0) return [];
    const results = await this._scheduleDetailSelect().whereIn('schedules.id', uniqueIds);
    return results.map((row) => this._normalizeScheduleDateField(row));
  }

  // 建立排班記錄（使用 upsert 邏輯：如果已存在則更新，否則插入）
  static async create(scheduleData) {
    // 檢查是否已存在相同的 user_id 和 schedule_date
    const existing = await knex('schedules')
      .where({
        user_id: scheduleData.user_id,
        schedule_date: scheduleData.schedule_date
      })
      .first();

      if (existing) {
      // 更新現有記錄
      await knex('schedules')
        .where('id', existing.id)
        .update({
          start_time: scheduleData.start_time,
          end_time: scheduleData.end_time,
          leave_type_id: scheduleData.leave_type_id !== undefined ? scheduleData.leave_type_id : null,
          leave_session: scheduleData.leave_session !== undefined ? scheduleData.leave_session : null,
          store_id: scheduleData.store_id !== undefined ? scheduleData.store_id : null,
          remarks: scheduleData.remarks !== undefined ? scheduleData.remarks : null,
          updated_by_id: scheduleData.updated_by_id || scheduleData.created_by_id,
          updated_at: knex.fn.now()
        });
      return await this.findById(existing.id);
    } else {
      // 插入新記錄
      const [schedule] = await knex('schedules')
        .insert(scheduleData)
        .returning('*');
      return await this.findById(schedule.id);
    }
  }

  // 批量建立排班記錄（一次 upsert，避免逐筆查改）
  static async createBatch(schedulesData) {
    if (!schedulesData || schedulesData.length === 0) {
      return [];
    }

    const incomingByKey = new Map();
    for (const scheduleData of schedulesData) {
      const dateStr = this._normalizeDateStr(scheduleData.schedule_date) || scheduleData.schedule_date;
      const key = `${Number(scheduleData.user_id)}_${dateStr}`;
      incomingByKey.set(key, {
        user_id: Number(scheduleData.user_id),
        department_group_id: scheduleData.department_group_id,
        schedule_date: dateStr,
        start_time: scheduleData.start_time || null,
        end_time: scheduleData.end_time || null,
        leave_type_id: scheduleData.leave_type_id !== undefined ? scheduleData.leave_type_id : null,
        leave_session: scheduleData.leave_session !== undefined ? scheduleData.leave_session : null,
        store_id: scheduleData.store_id !== undefined ? scheduleData.store_id : null,
        remarks: scheduleData.remarks !== undefined ? scheduleData.remarks : null,
        created_by_id: scheduleData.created_by_id,
        updated_by_id: scheduleData.updated_by_id || scheduleData.created_by_id
      });
    }

    const rows = [...incomingByKey.values()];
    const upserted = await knex('schedules')
      .insert(rows)
      .onConflict(['user_id', 'schedule_date'])
      .merge({
        start_time: knex.raw('EXCLUDED.start_time'),
        end_time: knex.raw('EXCLUDED.end_time'),
        leave_type_id: knex.raw('EXCLUDED.leave_type_id'),
        leave_session: knex.raw('EXCLUDED.leave_session'),
        store_id: knex.raw('EXCLUDED.store_id'),
        updated_by_id: knex.raw('EXCLUDED.updated_by_id'),
        updated_at: knex.fn.now()
      })
      .returning('id');

    const ids = upserted.map((row) => (row && typeof row === 'object' ? row.id : row));
    return this.findByIds(ids);
  }

  // 更新排班記錄
  static async update(id, scheduleData) {
    await knex('schedules')
      .where('id', id)
      .update(scheduleData);
    return await this.findById(id);
  }

  // 刪除排班記錄
  static async delete(id) {
    return await knex('schedules').where('id', id).del();
  }

  // 批量刪除排班記錄
  static async deleteBatch(filters) {
    let query = knex('schedules');

    if (filters.user_id) {
      query = query.where('user_id', filters.user_id);
    }
    if (filters.department_group_id) {
      query = query.where('department_group_id', filters.department_group_id);
    }
    if (filters.start_date) {
      query = query.where('schedule_date', '>=', filters.start_date);
    }
    if (filters.end_date) {
      query = query.where('schedule_date', '<=', filters.end_date);
    }
    if (filters.schedule_date) {
      query = query.where('schedule_date', filters.schedule_date);
    }

    return await query.del();
  }

  static parseGroupUserIds(group) {
    if (!group || group.user_ids == null) return [];
    let userIds = group.user_ids;
    if (typeof userIds === 'string') {
      userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
    }
    return Array.isArray(userIds) ? userIds.map(Number) : [];
  }

  static isDateInCheckerEditableRange(group, scheduleDate) {
    if (!group) return false;
    const startDate = this._normalizeDateStr(group.checker_editable_start_date);
    const endDate = this._normalizeDateStr(group.checker_editable_end_date);
    if (scheduleDate == null || (startDate == null && endDate == null)) return true;
    const dateStr = this._normalizeDateStr(scheduleDate);
    if (!dateStr) return false;
    if (startDate != null && dateStr < startDate) return false;
    if (endDate != null && dateStr > endDate) return false;
    return true;
  }

  // 檢查用戶是否屬於指定群組
  static async isUserInGroup(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();
    
    if (!group || !group.user_ids) {
      return false;
    }

    // 解析 user_ids 數組
    let userIds = group.user_ids;
    if (typeof userIds === 'string') {
      userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
    }

    return Array.isArray(userIds) && userIds.includes(Number(userId));
  }

  // 將日期正規化為香港 UTC+8 日曆的 YYYY-MM-DD
  static _normalizeDateStr(val) {
    return toHKCalendarDate(val);
  }

  // 取得用戶在該群組的排班角色。同時是 checker 與 approver 時視為 approver（可直接改更）
  static async getActorRole(userId, departmentGroupId, isSystemAdmin = false) {
    if (isSystemAdmin) {
      return {
        isAdmin: true,
        isApprover: true,
        isChecker: false,
        requireApproval: false,
        group: null
      };
    }

    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();

    if (!group) {
      return {
        isAdmin: false,
        isApprover: false,
        isChecker: false,
        requireApproval: false,
        group: null
      };
    }

    const delegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');
    const delegationGroupIds = delegationGroups.map(g => Number(g.id));

    const isChecker = !!(group.checker_id && delegationGroupIds.includes(Number(group.checker_id)));
    const isApprover1 = !!(group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id)));
    const isApprover2 = !!(group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id)));
    const isApprover3 = !!(group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id)));
    const isApprover = isApprover1 || isApprover2 || isApprover3;
    const requireApproval = !isApprover && isChecker && group.require_checker_schedule_approval === true;

    return {
      isAdmin: false,
      isApprover,
      isChecker,
      requireApproval,
      group
    };
  }

  static snapshot(schedule) {
    if (!schedule) return null;
    return {
      id: schedule.id || null,
      user_id: schedule.user_id || null,
      department_group_id: schedule.department_group_id || null,
      schedule_date: this._normalizeDateStr(schedule.schedule_date),
      start_time: schedule.start_time || null,
      end_time: schedule.end_time || null,
      leave_type_id: schedule.leave_type_id || null,
      leave_session: schedule.leave_session || null,
      store_id: schedule.store_id || null,
      remarks: schedule.remarks || null
    };
  }

  // 檢查用戶是否為批核成員（checker, approver_1, approver_2, approver_3）
  // scheduleDate: 可選，YYYY-MM-DD 或 Date；若為 checker 且群組設有可編輯範圍，會檢查該日期是否在範圍內（UTC+8）
  static async canEditSchedule(userId, departmentGroupId, scheduleDate = null) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();

    if (!group) {
      return false;
    }

    // 取得用戶所屬的授權群組
    const delegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');

    const delegationGroupIds = delegationGroups.map(g => Number(g.id));

    // 檢查是否為 checker, approver_1, approver_2, 或 approver_3
    const isChecker = group.checker_id && delegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id));

    // 如果用戶是 checker，需要檢查 allow_checker_edit 及可編輯日期範圍（UTC+8）
    if (isChecker) {
      if (group.allow_checker_edit === false) return false;
      const startDate = this._normalizeDateStr(group.checker_editable_start_date);
      const endDate = this._normalizeDateStr(group.checker_editable_end_date);
      // 僅在有傳入 scheduleDate 且群組有設範圍時，才檢查該日期是否在範圍內
      if (scheduleDate != null && (startDate != null || endDate != null)) {
        const dateStr = this._normalizeDateStr(scheduleDate);
        if (!dateStr) return false;
        if (startDate != null && dateStr < startDate) return false;
        if (endDate != null && dateStr > endDate) return false;
      }
      return true;
    }

    // approver1, approver2, approver3 可以直接編輯
    return isApprover1 || isApprover2 || isApprover3;
  }

  // 檢查用戶是否可查看排班備註（checker、approver_1/2/3；checker 須 allow_checker_edit）
  static async canViewScheduleRemarks(userId, departmentGroupId, isSystemAdmin = false) {
    if (isSystemAdmin) {
      return true;
    }

    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();

    if (!group) {
      return false;
    }

    const delegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');

    const delegationGroupIds = delegationGroups.map(g => Number(g.id));

    const isChecker = group.checker_id && delegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id));

    if (isChecker) {
      return group.allow_checker_edit !== false;
    }

    return isApprover1 || isApprover2 || isApprover3;
  }
}

module.exports = Schedule;
