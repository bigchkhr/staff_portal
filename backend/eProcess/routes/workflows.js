const express = require('express');
const { randomUUID } = require('crypto');
const { asyncHandler } = require('../utils/asyncHandler');
const { advanceRun } = require('../services/runProgress');
const { notifyTaskAssignee } = require('../services/stageAssigneeMail');
const {
  canCreateWorkflowInGroup,
  canAssignUserGroups,
  canEditWorkflow,
  canViewWorkflow,
  canViewWorkflowContent,
  canUseWorkflow,
  applyVisibleWorkflowFilter,
} = require('../access');
const { normalizeFormField } = require('../formFields');
const { normalizeChecklistItem } = require('../checklist');
const { ensureEProcessAccess, assertUsersAssignable, assertGroupAssignable, assertDelegationAssignable } = require('../users');
const database = require('../../config/database');
const { allocateWorkflowNumber, allocateRunNumber } = require('../numbers');

const router = express.Router();

const STEP_TYPES = new Set(['task', 'form', 'approval', 'acknowledgement', 'checklist', 'communication']);
const DELETABLE_STEP_TYPES = new Set(['task', 'approval', 'acknowledgement', 'communication']);
const OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains']);
const AUDIENCES = new Set(['everyone', 'user_groups']);
const ASSIGNEE_MODES = new Set(['unassigned', 'run_starter', 'user', 'group', 'work_group']);

const WORKFLOW_SELECT = [
  'w.*',
  database.raw('g.name as group_name'),
  'creator.display_name as created_by_name',
  'creator.employee_number as created_by_username',
  'creator.email as created_by_email',
];

function parseWorkflowBody(body) {
  const name = String(body?.name || '').trim();
  if (!name || name.length > 180) {
    const err = new Error('Workflow name is required (max 180 characters).');
    err.status = 400;
    throw err;
  }
  const description = String(body?.description || '');
  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const normalized = steps.map((step, index) => {
    const title = String(step?.title || '').trim();
    if (!title) {
      const err = new Error(`Step ${index + 1} needs a title.`);
      err.status = 400;
      throw err;
    }
    const type = STEP_TYPES.has(step?.type) ? step.type : 'task';
    let form_schema = [];
    if (type === 'form') {
      form_schema = Array.isArray(step?.form_schema)
        ? step.form_schema.map((field, fieldIndex) => normalizeFormField(field, index, fieldIndex))
        : [];
    } else if (type === 'checklist') {
      form_schema = Array.isArray(step?.form_schema)
        ? step.form_schema.map((item, itemIndex) => normalizeChecklistItem(item, index, itemIndex))
        : [];
      if (!form_schema.length) {
        const err = new Error(`Checklist step "${title}" needs at least one item.`);
        err.status = 400;
        throw err;
      }
    }
    let condition = null;
    if (step?.condition && typeof step.condition === 'object') {
      const op = OPERATORS.has(step.condition.operator) ? step.condition.operator : 'eq';
      condition = {
        stepKey: String(step.condition.stepKey || ''),
        operator: op,
        value: step.condition.value,
      };
    }

    let assignee_mode = ASSIGNEE_MODES.has(step?.assignee_mode) ? step.assignee_mode : 'unassigned';
    let assignee_user_id = null;
    let assignee_group_id = null;
    let assignee_delegation_group_id = null;
    if (assignee_mode === 'user') {
      const uid = Number(step?.assignee_user_id);
      if (!Number.isInteger(uid) || uid <= 0) {
        const err = new Error(`Step "${title}" needs a default assignee.`);
        err.status = 400;
        throw err;
      }
      assignee_user_id = uid;
    } else if (assignee_mode === 'group') {
      const delegationId = Number(step?.assignee_delegation_group_id);
      const gid = Number(step?.assignee_group_id);
      if (Number.isInteger(delegationId) && delegationId > 0) {
        assignee_delegation_group_id = delegationId;
      } else if (Number.isInteger(gid) && gid > 0) {
        assignee_group_id = gid;
      } else {
        const err = new Error(`Step "${title}" needs a default group.`);
        err.status = 400;
        throw err;
      }
    }

    const allow_delete = DELETABLE_STEP_TYPES.has(type) && step?.allow_delete === true;
    const allow_skip = step?.allow_skip === true;
    const allow_review = step?.allow_review !== false;
    const visible_to_starter = step?.visible_to_starter !== false;

    return {
      id: step.id || undefined,
      title,
      description: String(step.description || ''),
      type,
      required: step.required !== false,
      allow_skip,
      allow_review,
      allow_delete,
      visible_to_starter,
      form_schema,
      condition,
      assignee_mode,
      assignee_user_id,
      assignee_group_id,
      assignee_delegation_group_id,
    };
  });
  return { name, description, steps: normalized };
}

