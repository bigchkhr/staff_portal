const express = require('express');
const { randomUUID } = require('crypto');
const { asyncHandler } = require('../utils/asyncHandler');
const { advanceRun, returnRunToTask } = require('../services/runProgress');
const { notifyTaskAssignee, notifyRunEnded } = require('../services/stageAssigneeMail');
const { canViewRun, canManageGroup, canManageWorkflows, applyRunsVisibility } = require('../access');
const { eProcessTaskAttachmentUpload } = require('../middleware/uploadTaskAttachment');
const fileStorage = require('../localFiles');
const { ensureEProcessAccess, assertUsersAssignable, assertGroupAssignable, assertDelegationAssignable } = require('../users');
const { isEmptyFormValue } = require('../formFields');
const { isChecklistComplete } = require('../checklist');
const { validateCommunicationData } = require('../communication');
const { validateApprovalData, approvalDecisionFromAction } = require('../approval');
const { validateAcknowledgementData, acknowledgementDecisionFromAction } = require('../acknowledgement');
const { normalizeDateOnly, withRunScheduleFields, withTaskTimeFields } = require('../utils/datetime');

const router = express.Router();

const AD_HOC_ELEMENT_TYPES = new Set(['task', 'communication', 'approval', 'acknowledgement', 'attachment']);
const ATTACHMENT_STEP_KEY = 'attachment';
const ATTACHMENT_STEP_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
]);
const DECISION_STEP_TYPES = new Set(['approval', 'acknowledgement']);

function db(req) {
  return require('../../config/database');
}

async function getRun(knex, runId) {
  return knex('workflow_runs as r')
    .join('workflows as w', 'w.id', 'r.workflow_id')
    .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
    .where('r.id', runId)
    .select(
      'r.*',
      'w.name as workflow_name',
      'w.workflow_number',
      'w.group_id',
      knex.raw('g.name as group_name')
    )
    .first();
}

function pooledTaskForUser(knex, ctx, run) {
  const deptIds = ctx.memberGroupIds || [];
  const delegationIds = ctx.delegationGroupIds || [];
  const workIds = ctx.workGroupIds || [];
  const inWorkGroup = workIds.some((id) => String(id) === String(run.group_id));
  return knex('task_runs')
    .where({ run_id: run.id, assignment_status: 'pending' })
    .whereNull('assigned_to')
    .where(function pool() {
      let opened = false;
      if (deptIds.length) {
        this.whereIn('assignee_group_id', deptIds);
        opened = true;
      }
      if (delegationIds.length) {
        const clause = function delegationPool() {
          this.whereIn('assignee_delegation_group_id', delegationIds);
        };
        if (opened) this.orWhere(clause);
        else this.where(clause);
        opened = true;
      }
      if (inWorkGroup) {
        if (opened) this.orWhere('assignee_is_work_group', true);
        else this.where('assignee_is_work_group', true);
        opened = true;
      }
      if (!opened) this.whereRaw('false');
    });
}

function canClaimGroup(ctx, run, task) {
  if (task.assigned_to || task.assignment_status !== 'pending') return false;
  if (!['pending', 'in_progress'].includes(task.status)) return false;
  if (task.assignee_is_work_group) {
    return (ctx.workGroupIds || []).some((id) => String(id) === String(run.group_id));
  }
  if (task.assignee_group_id) {
    return (ctx.memberGroupIds || []).some((id) => String(id) === String(task.assignee_group_id));
  }
  if (task.assignee_delegation_group_id) {
    return (ctx.delegationGroupIds || []).some((id) => String(id) === String(task.assignee_delegation_group_id));
  }
  return false;
}

function whereOpenForUser(query, userId, ctx) {
  const deptIds = (ctx?.memberGroupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const delegationIds = (ctx?.delegationGroupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0);
  const workIds = ctx?.workGroupIds || [];
  return query.where(function openFor() {
    this.where(function personal() {
      this.where('tr.assigned_to', userId)
        .whereIn('tr.assignment_status', ['pending', 'accepted']);
    });
    if (deptIds.length) {
      this.orWhere(function departmentPool() {
        this.whereNull('tr.assigned_to')
          .where('tr.assignment_status', 'pending')
          .whereIn('tr.assignee_group_id', deptIds);
      });
    }
    if (delegationIds.length) {
      this.orWhere(function delegationPool() {
        this.whereNull('tr.assigned_to')
          .where('tr.assignment_status', 'pending')
          .whereIn('tr.assignee_delegation_group_id', delegationIds);
      });
    }
    if (workIds.length) {
      this.orWhere(function workPool() {
        this.whereNull('tr.assigned_to')
          .where('tr.assignment_status', 'pending')
          .where('tr.assignee_is_work_group', true)
          .whereIn('w.group_id', workIds);
      });
    }
  });
}

async function userCanAccessRun(knex, ctx, run) {
  if (canViewRun(ctx, run)) return true;
  const userId = Number(ctx.userId);
  const assigned = await knex('task_runs')
    .where({ run_id: run.id, assigned_to: userId })
    .first();
  if (assigned) return true;
  const pooled = await pooledTaskForUser(knex, ctx, run).first();
  if (pooled) return true;
  const participant = await knex('workflow_run_participants')
    .where({ run_id: run.id, user_id: userId })
    .first();
  return Boolean(participant);
}

async function listRunParticipants(knex, runId) {
  return knex('workflow_run_participants as p')
    .join('users as u', 'u.id', 'p.user_id')
    .leftJoin('users as adder', 'adder.id', 'p.added_by')
    .where('p.run_id', runId)
    .orderBy('u.display_name', 'asc')
    .select(
      'p.id as participant_id',
      'u.id',
      'u.employee_number as username',
      'u.display_name',
      'u.email',
      knex.raw('NULL as position_title'),
      'p.added_by',
      'adder.display_name as added_by_name',
      'adder.employee_number as added_by_username',
      'p.created_at'
    );
}

function canManageRunParticipants(ctx, run) {
  return canEndRun(ctx, run);
}

function applyRunsSearch(query, q) {
  const term = String(q || '').trim();
  if (!term) return query;
  const like = `%${term.replace(/[%_]/g, '\\$&')}%`;
  return query.andWhere(function () {
    this.whereILike('r.name', like)
      .orWhereILike('r.run_number', like)
      .orWhereILike('w.name', like)
      .orWhereILike('w.workflow_number', like)
      .orWhereILike('g.name', like)
      .orWhereRaw('r.status::text ILIKE ?', [like]);
    if (term.toLowerCase() === 'overdue') {
      // Overdue is computed after fetch; still allow status-like search here.
    }
  });
}

function scopedRunsQuery(knex, ctx, { q } = {}) {
  let query = knex('workflow_runs as r')
    .join('workflows as w', 'w.id', 'r.workflow_id')
    .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
    .leftJoin('task_runs as tr', 'tr.run_id', 'r.id')
    .groupBy('r.id', 'w.name', 'g.name', 'w.group_id')
    .orderBy('r.created_at', 'desc')
    .select('r.*', 'w.name as workflow_name', knex.raw('g.name as group_name'), 'w.group_id')
    .count({ total_tasks: 'tr.id' })
    .count({
      completed_tasks: knex.raw("CASE WHEN tr.status IN ('completed','skipped','rejected') THEN 1 END"),
    });

  query = applyRunsVisibility(query, knex, ctx);
  query = applyRunsSearch(query, q);
  return query;
}

async function countScopedRuns(knex, ctx, { q } = {}) {
  let query = knex('workflow_runs as r')
    .join('workflows as w', 'w.id', 'r.workflow_id')
    .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
    .countDistinct({ total: 'r.id' });
  query = applyRunsVisibility(query, knex, ctx);
  query = applyRunsSearch(query, q);
  const row = await query.first();
  return Number(row?.total || 0);
}

function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

async function getTask(knex, runId, taskId) {
  return knex('task_runs as tr')
    .leftJoin('users as assignee', 'assignee.id', 'tr.assigned_to')
    .leftJoin('users as assigner', 'assigner.id', 'tr.assigned_by')
    .leftJoin('users as completer', 'completer.id', 'tr.completed_by')
    .leftJoin('department_groups as ag', 'ag.id', 'tr.assignee_group_id')
    .leftJoin('delegation_groups as dg', 'dg.id', 'tr.assignee_delegation_group_id')
    .where('tr.id', taskId)
    .andWhere('tr.run_id', runId)
    .select(
      'tr.*',
      'assignee.display_name as assigned_to_name',
      'assignee.employee_number as assigned_to_username',
      knex.raw('NULL as assigned_to_position_title'),
      'assigner.display_name as assigned_by_name',
      'assigner.employee_number as assigned_by_username',
      'completer.display_name as completed_by_name',
      'completer.employee_number as completed_by_username',
      knex.raw('NULL as completed_by_position_title'),
      knex.raw('COALESCE(ag.name_zh, ag.name, dg.name_zh, dg.name) as assignee_group_name')
    )
    .first();
}

async function listAttachments(knex, taskRunId) {
  return knex('e_process_task_attachments as a')
    .leftJoin('users as u', 'u.id', 'a.uploaded_by_user_id')
    .where('a.task_run_id', taskRunId)
    .orderBy('a.created_at', 'asc')
    .select(
      'a.id',
      'a.file_name',
      'a.file_size',
      'a.mime_type',
      'a.form_field_key',
      'a.created_at',
      'a.uploaded_by_user_id',
      'u.display_name as uploaded_by_name',
      'u.employee_number as uploaded_by_username'
    );
}

function canAssignTask(ctx, run, task) {
  if (ctx.isSupervisor) return true;
  if (canManageGroup(ctx, run.group_id) || canManageWorkflows(ctx, run.group_id)) return true;
  if (Number(run.started_by) === Number(ctx.userId)) return true;
  // While waiting for accept/reject, the person who assigned can change the assignee.
  if (Number(task.assigned_by) === Number(ctx.userId) && task.assignment_status === 'pending') return true;
  if (Number(task.assigned_to) === Number(ctx.userId) && task.assignment_status === 'accepted') return true;
  return false;
}

function canEndRun(ctx, run) {
  if (ctx.isSupervisor) return true;
  if (Number(run.started_by) === Number(ctx.userId)) return true;
  return false;
}

async function canEditRunStructure(ctx, knex, run) {
  if (ctx.isSupervisor) return true;
  if (canManageGroup(ctx, run.group_id) || canManageWorkflows(ctx, run.group_id)) return true;
  if (Number(run.started_by) === Number(ctx.userId)) return true;
  const mine = await knex('task_runs')
    .where({ run_id: run.id, assigned_to: ctx.userId })
    .whereIn('assignment_status', ['accepted', 'pending'])
    .first();
  return Boolean(mine);
}

function canDeleteElement(task) {
  if (!AD_HOC_ELEMENT_TYPES.has(task.type)) return false;
  if (!task.allow_delete) return false;
  return ['blocked', 'pending', 'in_progress'].includes(task.status);
}

function canWorkTask(ctx, task) {
  if (ctx.isSupervisor) return true;
  if (!task.assigned_to) return false;
  if (Number(task.assigned_to) !== Number(ctx.userId)) return false;
  return !task.assignment_status || task.assignment_status === 'accepted';
}

function hideStepFromStarter(ctx, run, task) {
  if (task.visible_to_starter !== false) return false;
  if (Number(run.started_by) !== Number(ctx.userId)) return false;
  const assigneeWorking = Number(task.assigned_to) === Number(ctx.userId)
    && (!task.assignment_status || task.assignment_status === 'accepted')
    && ['pending', 'in_progress'].includes(task.status);
  return !assigneeWorking;
}

function isOpenTask(task) {
  return ['pending', 'in_progress'].includes(task.status);
}

async function reflowOpenTasks(trx, runId) {
  const previous = await trx('task_runs')
    .where({ run_id: runId })
    .whereIn('status', ['pending', 'in_progress'])
    .orderBy('position', 'asc')
    .first('id');
  await trx('task_runs')
    .where({ run_id: runId })
    .whereIn('status', ['pending', 'in_progress'])
    .update({ status: 'blocked', updated_at: trx.fn.now() });
  const activatedTaskId = await advanceRun(runId, trx);
  return {
    activatedTaskId: activatedTaskId || null,
    previousOpenTaskId: previous?.id || null,
  };
}

async function renumberTaskPositions(trx, runId) {
  const rows = await trx('task_runs').where({ run_id: runId }).orderBy('position', 'asc').select('id', 'position');
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i].position !== i) {
      await trx('task_runs').where({ id: rows[i].id }).update({ position: i, updated_at: trx.fn.now() });
    }
  }
}