function db() {
  return database;
}

function withCapabilities(ctx, workflow) {
  const canEdit = canEditWorkflow(ctx, workflow);
  const canView = canViewWorkflow(ctx, workflow);
  return {
    ...workflow,
    canEdit,
    canView,
    canViewContent: canViewWorkflowContent(ctx, workflow),
    canRun: canUseWorkflow(ctx, workflow),
    canDelete: canEdit,
    canAssignAudience: canAssignUserGroups(ctx, workflow.group_id),
  };
}

async function listAudienceGroups(knex, workflowId) {
  const [users, delegations] = await Promise.all([
    knex('workflow_audience_groups as a')
      .join('department_groups as g', 'g.id', 'a.group_id')
      .where('a.workflow_id', workflowId)
      .orderBy('g.name_zh', 'asc')
      .select('g.id', knex.raw('COALESCE(g.name_zh, g.name) as name'), 'g.description', knex.raw("'user' as kind")),
    knex('workflow_audience_delegations as a')
      .join('delegation_groups as g', 'g.id', 'a.delegation_group_id')
      .where('a.workflow_id', workflowId)
      .orderBy('g.name_zh', 'asc')
      .select('g.id', knex.raw('COALESCE(g.name_zh, g.name) as name'), 'g.description', knex.raw("'delegation' as kind")),
  ]);
  return [...users, ...delegations];
}

async function listRelatedPeople(knex, workflowId) {
  return knex('workflow_participants as p')
    .join('users as u', 'u.id', 'p.user_id')
    .where('p.workflow_id', workflowId)
    .orderBy('u.display_name', 'asc')
    .select('u.id', 'u.employee_number as username', 'u.display_name', 'u.email', knex.raw('NULL as position_title'));
}