function openAssignmentRows(knex, userId, ctx) {
  return whereOpenForUser(knex('task_runs as tr')
    .join('workflow_runs as r', 'r.id', 'tr.run_id')
    .join('workflows as w', 'w.id', 'r.workflow_id')
    .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
    .leftJoin('users as assigner', 'assigner.id', 'tr.assigned_by')
    .joinRaw(`LEFT JOIN LATERAL (
      SELECT cs.id, cs.title, cs.position, cs.status, cs.assigned_to
      FROM task_runs cs
      WHERE cs.run_id = r.id
        AND cs.status IN ('pending', 'in_progress')
      ORDER BY cs.position ASC
      LIMIT 1
    ) AS current_step ON true`)
    .leftJoin('users as current_assignee', 'current_assignee.id', 'current_step.assigned_to')
    .where('r.status', 'active')
    .whereIn('tr.status', ['blocked', 'pending', 'in_progress']), userId, ctx);
}

function filterAssignmentSearch(query, q) {
  const term = String(q || '').trim();
  if (!term) return query;
  const like = `%${term.replace(/[%_]/g, '\\$&')}%`;
  return query.andWhere(function () {
    this.whereILike('tr.title', like)
      .orWhereRaw('tr.type::text ILIKE ?', [like])
      .orWhereRaw('tr.status::text ILIKE ?', [like])
      .orWhereRaw('tr.assignment_status::text ILIKE ?', [like])
      .orWhereILike('r.name', like)
      .orWhereILike('r.run_number', like)
      .orWhereILike('w.name', like)
      .orWhereILike('w.workflow_number', like)
      .orWhereILike('g.name', like)
      .orWhereILike('assigner.display_name', like)
      .orWhereILike('assigner.employee_number', like)
      .orWhereILike('current_step.title', like)
      .orWhereILike('current_assignee.display_name', like)
      .orWhereILike('current_assignee.employee_number', like);
  });
}

router.get(
  '/mine/assignments/pending-count',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    // One count per active run that still has open work assigned to this user.
    const row = await openAssignmentRows(knex, req.user.id, req.eProcess)
      .countDistinct({ count: 'r.id' })
      .first();
    return res.json({ pendingCount: Number(row?.count || 0) });
  })
);

router.get(
  '/mine/assignments',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const q = String(req.query.q || '').trim();
    const sort = String(req.query.sort || 'date').toLowerCase() === 'status' ? 'status' : 'date';
    const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const direction = order === 'asc' ? 'ASC' : 'DESC';

    // Search can match any of the user's open steps, but the card is always their earliest one.
    const matchedRunIds = filterAssignmentSearch(openAssignmentRows(knex, req.user.id, req.eProcess), q)
      .distinct('r.id');

    const picked = openAssignmentRows(knex, req.user.id, req.eProcess)
      .modify((qb) => {
        if (q) qb.whereIn('r.id', matchedRunIds);
      })
      .distinctOn('r.id')
      .orderBy('r.id', 'asc')
      .orderBy('tr.position', 'asc')
      .select(
        'tr.id as task_id',
        'tr.title',
        'tr.type',
        'tr.status',
        'tr.assignment_status',
        'tr.assigned_to',
        'tr.position',
        'tr.updated_at',
        'tr.end_date',
        'r.id as run_id',
        'r.name as run_name',
        'r.run_number',
        'r.status as run_status',
        'w.name as workflow_name',
        'w.workflow_number',
        knex.raw('g.name as group_name'),
        'assigner.id as assigned_by',
        'assigner.display_name as assigned_by_name',
        'assigner.employee_number as assigned_by_username',
        'current_step.id as current_step_id',
        'current_step.title as current_step_title',
        'current_step.position as current_step_position',
        'current_step.status as current_step_status',
        'current_step.assigned_to as current_step_assigned_to',
        'current_assignee.display_name as current_step_assigned_to_name',
        'current_assignee.employee_number as current_step_assigned_to_username',
        knex.raw('(SELECT COUNT(*)::int FROM task_runs AS step_total WHERE step_total.run_id = r.id) AS step_count')
      );

    let query = knex.from(picked.as('a'));
    if (sort === 'status') {
      query = query
        .orderByRaw(
          `CASE a.assignment_status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END ${direction}`
        )
        .orderByRaw(
          `CASE a.status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 WHEN 'blocked' THEN 2 ELSE 3 END ${direction}`
        )
        .orderBy('a.updated_at', 'desc');
    } else {
      query = query.orderBy('a.updated_at', order).orderBy('a.run_name', 'asc');
    }

    const tasks = await query;

    return res.json({
      tasks: tasks.map((task) => withTaskTimeFields({
        ...task,
        position: task.position == null ? null : Number(task.position),
        current_step_position: task.current_step_position == null ? null : Number(task.current_step_position),
        step_count: Number(task.step_count || 0),
      })),
      sort,
      order,
      q: q || '',
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const q = req.query.q;
    const { page, limit, offset } = parsePagination(req.query);
    const total = await countScopedRuns(knex, req.eProcess, { q });
    const runs = await scopedRunsQuery(knex, req.eProcess, { q }).limit(limit).offset(offset);
    const runIds = runs.map((r) => r.id);
    let tasksByRun = {};
    if (runIds.length) {
      const tasks = await knex('task_runs')
        .whereIn('run_id', runIds)
        .select('id', 'run_id', 'status', 'end_date');
      tasksByRun = tasks.reduce((acc, t) => {
        (acc[t.run_id] ||= []).push(t);
        return acc;
      }, {});
    }
    return res.json({
      runs: runs.map((run) => withRunScheduleFields(run, tasksByRun[run.id] || [])),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.id);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!(await userCanAccessRun(knex, req.eProcess, run))) {
      return res.status(403).json({ message: 'You do not have access to this run.' });
    }

    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 220) {
      return res.status(400).json({ message: 'Run name is required (max 220 characters).' });
    }

    await knex('workflow_runs').where({ id: run.id }).update({
      name,
      updated_at: knex.fn.now(),
    });

    const tasks = await knex('task_runs').where({ run_id: run.id }).select('status', 'end_date');
    return res.json({
      run: withRunScheduleFields({ ...run, name }, tasks),
    });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.id);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!(await userCanAccessRun(knex, req.eProcess, run))) {
      return res.status(403).json({ message: 'You do not have access to this run.' });
    }

    const tasks = await knex('task_runs as tr')
      .leftJoin('users as assignee', 'assignee.id', 'tr.assigned_to')
      .leftJoin('users as assigner', 'assigner.id', 'tr.assigned_by')
      .leftJoin('users as completer', 'completer.id', 'tr.completed_by')
      .leftJoin('department_groups as ag', 'ag.id', 'tr.assignee_group_id')
      .leftJoin('delegation_groups as dg', 'dg.id', 'tr.assignee_delegation_group_id')
      .where('tr.run_id', run.id)
      .orderBy('tr.position')
      .select(
        'tr.id',
        'tr.status',
        'tr.form_data',
        'tr.note',
        'tr.completed_at',
        'tr.completed_by',
        'tr.step_id',
        'tr.position',
        'tr.title',
        'tr.description',
        'tr.type',
        'tr.required',
        'tr.allow_skip',
        'tr.allow_review',
        'tr.allow_delete',
        'tr.visible_to_starter',
        'tr.form_schema',
        'tr.condition',
        'tr.assigned_to',
        'tr.assigned_by',
        'tr.assignee_group_id',
        'tr.assignee_delegation_group_id',
        'tr.assignee_is_work_group',
        'tr.assignment_status',
        'tr.assignee_responded_at',
        'tr.end_date',
        knex.raw('COALESCE(ag.name_zh, ag.name, dg.name_zh, dg.name) as assignee_group_name'),
        'assignee.display_name as assigned_to_name',
        'assignee.employee_number as assigned_to_username',
        knex.raw('NULL as assigned_to_position_title'),
        'assigner.display_name as assigned_by_name',
        'assigner.employee_number as assigned_by_username',
        'completer.display_name as completed_by_name',
        'completer.employee_number as completed_by_username',
        knex.raw('NULL as completed_by_position_title')
      );

    const attachments = await knex('e_process_task_attachments as a')
      .whereIn(
        'a.task_run_id',
        tasks.map((t) => t.id)
      )
      .leftJoin('users as u', 'u.id', 'a.uploaded_by_user_id')
      .orderBy('a.created_at', 'asc')
      .select(
        'a.id',
        'a.task_run_id',
        'a.file_name',
        'a.file_size',
        'a.mime_type',
        'a.form_field_key',
        'a.created_at',
        'a.uploaded_by_user_id',
        'u.display_name as uploaded_by_name',
        'u.employee_number as uploaded_by_username'
      );

    const attachmentsByTask = attachments.reduce((acc, row) => {
      (acc[row.task_run_id] ||= []).push(row);
      return acc;
    }, {});

    const stageReturns = await knex('e_process_stage_returns as sr')
      .leftJoin('users as u', 'u.id', 'sr.returned_by')
      .leftJoin('task_runs as from_task', 'from_task.id', 'sr.from_task_id')
      .where('sr.run_id', run.id)
      .orderBy('sr.created_at', 'desc')
      .select(
        'sr.id',
        'sr.from_task_id',
        'sr.to_task_id',
        'sr.reason',
        'sr.returned_by',
        'sr.created_at',
        'u.display_name as returned_by_name',
        'u.employee_number as returned_by_username',
        'from_task.title as from_task_title'
      );
    const returnsByTask = stageReturns.reduce((acc, row) => {
      (acc[row.to_task_id] ||= []).push(row);
      return acc;
    }, {});

    const enriched = tasks.map((task) => {
      const terminal = ['completed', 'rejected', 'skipped'].includes(task.status);
      const starterHidden = hideStepFromStarter(req.eProcess, run, task);
      const contentHidden = starterHidden || (terminal && task.allow_review === false);
      const visible = contentHidden
        ? {
          ...task,
          description: '',
          form_schema: [],
          form_data: {},
          note: '',
          condition: null,
        }
        : task;
      return withTaskTimeFields({
      ...visible,
      content_hidden: contentHidden,
      starter_hidden: starterHidden,
      attachments: contentHidden ? [] : (attachmentsByTask[task.id] || []),
      stage_returns: returnsByTask[task.id] || [],
      assignee_group_name: task.assignee_is_work_group ? run.group_name : task.assignee_group_name,
      canAssign: canAssignTask(req.eProcess, run, task) && isOpenTask(task),
      canWork: canWorkTask(req.eProcess, task) && isOpenTask(task),
      canSkip: task.allow_skip === true && canWorkTask(req.eProcess, task) && isOpenTask(task),
      canClaimGroup: canClaimGroup(req.eProcess, run, task),
      canRespondAssignment:
        task.assigned_to === req.user.id &&
        task.assignment_status === 'pending' &&
        isOpenTask(task),
      canDeleteElement: canDeleteElement(task),
    });
    });

    const canEditStructure =
      run.status === 'active' && (await canEditRunStructure(req.eProcess, knex, run));
    const participants = await listRunParticipants(knex, run.id);

    return res.json({
      run: withRunScheduleFields(run, enriched),
      tasks: enriched,
      participants,
      currentUserId: req.user.id,
      canEndRun: canEndRun(req.eProcess, run) && run.status === 'active',
      canEditStructure,
      canManageParticipants: canManageRunParticipants(req.eProcess, run),
    });
  })
);