async function allowedAudienceIds(trx, workGroupId, groupIds) {
  const unique = [...new Set((groupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return [];
  const allowed = new Set(
    (await trx('e_process_work_group_assignable_groups')
      .where({ work_group_id: workGroupId })
      .whereIn('department_group_id', unique)
      .pluck('department_group_id')).map(Number)
  );
  if (unique.some((id) => !allowed.has(id))) {
    const err = new Error('Choose only user groups this work group can assign.');
    err.status = 400;
    throw err;
  }
  return unique;
}

async function allowedDelegationIds(trx, workGroupId, groupIds) {
  const unique = [...new Set((groupIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return [];
  const allowed = new Set(
    (await trx('e_process_work_group_assignable_delegations')
      .where({ work_group_id: workGroupId })
      .whereIn('delegation_group_id', unique)
      .pluck('delegation_group_id')).map(Number)
  );
  if (unique.some((id) => !allowed.has(id))) {
    const err = new Error('Choose only delegation groups this work group can assign.');
    err.status = 400;
    throw err;
  }
  return unique;
}

async function replaceAudienceGroups(trx, workflowId, workGroupId, groupIds) {
  const groups = await allowedAudienceIds(trx, workGroupId, groupIds);
  await trx('workflow_audience_groups').where({ workflow_id: workflowId }).del();
  if (!groups.length) return;
  await trx('workflow_audience_groups').insert(
    groups.map((group_id) => ({
      workflow_id: workflowId,
      group_id,
    }))
  );
}

async function replaceAudienceDelegations(trx, workflowId, workGroupId, groupIds) {
  const groups = await allowedDelegationIds(trx, workGroupId, groupIds);
  await trx('workflow_audience_delegations').where({ workflow_id: workflowId }).del();
  if (!groups.length) return;
  await trx('workflow_audience_delegations').insert(
    groups.map((delegation_group_id) => ({
      workflow_id: workflowId,
      delegation_group_id,
    }))
  );
}

async function replaceRelatedPeople(trx, workflowId, userIds) {
  await trx('workflow_participants').where({ workflow_id: workflowId }).del();
  const unique = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!unique.length) return;
  const active = await trx('users').whereIn('id', unique).andWhere({ deactivated: false }).pluck('id');
  if (!active.length) return;
  await trx('workflow_participants').insert(
    active.map((user_id) => ({
      workflow_id: workflowId,
      user_id,
    }))
  );
}

async function copyRelatedPeopleToRun(trx, { workflowId, runId, startedBy, addedBy }) {
  const rows = await trx('workflow_participants').where({ workflow_id: workflowId }).select('user_id');
  const ids = [...new Set(rows.map((r) => Number(r.user_id)).filter((id) => id && id !== Number(startedBy)))];
  if (!ids.length) return;
  const users = await trx('users').whereIn('id', ids).andWhere({ deactivated: false });
  for (const user of users) {
    await ensureEProcessAccess(trx, user);
    await trx('workflow_run_participants').insert({
      run_id: runId,
      user_id: user.id,
      added_by: addedBy,
    });
  }
}

async function getWorkflowRow(knex, workflowId) {
  return knex('workflows as w')
    .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
    .leftJoin('users as creator', 'creator.id', 'w.created_by')
    .where('w.id', workflowId)
    .select(...WORKFLOW_SELECT)
    .first();
}

async function getWorkflowDetails(knex, workflowId) {
  const workflow = await getWorkflowRow(knex, workflowId);
  if (!workflow) return null;
  const [steps, audience_groups, related_people] = await Promise.all([
    knex('workflow_steps as s')
      .leftJoin('users as au', 'au.id', 's.assignee_user_id')
      .leftJoin('department_groups as ag', 'ag.id', 's.assignee_group_id')
      .leftJoin('delegation_groups as dg', 'dg.id', 's.assignee_delegation_group_id')
      .where('s.workflow_id', workflowId)
      .orderBy('s.position')
      .select(
        's.*',
        'au.display_name as assignee_user_name',
        'au.employee_number as assignee_user_username',
        'au.email as assignee_user_email',
        knex.raw('COALESCE(ag.name_zh, ag.name, dg.name_zh, dg.name) as assignee_group_name')
      ),
    listAudienceGroups(knex, workflowId),
    listRelatedPeople(knex, workflowId),
  ]);
  return {
    ...workflow,
    steps,
    audience_groups,
    audience_group_ids: audience_groups.filter((group) => group.kind !== 'delegation').map((group) => group.id),
    audience_delegation_group_ids: audience_groups.filter((group) => group.kind === 'delegation').map((group) => group.id),
    related_people,
    related_user_ids: related_people.map((u) => u.id),
  };
}

async function assertStepGroups(knex, ctx, ownerGroupId, steps) {
  const ids = [...new Set(
    (steps || [])
      .filter((step) => step.assignee_mode === 'group' && step.assignee_group_id)
      .map((step) => Number(step.assignee_group_id))
  )];
  for (const id of ids) {
    await assertGroupAssignable(knex, ctx, ownerGroupId, id);
  }
  const delegationIds = [...new Set(
    (steps || [])
      .filter((step) => step.assignee_mode === 'group' && step.assignee_delegation_group_id)
      .map((step) => Number(step.assignee_delegation_group_id))
  )];
  for (const id of delegationIds) {
    await assertDelegationAssignable(knex, ownerGroupId, id);
  }
}

function stepInsertRow(workflowId, step, index) {
  return {
    id: step.id || randomUUID(),
    workflow_id: workflowId,
    position: index,
    title: step.title,
    description: step.description,
    type: step.type,
    required: step.required,
    allow_skip: step.allow_skip === true,
    allow_review: step.allow_review !== false,
    allow_delete: step.allow_delete === true,
    visible_to_starter: step.visible_to_starter !== false,
    form_schema: JSON.stringify(step.form_schema),
    condition: step.condition ? JSON.stringify(step.condition) : null,
    assignee_mode: step.assignee_mode || 'unassigned',
    assignee_user_id: step.assignee_mode === 'user' ? step.assignee_user_id : null,
    assignee_group_id: step.assignee_mode === 'group' ? step.assignee_group_id : null,
    assignee_delegation_group_id: step.assignee_mode === 'group' ? step.assignee_delegation_group_id : null,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const groupFilter = req.query.group_id ? String(req.query.group_id) : null;

    let query = knex('workflows as w')
      .leftJoin('workflow_steps as s', 's.workflow_id', 'w.id')
      .leftJoin('workflow_runs as r', 'r.workflow_id', 'w.id')
      .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
      .leftJoin('users as creator', 'creator.id', 'w.created_by')
      .groupBy(
        'w.id',
        'g.name',
        'creator.display_name',
        'creator.employee_number',
        'creator.email'
      )
      .orderBy('w.updated_at', 'desc')
      .select(...WORKFLOW_SELECT)
      .countDistinct({ step_count: 's.id', run_count: 'r.id' });

    query = applyVisibleWorkflowFilter(query, ctx);

    if (groupFilter) {
      if (!ctx.isSupervisor && !ctx.memberGroupIds.includes(groupFilter) && !(ctx.manageWorkflowGroupIds || []).includes(groupFilter)) {
        // Still allow filtering published everyone workflows by group name? Only if user can see them.
        // Restrict filter to workflows already visible; just andWhere group.
      }
      query = query.andWhere('w.group_id', groupFilter);
    }

    const rows = await query;
    const ids = rows.map((workflow) => workflow.id);
    const delegationLinks = ids.length
      ? await knex('workflow_audience_delegations')
        .whereIn('workflow_id', ids)
        .select('workflow_id', 'delegation_group_id')
      : [];
    const delegationsByWorkflow = new Map();
    delegationLinks.forEach((link) => {
      const list = delegationsByWorkflow.get(link.workflow_id) || [];
      list.push(link.delegation_group_id);
      delegationsByWorkflow.set(link.workflow_id, list);
    });
    const workflows = rows
      .map((workflow) => withCapabilities(ctx, {
        ...workflow,
        audience_delegation_group_ids: delegationsByWorkflow.get(workflow.id) || [],
      }))
      .filter((workflow) => workflow.canView);
    return res.json({ workflows });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const groupId = String(req.body?.group_id || '').trim();
    if (!groupId) {
      return res.status(400).json({ message: 'group_id is required.' });
    }

    const group = await knex('e_process_work_groups').where({ id: groupId, closed: false }).first();
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    if (!canCreateWorkflowInGroup(ctx, groupId)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required for this work group.' });
    }

    const data = parseWorkflowBody(req.body);
    const audience = AUDIENCES.has(req.body?.audience) ? req.body.audience : 'user_groups';
    const groupIds = Array.isArray(req.body?.user_group_ids) ? req.body.user_group_ids : [];
    const delegationIds = Array.isArray(req.body?.delegation_group_ids) ? req.body.delegation_group_ids : [];
    if (audience === 'everyone' && !ctx.isSupervisor) {
      return res.status(403).json({ message: 'Only HR can open a workflow to everyone.' });
    }
    if ((audience === 'user_groups' || groupIds.length > 0) && !canAssignUserGroups(ctx, groupId)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required to choose who can use this workflow.' });
    }
    const relatedUserIds = Array.isArray(req.body?.related_user_ids) ? req.body.related_user_ids : [];
    const fixedAssigneeIds = data.steps
      .filter((step) => step.assignee_mode === 'user' && step.assignee_user_id)
      .map((step) => step.assignee_user_id);
    await assertUsersAssignable(knex, ctx, groupId, [...relatedUserIds, ...fixedAssigneeIds]);
    await assertStepGroups(knex, ctx, groupId, data.steps);

    const workflowId = randomUUID();

    await knex.transaction(async (trx) => {
      const workflow_number = await allocateWorkflowNumber(trx);
      await trx('workflows').insert({
        id: workflowId,
        group_id: groupId,
        workflow_number,
        name: data.name,
        description: data.description,
        created_by: req.user.id,
        audience,
      });

      if (data.steps.length) {
        await trx('workflow_steps').insert(
          data.steps.map((step, index) => stepInsertRow(workflowId, step, index))
        );
      }
      if (audience === 'user_groups') {
        await replaceAudienceGroups(trx, workflowId, groupId, groupIds);
        await replaceAudienceDelegations(trx, workflowId, groupId, delegationIds);
      }
      if (relatedUserIds.length) {
        await replaceRelatedPeople(trx, workflowId, relatedUserIds);
      }
    });

    const workflow = await getWorkflowDetails(knex, workflowId);
    return res.status(201).json({ workflow: withCapabilities(ctx, workflow) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const workflow = await getWorkflowDetails(db(req), req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canViewWorkflowContent(req.eProcess, workflow)) {
      return res.status(403).json({ message: 'Only members of an added delegation group can open this workflow.' });
    }
    const enriched = withCapabilities(req.eProcess, workflow);
    return res.json({
      workflow: enriched,
      canEdit: enriched.canEdit,
      canDelete: enriched.canDelete,
      canRun: enriched.canRun,
    });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const existing = await getWorkflowRow(knex, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canEditWorkflow(req.eProcess, existing)) {
      return res.status(403).json({ message: 'You cannot edit this workflow.' });
    }

    const data = parseWorkflowBody(req.body);
    const fixedAssigneeIds = [
      ...new Set(
        data.steps
          .filter((s) => s.assignee_mode === 'user' && s.assignee_user_id)
          .map((s) => s.assignee_user_id)
      ),
    ];
    if (fixedAssigneeIds.length) {
      const active = await knex('users').whereIn('id', fixedAssigneeIds).andWhere({ deactivated: false }).pluck('id');
      if (active.length !== fixedAssigneeIds.length) {
        return res.status(400).json({ message: 'One or more default assignees are missing or inactive.' });
      }
      await assertUsersAssignable(knex, req.eProcess, existing.group_id, fixedAssigneeIds);
    }
    await assertStepGroups(knex, req.eProcess, existing.group_id, data.steps);

    await knex.transaction(async (trx) => {
      await trx('workflows').where({ id: req.params.id }).update({
        name: data.name,
        description: data.description,
        status: 'draft',
        updated_at: trx.fn.now(),
      });

      await trx('workflow_steps').where({ workflow_id: req.params.id }).del();
      if (data.steps.length) {
        await trx('workflow_steps').insert(
          data.steps.map((step, index) => stepInsertRow(req.params.id, step, index))
        );
      }
    });

    const workflow = await getWorkflowDetails(knex, req.params.id);
    return res.json({ workflow: withCapabilities(req.eProcess, workflow) });
  })
);

router.patch(
  '/:id/settings',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const ctx = req.eProcess;
    const existing = await getWorkflowRow(knex, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canEditWorkflow(ctx, existing)) {
      return res.status(403).json({ message: 'You cannot change settings for this workflow.' });
    }

    let nextGroupId = existing.group_id;
    if (req.body?.group_id !== undefined) {
      nextGroupId = String(req.body.group_id || '').trim();
      if (!nextGroupId) {
        return res.status(400).json({ message: 'group_id is required.' });
      }
      if (String(nextGroupId) !== String(existing.group_id)) {
        const group = await knex('e_process_work_groups').where({ id: nextGroupId, closed: false }).first();
        if (!group) return res.status(404).json({ message: 'Group not found.' });
        if (!canCreateWorkflowInGroup(ctx, nextGroupId)) {
          return res.status(403).json({ message: 'Manage-workflows permission is required for the target work group.' });
        }
      }
    }

    let nextAudience = existing.audience || 'user_groups';
    if (req.body?.audience !== undefined) {
      if (!AUDIENCES.has(req.body.audience)) {
        return res.status(400).json({ message: 'audience must be everyone or user_groups.' });
      }
      nextAudience = req.body.audience;
    }

    const userGroupIds = Array.isArray(req.body?.user_group_ids) ? req.body.user_group_ids : null;
    const delegationGroupIds = Array.isArray(req.body?.delegation_group_ids) ? req.body.delegation_group_ids : null;
    const touchesAudience = req.body?.audience !== undefined || userGroupIds !== null || delegationGroupIds !== null;
    if (nextAudience === 'everyone' && !ctx.isSupervisor) {
      return res.status(403).json({ message: 'Only HR can open a workflow to everyone.' });
    }
    if (touchesAudience && !canAssignUserGroups(ctx, nextGroupId)) {
      return res.status(403).json({ message: 'Manage-workflows permission is required to choose who can use this workflow.' });
    }

    const relatedUserIds = Array.isArray(req.body?.related_user_ids) ? req.body.related_user_ids : null;
    if (relatedUserIds) {
      await assertUsersAssignable(knex, ctx, nextGroupId, relatedUserIds);
    }

    await knex.transaction(async (trx) => {
      await trx('workflows').where({ id: existing.id }).update({
        group_id: nextGroupId,
        audience: nextAudience,
        updated_at: trx.fn.now(),
      });
      if (nextAudience === 'everyone') {
        await trx('workflow_audience_groups').where({ workflow_id: existing.id }).del();
        await trx('workflow_audience_delegations').where({ workflow_id: existing.id }).del();
      } else {
        if (userGroupIds !== null) await replaceAudienceGroups(trx, existing.id, nextGroupId, userGroupIds);
        if (delegationGroupIds !== null) await replaceAudienceDelegations(trx, existing.id, nextGroupId, delegationGroupIds);
      }
      if (relatedUserIds !== null) {
        await replaceRelatedPeople(trx, existing.id, relatedUserIds);
      }
    });

    const updated = await getWorkflowDetails(knex, existing.id);
    return res.json({
      workflow: withCapabilities(ctx, updated),
      message: 'Settings saved.',
    });
  })
);

router.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const workflow = await getWorkflowDetails(knex, req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canEditWorkflow(req.eProcess, workflow)) {
      return res.status(403).json({ message: 'You cannot publish this workflow.' });
    }

    const countRow = await knex('workflow_steps').where({ workflow_id: req.params.id }).count('* as count').first();
    if (Number(countRow.count) === 0) {
      return res.status(400).json({ message: 'Add at least one step before publishing.' });
    }

    // Prefer body override; otherwise use saved settings.
    const audience = AUDIENCES.has(req.body?.audience) ? req.body.audience : (workflow.audience || 'user_groups');
    const userGroupIds = Array.isArray(req.body?.user_group_ids)
      ? req.body.user_group_ids
      : (workflow.audience_group_ids || []);
    if (audience === 'everyone' && !req.eProcess.isSupervisor) {
      return res.status(403).json({ message: 'Only HR can open a workflow to everyone.' });
    }

    await knex.transaction(async (trx) => {
      await trx('workflows').where({ id: req.params.id }).update({
        status: 'published',
        audience,
        updated_at: trx.fn.now(),
      });
      if (audience === 'everyone') {
        await trx('workflow_audience_groups').where({ workflow_id: req.params.id }).del();
        await trx('workflow_audience_delegations').where({ workflow_id: req.params.id }).del();
      } else if (Array.isArray(req.body?.user_group_ids) || Array.isArray(req.body?.delegation_group_ids)) {
        if (Array.isArray(req.body?.user_group_ids)) {
          await replaceAudienceGroups(trx, req.params.id, workflow.group_id, userGroupIds);
        }
        if (Array.isArray(req.body?.delegation_group_ids)) {
          await replaceAudienceDelegations(trx, req.params.id, workflow.group_id, req.body.delegation_group_ids);
        }
      }
    });

    const updated = await getWorkflowDetails(knex, req.params.id);
    return res.json({ workflow: withCapabilities(req.eProcess, updated) });
  })
);

router.post(
  '/:id/unpublish',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const workflow = await getWorkflowDetails(knex, req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canEditWorkflow(req.eProcess, workflow)) {
      return res.status(403).json({ message: 'You cannot unpublish this workflow.' });
    }
    if (workflow.status !== 'published') {
      return res.status(400).json({ message: 'This workflow is already a draft.' });
    }

    await knex('workflows').where({ id: req.params.id }).update({
      status: 'draft',
      updated_at: knex.fn.now(),
    });

    const updated = await getWorkflowDetails(knex, req.params.id);
    return res.json({ workflow: withCapabilities(req.eProcess, updated) });
  })
);