router.post(
  '/:runId/tasks/:taskId/assign',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!isOpenTask(task)) return res.status(400).json({ message: 'Task cannot be assigned in its current state.' });
    if (!canAssignTask(req.eProcess, run, task)) {
      return res.status(403).json({ message: 'You cannot assign this task.' });
    }

    const rawGroup = req.body?.assignee_group_id;
    const rawDelegation = req.body?.assignee_delegation_group_id;
    const assignWorkGroup = req.body?.assignee_work_group === true;
    const hasGroup = rawGroup !== undefined && rawGroup !== null && rawGroup !== '';
    const hasDelegation = rawDelegation !== undefined && rawDelegation !== null && rawDelegation !== '';
    if (assignWorkGroup || hasGroup || hasDelegation) {
      if (hasDelegation && !assignWorkGroup) {
        await assertDelegationAssignable(knex, run.group_id, rawDelegation);
      } else if (hasGroup && !assignWorkGroup) {
        await assertGroupAssignable(knex, req.eProcess, run.group_id, rawGroup);
      }
      const previousKey = task.assigned_to
        ? `user:${Number(task.assigned_to)}`
        : task.assignee_is_work_group
          ? 'work'
          : task.assignee_delegation_group_id
            ? `delegation:${Number(task.assignee_delegation_group_id)}`
            : task.assignee_group_id
              ? `group:${Number(task.assignee_group_id)}`
              : 'none';
      const nextKey = assignWorkGroup
        ? 'work'
        : hasDelegation
          ? `delegation:${Number(rawDelegation)}`
          : `group:${Number(rawGroup)}`;
      await knex('task_runs').where({ id: task.id }).update({
        assigned_to: null,
        assignee_group_id: assignWorkGroup || hasDelegation ? null : Number(rawGroup),
        assignee_delegation_group_id: assignWorkGroup || !hasDelegation ? null : Number(rawDelegation),
        assignee_is_work_group: assignWorkGroup,
        assigned_by: req.user.id,
        assignment_status: 'pending',
        assignee_responded_at: null,
        updated_at: knex.fn.now(),
      });
      if (previousKey !== nextKey) {
        await notifyTaskAssignee(knex, {
          runId: run.id,
          taskId: task.id,
          reassigned: previousKey !== 'none',
        });
      }
      return res.json({
        message: 'Assignment sent to the group.',
        task: await getTask(knex, run.id, task.id),
      });
    }

    const rawAssignee = req.body?.assignee_user_id;
    const clearAssignee =
      rawAssignee === null ||
      rawAssignee === undefined ||
      rawAssignee === '' ||
      String(rawAssignee).toLowerCase() === 'null';

    if (clearAssignee) {
      await knex('task_runs').where({ id: task.id }).update({
        assigned_to: null,
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_is_work_group: false,
        assigned_by: null,
        assignment_status: null,
        assignee_responded_at: null,
        updated_at: knex.fn.now(),
      });
      return res.json({
        message: 'Assignee cleared.',
        task: await getTask(knex, run.id, task.id),
      });
    }

    const assigneeId = Number(rawAssignee);
    if (!assigneeId) return res.status(400).json({ message: 'assignee_user_id is required.' });

    const user = await knex('users').where({ id: assigneeId, deactivated: false }).first();
    if (!user) {
      return res.status(400).json({ message: 'Assignee must be an active user.' });
    }
    await assertUsersAssignable(knex, req.eProcess, run.group_id, [assigneeId]);

    const selfAssign = assigneeId === req.user.id;
    const previousAssignee = task.assigned_to ? Number(task.assigned_to) : null;
    await knex.transaction(async (trx) => {
      await ensureEProcessAccess(trx, user);
      await trx('task_runs').where({ id: task.id }).update({
        assigned_to: assigneeId,
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_is_work_group: false,
        assigned_by: req.user.id,
        assignment_status: selfAssign ? 'accepted' : 'pending',
        assignee_responded_at: selfAssign ? trx.fn.now() : null,
        updated_at: trx.fn.now(),
      });
    });

    if (previousAssignee !== assigneeId) {
      await notifyTaskAssignee(knex, { runId: run.id, taskId: task.id, reassigned: true });
    }

    return res.json({
      message: selfAssign ? 'Task assigned to you.' : 'Assignment sent. Waiting for accept/reject.',
      task: await getTask(knex, run.id, task.id),
    });
  })
);

router.patch(
  '/:runId/tasks/:taskId/schedule',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!isOpenTask(task) && task.status !== 'blocked') {
      return res.status(400).json({ message: 'Cannot change end date on a finished step.' });
    }
    if (!canAssignTask(req.eProcess, run, task) && !canWorkTask(req.eProcess, task)) {
      return res.status(403).json({ message: 'You cannot update this step schedule.' });
    }

    // Empty / null clears the due date.
    let endDate = null;
    if (req.body?.end_date !== undefined && req.body?.end_date !== null && String(req.body.end_date).trim() !== '') {
      endDate = normalizeDateOnly(req.body.end_date);
      if (!endDate) {
        return res.status(400).json({ message: 'end_date must be YYYY-MM-DD or empty.' });
      }
    }

    await knex('task_runs').where({ id: task.id }).update({
      end_date: endDate,
      updated_at: knex.fn.now(),
    });

    const updated = await getTask(knex, run.id, task.id);
    return res.json({
      message: endDate ? 'Step end date updated.' : 'Step end date cleared.',
      task: withTaskTimeFields(updated),
    });
  })
);

router.post(
  '/:runId/tasks/:taskId/accept',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const claimingGroup = canClaimGroup(req.eProcess, run, task);
    if (task.assigned_to !== req.user.id && !claimingGroup) {
      return res.status(403).json({ message: 'Only the assignee can accept this task.' });
    }
    if (task.assignment_status !== 'pending') {
      return res.status(400).json({ message: 'This assignment is not pending.' });
    }

    await knex('task_runs').where({ id: task.id }).update({
      assigned_to: req.user.id,
      assignee_group_id: null,
      assignee_delegation_group_id: null,
      assignee_is_work_group: false,
      assignment_status: 'accepted',
      assignee_responded_at: knex.fn.now(),
      updated_at: knex.fn.now(),
    });

    return res.json({ message: 'Assignment accepted.', task: await getTask(knex, run.id, task.id) });
  })
);

router.post(
  '/:runId/tasks/:taskId/reject-assignment',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({ message: 'Only the assignee can reject this assignment.' });
    }
    if (task.assignment_status !== 'pending') {
      return res.status(400).json({ message: 'This assignment is not pending.' });
    }

    const fallback = task.assigned_by || run.started_by;
    await knex('task_runs').where({ id: task.id }).update({
      assignment_status: 'rejected',
      assignee_responded_at: knex.fn.now(),
      // Hand back to assigner so they can reassign.
      assigned_to: fallback,
      updated_at: knex.fn.now(),
    });

    // After reject, restore assigner as accepted owner so work can continue / reassign.
    if (fallback) {
      await knex('task_runs').where({ id: task.id }).update({
        assignment_status: 'accepted',
        assigned_by: req.user.id,
        updated_at: knex.fn.now(),
      });
    }

    return res.json({ message: 'Assignment rejected.', task: await getTask(knex, run.id, task.id) });
  })
);

router.post(
  '/:runId/return',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!(await userCanAccessRun(knex, req.eProcess, run))) {
      return res.status(403).json({ message: 'You do not have access to this run.' });
    }
    if (run.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled runs cannot be returned.' });
    }

    const tasks = await knex('task_runs').where({ run_id: run.id }).orderBy('position', 'asc');
    const current = tasks.find((task) => isOpenTask(task));
    if (!current) return res.status(400).json({ message: 'This run has no open stage.' });
    if (!canWorkTask(req.eProcess, current)) {
      return res.status(403).json({ message: 'Only the current stage user can return this run.' });
    }

    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ message: 'A reason is required to return to a previous stage.' });
    }
    if (reason.length > 5000) {
      return res.status(400).json({ message: 'Reason must be 5000 characters or fewer.' });
    }

    const targetId = String(req.body?.target_task_id || '');
    const returner = await knex('users').where({ id: req.user.id }).first('display_name');
    let activatedTaskId = null;
    await knex.transaction(async (trx) => {
      activatedTaskId = await returnRunToTask(run.id, targetId, trx, { reason, returnedBy: req.user.id });
    });
    await notifyTaskAssignee(knex, {
      runId: run.id,
      taskId: activatedTaskId || targetId,
      returned: true,
      reason,
      returnedByName: returner?.display_name || '',
    });
    return res.json({ ok: true });
  })
);