router.post(
  '/:id/runs',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const workflow = await getWorkflowRow(knex, req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canUseWorkflow(req.eProcess, workflow)) {
      return res.status(403).json({ message: 'You do not have access to this workflow.' });
    }
    if (workflow.status !== 'published') {
      return res.status(400).json({ message: 'Publish this workflow before starting a run.' });
    }

    const steps = await knex('workflow_steps').where({ workflow_id: workflow.id }).orderBy('position');
    if (!steps.length) return res.status(400).json({ message: 'Workflow has no steps.' });

    const fixedIds = [
      ...new Set(
        steps
          .filter((s) => s.assignee_mode === 'user' && s.assignee_user_id)
          .map((s) => Number(s.assignee_user_id))
      ),
    ];
    let activeFixed = new Set();
    if (fixedIds.length) {
      const rows = await knex('users').whereIn('id', fixedIds).andWhere({ deactivated: false }).select('id');
      activeFixed = new Set(rows.map((r) => Number(r.id)));
      for (const id of fixedIds) {
        if (!activeFixed.has(id)) {
          return res.status(400).json({
            message: 'A step default assignee is inactive. Update the workflow before starting a run.',
          });
        }
      }
    }

    const runId = randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const defaultName = `${workflow.name} · ${today}`;
    const runName = (req.body.name && String(req.body.name).trim()) || defaultName;
    if (!runName || runName.length > 220) {
      return res.status(400).json({ message: 'Run title is required (max 220 characters).' });
    }

    let activatedTaskId = null;
    await knex.transaction(async (trx) => {
      const run_number = await allocateRunNumber(trx);
      await trx('workflow_runs').insert({
        id: runId,
        workflow_id: workflow.id,
        run_number,
        name: runName,
        status: 'active',
        started_by: req.user.id,
      });

      const starter = await knex('users').where({ id: req.user.id }).first();
      for (const step of steps) {
        let assigneeId = null;
        let assigneeGroupId = null;
        let assigneeDelegationId = null;
        let assigneeIsWorkGroup = false;
        if (step.assignee_mode === 'run_starter') {
          assigneeId = req.user.id;
        } else if (step.assignee_mode === 'user' && step.assignee_user_id) {
          assigneeId = Number(step.assignee_user_id);
        } else if (step.assignee_mode === 'group' && step.assignee_delegation_group_id) {
          assigneeDelegationId = Number(step.assignee_delegation_group_id);
          const group = await trx('delegation_groups').where({ id: assigneeDelegationId, closed: false }).first('id');
          if (!group) {
            const err = new Error('A step default group is no longer available. Update the workflow before starting a run.');
            err.status = 400;
            throw err;
          }
        } else if (step.assignee_mode === 'group' && step.assignee_group_id) {
          assigneeGroupId = Number(step.assignee_group_id);
          const group = await trx('department_groups').where({ id: assigneeGroupId, closed: false }).first('id');
          if (!group) {
            const err = new Error('A step default group is no longer available. Update the workflow before starting a run.');
            err.status = 400;
            throw err;
          }
        } else if (step.assignee_mode === 'work_group') {
          assigneeIsWorkGroup = true;
        }

        let assignment_status = null;
        let assignee_responded_at = null;
        let assigned_by = null;

        if (assigneeGroupId || assigneeDelegationId || assigneeIsWorkGroup) {
          assignment_status = 'pending';
          assigned_by = req.user.id;
        } else if (assigneeId) {
          const assigneeUser =
            assigneeId === req.user.id
              ? starter
              : await trx('users').where({ id: assigneeId, deactivated: false }).first();
          if (!assigneeUser) {
            const err = new Error('Default assignee not found.');
            err.status = 400;
            throw err;
          }
          await ensureEProcessAccess(trx, assigneeUser);
          const selfAssign = assigneeId === req.user.id;
          assignment_status = selfAssign ? 'accepted' : 'pending';
          assignee_responded_at = selfAssign ? trx.fn.now() : null;
          assigned_by = req.user.id;
        }

        await trx('task_runs').insert({
          id: randomUUID(),
          run_id: runId,
          step_id: step.id,
          position: step.position,
          title: step.title,
          description: step.description,
          type: step.type,
          required: step.required,
          allow_skip: step.allow_skip === true,
          allow_review: step.allow_review !== false,
          allow_delete: step.allow_delete === true,
          visible_to_starter: step.visible_to_starter !== false,
          form_schema: JSON.stringify(step.form_schema || []),
          condition: step.condition ? JSON.stringify(step.condition) : null,
          status: 'blocked',
          assigned_to: assigneeId,
          assignee_group_id: assigneeGroupId,
          assignee_delegation_group_id: assigneeDelegationId,
          assignee_is_work_group: assigneeIsWorkGroup,
          assigned_by,
          assignment_status,
          assignee_responded_at,
          form_data: JSON.stringify({}),
          end_date: null,
        });
      }

      await copyRelatedPeopleToRun(trx, {
        workflowId: workflow.id,
        runId,
        startedBy: req.user.id,
        addedBy: req.user.id,
      });

      activatedTaskId = await advanceRun(runId, trx);
    });

    await notifyTaskAssignee(knex, { runId, taskId: activatedTaskId });

    return res.status(201).json({ runId });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const knex = db(req);
    const existing = await getWorkflowRow(knex, req.params.id);
    if (!existing) return res.status(404).json({ message: 'Workflow not found.' });
    if (!canEditWorkflow(req.eProcess, existing)) {
      return res.status(403).json({ message: 'You cannot delete this workflow.' });
    }
    await knex('workflows').where({ id: req.params.id }).del();
    return res.status(204).send();
  })
);

router.use((err, req, res, next) => {
  if (err.status === 400) return res.status(400).json({ message: err.message });
  return next(err);
});

module.exports = router;