router.patch(
  '/:runId/tasks/:taskId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });

    const action = req.body?.action;
    if (!['start', 'save', 'complete', 'approve', 'reject', 'acknowledge', 'decline', 'skip'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action.' });
    }
    const incomingFormData =
      req.body?.form_data && typeof req.body.form_data === 'object' ? req.body.form_data : {};
    const note = String(req.body?.note || '').slice(0, 5000);

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!isOpenTask(task)) {
      return res.status(400).json({ message: 'Task cannot be updated in its current state.' });
    }
    if (!canWorkTask(req.eProcess, task)) {
      return res.status(403).json({
        message:
          task.assignment_status === 'pending'
            ? 'Accept the assignment before working on this task.'
            : 'Only the accepted assignee can update this task.',
      });
    }

    if (action === 'start') {
      await knex('task_runs').where({ id: task.id }).update({ status: 'in_progress', updated_at: knex.fn.now() });
      return res.json({ message: 'Task started.' });
    }

    if (action === 'skip') {
      if (task.allow_skip !== true) {
        return res.status(400).json({ message: 'This step cannot be skipped.' });
      }
      let activatedTaskId = null;
      await knex.transaction(async (trx) => {
        await trx('task_runs').where({ id: task.id }).update({
          status: 'skipped',
          completed_at: trx.fn.now(),
          completed_by: req.user.id,
          updated_at: trx.fn.now(),
        });
        activatedTaskId = await advanceRun(run.id, trx);
      });
      await notifyTaskAssignee(knex, { runId: run.id, taskId: activatedTaskId });
      return res.json({ message: 'Step skipped.' });
    }

    const existingFormData =
      task.form_data && typeof task.form_data === 'object' ? task.form_data : {};
    const schema = Array.isArray(task.form_schema) ? task.form_schema : [];
    const form_data = { ...existingFormData, ...incomingFormData };
    // Keep previously saved file field refs when the client omits them.
    for (const field of schema) {
      if (field.type === 'file' && !incomingFormData[field.key] && existingFormData[field.key]) {
        form_data[field.key] = existingFormData[field.key];
      }
    }

    async function persistDraft() {
      await knex('task_runs').where({ id: task.id }).update({
        form_data: JSON.stringify(form_data),
        note,
        updated_at: knex.fn.now(),
      });
    }

    if (action === 'save') {
      await persistDraft();
      return res.json({
        message: 'Draft saved.',
        task: await getTask(knex, run.id, task.id),
      });
    }

    if (task.type === 'approval' && !['complete', 'approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Approval tasks must be completed with Approval or Reject.' });
    }

    if (task.type === 'acknowledgement' && !['complete', 'acknowledge', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Acknowledgement tasks must be completed with Acknowledge or Decline.' });
    }

    if (!DECISION_STEP_TYPES.has(task.type) && action !== 'complete') {
      return res.status(400).json({ message: 'This task must be completed.' });
    }

    if (task.type === 'attachment') {
      const attachments = await listAttachments(knex, task.id);
      if (!attachments.length) {
        return res.status(400).json({ message: 'Add a PDF or image before completing this step.' });
      }
    }

    if (task.type === 'form') {
      const attachments = await listAttachments(knex, task.id);
      const missing = schema
        .filter((field) => field.required)
        .filter((field) => isEmptyFormValue(field, form_data[field.key], attachments));
      if (missing.length) {
        await persistDraft();
        return res.status(400).json({ message: `Missing required field: ${missing[0].label}` });
      }
    }

    if (task.type === 'checklist') {
      const { ok, missing } = isChecklistComplete(task.form_schema, form_data);
      if (!ok) {
        await persistDraft();
        return res.status(400).json({ message: `Check required item: ${missing[0].label}` });
      }
    }

    let savedFormData = form_data;
    if (task.type === 'communication') {
      const result = validateCommunicationData(form_data);
      if (!result.ok) {
        await persistDraft();
        return res.status(400).json({ message: result.message });
      }
      savedFormData = result.data;
    }

    let nextStatus = 'completed';
    if (task.type === 'approval') {
      const fromAction = approvalDecisionFromAction(action);
      const selected = String(form_data.decision || '').trim().toLowerCase();
      if (fromAction && selected && selected !== fromAction) {
        await persistDraft();
        return res.status(400).json({ message: 'Selected decision does not match the submit action.' });
      }
      const result = validateApprovalData({
        decision: selected || fromAction,
      });
      if (!result.ok) {
        await persistDraft();
        return res.status(400).json({ message: result.message });
      }
      savedFormData = result.data;
      nextStatus = result.data.decision === 'reject' ? 'rejected' : 'completed';
    }

    if (task.type === 'acknowledgement') {
      const fromAction = acknowledgementDecisionFromAction(action);
      const selected = String(form_data.decision || '').trim().toLowerCase();
      if (fromAction && selected && selected !== fromAction) {
        await persistDraft();
        return res.status(400).json({ message: 'Selected decision does not match the submit action.' });
      }
      const result = validateAcknowledgementData({
        decision: selected || fromAction,
      });
      if (!result.ok) {
        await persistDraft();
        return res.status(400).json({ message: result.message });
      }
      savedFormData = result.data;
      nextStatus = result.data.decision === 'decline' ? 'rejected' : 'completed';
    }

    let activatedTaskId = null;
    await knex.transaction(async (trx) => {
      await trx('task_runs').where({ id: task.id }).update({
        status: nextStatus,
        form_data: JSON.stringify(savedFormData),
        note,
        completed_at: trx.fn.now(),
        completed_by: req.user.id,
        updated_at: trx.fn.now(),
      });

      activatedTaskId = await advanceRun(run.id, trx);
    });
    await notifyTaskAssignee(knex, { runId: run.id, taskId: activatedTaskId });

    return res.json({
      message:
        task.type === 'approval'
          ? nextStatus === 'rejected'
            ? 'Decision recorded: Reject.'
            : 'Decision recorded: Approval.'
          : task.type === 'acknowledgement'
            ? nextStatus === 'rejected'
              ? 'Decision recorded: Decline.'
              : 'Decision recorded: Acknowledge.'
            : 'Task completed.',
    });
  })
);

router.post(
  '/:runId/tasks/:taskId/attachments',
  eProcessTaskAttachmentUpload,
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!isOpenTask(task)) return res.status(400).json({ message: 'Cannot attach files to a closed task.' });
    if (!canWorkTask(req.eProcess, task) && !canAssignTask(req.eProcess, run, task)) {
      return res.status(403).json({ message: 'You cannot upload attachments for this task.' });
    }
    if (!req.file) return res.status(400).json({ message: 'file is required.' });
    if (task.type !== 'form' && task.type !== 'attachment') {
      return res.status(400).json({ message: 'Files can only be uploaded on Form or Attachment steps.' });
    }

    let formFieldKey = req.body?.form_field_key ? String(req.body.form_field_key).trim().slice(0, 120) : '';
    if (task.type === 'attachment') {
      const mime = String(req.file.mimetype || '').toLowerCase();
      if (!ATTACHMENT_STEP_MIMES.has(mime)) {
        try {
          await fileStorage.deleteFile(req.file.path || req.file.storageKey);
        } catch (e) {
          console.warn('E-Process attachment reject cleanup warning:', e.message);
        }
        return res.status(400).json({ message: 'Attachment steps only accept a PDF or an image.' });
      }
      formFieldKey = ATTACHMENT_STEP_KEY;
    } else {
      if (task.type !== 'form') {
        return res.status(400).json({ message: 'Files can only be uploaded on Form or Attachment steps.' });
      }
      if (!formFieldKey) {
        return res.status(400).json({ message: 'form_field_key is required. Upload only via a Form file field.' });
      }
      const schema = Array.isArray(task.form_schema) ? task.form_schema : [];
      const fileField = schema.find((f) => f.key === formFieldKey && f.type === 'file');
      if (!fileField) {
        return res.status(400).json({ message: 'Unknown Form file field.' });
      }
    }

    const id = randomUUID();
    await knex('e_process_task_attachments').insert({
      id,
      task_run_id: task.id,
      file_name: req.file.originalname || req.file.filename,
      file_path: req.file.path || req.file.storageKey,
      file_size: req.file.size || 0,
      mime_type: req.file.mimetype || 'application/octet-stream',
      form_field_key: formFieldKey,
      uploaded_by_user_id: req.user.id,
    });

    const formData = typeof task.form_data === 'object' && task.form_data ? { ...task.form_data } : {};
    formData[formFieldKey] = id;
    await knex('task_runs').where({ id: task.id }).update({
      form_data: JSON.stringify(formData),
      updated_at: knex.fn.now(),
    });

    return res.status(201).json({ attachment: (await listAttachments(knex, task.id)).find((a) => a.id === id) });
  })
);

router.get(
  '/:runId/tasks/:taskId/attachments/:attachmentId/download',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!(await userCanAccessRun(knex, req.eProcess, run))) {
      return res.status(403).json({ message: 'You do not have access to this run.' });
    }

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (hideStepFromStarter(req.eProcess, run, task)) {
      return res.status(403).json({ message: 'This step is hidden from the person who started the run.' });
    }

    const att = await knex('e_process_task_attachments')
      .where({ id: req.params.attachmentId, task_run_id: req.params.taskId })
      .first();
    if (!att) return res.status(404).json({ message: 'Attachment not found.' });
    if (!(await fileStorage.exists(att.file_path))) return res.status(404).json({ message: 'File not found.' });
    const inlineRaw = String(req.query?.inline ?? req.query?.disposition ?? '').toLowerCase();
    const inline = inlineRaw === '1' || inlineRaw === 'true' || inlineRaw === 'inline';
    await fileStorage.streamToResponse(res, att.file_path, att.file_name, {
      inline,
      contentType: att.mime_type || undefined,
    });
  })
);

router.delete(
  '/:runId/tasks/:taskId/attachments/:attachmentId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    if (!canWorkTask(req.eProcess, task) && !canAssignTask(req.eProcess, run, task)) {
      return res.status(403).json({ message: 'You cannot delete this attachment.' });
    }

    const att = await knex('e_process_task_attachments')
      .where({ id: req.params.attachmentId, task_run_id: task.id })
      .first();
    if (!att) return res.status(404).json({ message: 'Attachment not found.' });

    await knex('e_process_task_attachments').where({ id: att.id }).del();
    if (att.form_field_key) {
      const formData = typeof task.form_data === 'object' && task.form_data ? { ...task.form_data } : {};
      if (formData[att.form_field_key] === att.id) {
        delete formData[att.form_field_key];
        await knex('task_runs').where({ id: task.id }).update({
          form_data: JSON.stringify(formData),
          updated_at: knex.fn.now(),
        });
      }
    }
    try {
      await fileStorage.deleteFile(att.file_path);
    } catch (e) {
      console.warn('E-Process attachment delete file warning:', e.message);
    }

    return res.status(204).send();
  })
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.id);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') {
      return res.status(400).json({ message: 'Only an active run can be ended.' });
    }
    if (!canEndRun(req.eProcess, run)) {
      return res.status(403).json({ message: 'You cannot end this flow.' });
    }

    const cancel_reason = String(req.body?.reason || '').trim();
    if (!cancel_reason) {
      return res.status(400).json({ message: 'A reason is required to end this flow.' });
    }
    if (cancel_reason.length > 5000) {
      return res.status(400).json({ message: 'Reason must be at most 5000 characters.' });
    }

    await knex('workflow_runs').where({ id: run.id }).update({
      status: 'cancelled',
      cancel_reason,
      updated_at: knex.fn.now(),
    });

    await notifyRunEnded(knex, {
      runId: run.id,
      endedById: req.user.id,
      reason: cancel_reason,
    });

    return res.json({ message: 'Flow ended.' });
  })
);

router.post(
  '/:runId/participants',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!canManageRunParticipants(req.eProcess, run)) {
      return res.status(403).json({ message: 'Only the run creator (or group admin) can add related people.' });
    }

    const userId = Number(req.body?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'user_id is required.' });
    }
    if (userId === Number(run.started_by)) {
      return res.status(400).json({ message: 'The run creator already has access.' });
    }

    const user = await knex('users').where({ id: userId, deactivated: false }).first();
    if (!user) return res.status(400).json({ message: 'User must be an active user.' });
    await assertUsersAssignable(knex, req.eProcess, run.group_id, [userId]);

    const existing = await knex('workflow_run_participants')
      .where({ run_id: run.id, user_id: userId })
      .first();
    if (existing) {
      return res.status(409).json({ message: 'This person is already related to the run.' });
    }

    await knex.transaction(async (trx) => {
      await ensureEProcessAccess(trx, user);
      await trx('workflow_run_participants').insert({
        run_id: run.id,
        user_id: userId,
        added_by: req.user.id,
      });
    });

    return res.status(201).json({
      message: 'Related person added.',
      participants: await listRunParticipants(knex, run.id),
    });
  })
);

router.delete(
  '/:runId/participants/:userId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (!canManageRunParticipants(req.eProcess, run)) {
      return res.status(403).json({ message: 'Only the run creator (or group admin) can remove related people.' });
    }

    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user id.' });
    }

    const deleted = await knex('workflow_run_participants')
      .where({ run_id: run.id, user_id: userId })
      .del();
    if (!deleted) return res.status(404).json({ message: 'Related person not found on this run.' });

    return res.json({
      message: 'Related person removed.',
      participants: await listRunParticipants(knex, run.id),
    });
  })
);

router.post(
  '/:runId/elements',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });
    if (!(await canEditRunStructure(req.eProcess, knex, run))) {
      return res.status(403).json({ message: 'You cannot add elements to this run.' });
    }

    const type = String(req.body?.type || '').trim();
    if (!AD_HOC_ELEMENT_TYPES.has(type)) {
      return res.status(400).json({ message: 'Only Task, Communication, Approval, or Acknowledgement can be added.' });
    }

    const title = String(req.body?.title || '').trim();
    if (!title || title.length > 180) {
      return res.status(400).json({ message: 'Title is required (max 180 characters).' });
    }
    const description = String(req.body?.description || '').slice(0, 5000);

    const tasks = await knex('task_runs').where({ run_id: run.id }).orderBy('position', 'asc').select('id', 'position', 'status');
    const insertAtRaw = req.body?.insert_at;
    const insertAt =
      insertAtRaw === undefined || insertAtRaw === null || insertAtRaw === ''
        ? tasks.length
        : Number(insertAtRaw);
    if (!Number.isInteger(insertAt) || insertAt < 0 || insertAt > tasks.length) {
      return res.status(400).json({ message: 'insert_at must be a position index from 0 to the end of the run.' });
    }

    let assigneeId = null;
    if (req.body?.assignee_user_id != null && req.body?.assignee_user_id !== '') {
      assigneeId = Number(req.body.assignee_user_id);
      if (!Number.isInteger(assigneeId) || assigneeId <= 0) {
        return res.status(400).json({ message: 'assignee_user_id must be a valid user id.' });
      }
    }

    let assigneeUser = null;
    if (assigneeId) {
      assigneeUser = await knex('users').where({ id: assigneeId, deactivated: false }).first();
      if (!assigneeUser) return res.status(400).json({ message: 'Assignee must be an active user.' });
      await assertUsersAssignable(knex, req.eProcess, run.group_id, [assigneeId]);
    }

    const elementId = randomUUID();
    let mailTaskId = null;
    await knex.transaction(async (trx) => {
      if (assigneeUser) await ensureEProcessAccess(trx, assigneeUser);

      const toShift = await trx('task_runs')
        .where({ run_id: run.id })
        .andWhere('position', '>=', insertAt)
        .orderBy('position', 'desc')
        .select('id', 'position');
      for (const row of toShift) {
        await trx('task_runs').where({ id: row.id }).update({
          position: row.position + 1,
          updated_at: trx.fn.now(),
        });
      }

      const selfAssign = Boolean(assigneeId && assigneeId === req.user.id);
      await trx('task_runs').insert({
        id: elementId,
        run_id: run.id,
        step_id: null,
        position: insertAt,
        title,
        description,
        type,
        required: true,
        allow_skip: req.body?.allow_skip === true,
        allow_review: req.body?.allow_review !== false,
        allow_delete: true,
        form_schema: JSON.stringify([]),
        condition: null,
        status: 'blocked',
        assigned_to: assigneeId,
        assigned_by: assigneeId ? req.user.id : null,
        assignment_status: assigneeId ? (selfAssign ? 'accepted' : 'pending') : null,
        assignee_responded_at: selfAssign ? trx.fn.now() : null,
        form_data: JSON.stringify({}),
        end_date: null,
      });

      const reflow = await reflowOpenTasks(trx, run.id);
      if (reflow.activatedTaskId && reflow.activatedTaskId !== reflow.previousOpenTaskId) {
        mailTaskId = reflow.activatedTaskId;
      }
    });

    await notifyTaskAssignee(knex, { runId: run.id, taskId: mailTaskId });

    return res.status(201).json({ message: 'Element added.', taskId: elementId });
  })
);

router.delete(
  '/:runId/elements/:taskId',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const run = await getRun(knex, req.params.runId);
    if (!run) return res.status(404).json({ message: 'Run not found.' });
    if (run.status !== 'active') return res.status(400).json({ message: 'This run is not active.' });
    if (!(await canEditRunStructure(req.eProcess, knex, run))) {
      return res.status(403).json({ message: 'You cannot delete elements from this run.' });
    }

    const task = await getTask(knex, run.id, req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Element not found.' });
    if (!canDeleteElement(task)) {
      return res.status(400).json({
        message: 'This element cannot be deleted (must be an incomplete added element with delete allowed).',
      });
    }

    const total = await knex('task_runs').where({ run_id: run.id }).count({ c: 'id' }).first();
    if (Number(total?.c || 0) <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last element in a run.' });
    }

    let mailTaskId = null;
    await knex.transaction(async (trx) => {
      await trx('task_runs').where({ id: task.id }).del();
      await renumberTaskPositions(trx, run.id);
      const reflow = await reflowOpenTasks(trx, run.id);
      if (reflow.activatedTaskId && reflow.activatedTaskId !== reflow.previousOpenTaskId) {
        mailTaskId = reflow.activatedTaskId;
      }
    });

    await notifyTaskAssignee(knex, { runId: run.id, taskId: mailTaskId });

    return res.json({ message: 'Element deleted.' });
  })
);

module.exports = router;
