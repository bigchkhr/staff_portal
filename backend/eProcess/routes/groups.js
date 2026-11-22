const express = require('express');
const { randomUUID } = require('crypto');
const knex = require('../../config/database');
const { asyncHandler } = require('../utils/asyncHandler');
const { canManageWorkflows, includesId } = require('../access');

const router = express.Router();

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function requireHr(ctx, res) {
  if (ctx.isSupervisor) return true;
  res.status(403).json({ message: 'Only HR can change work groups.' });
  return false;
}

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(Number).filter((id) => Number.isInteger(id) && id > 0);
  if (typeof value === 'string') {
    return value.replace(/[{}"]/g, '').split(',').map((part) => Number(part.trim())).filter((id) => Number.isInteger(id) && id > 0);
  }
  return [];
}

async function openDelegationGroups() {
  const rows = await knex('delegation_groups')
    .where({ closed: false })
    .orderBy('name_zh', 'asc')
    .select('id', 'name', 'name_zh');
  return rows.map((group) => ({
    id: group.id,
    name: group.name_zh || group.name,
  }));
}

async function userGroups() {
  const rows = await knex('department_groups')
    .where({ closed: false })
    .orderBy('name_zh', 'asc')
    .select('id', 'name', 'name_zh', 'description');
  return rows.map((group) => ({
    id: group.id,
    name: group.name_zh || group.name,
    description: group.description || '',
    kind: 'user',
  }));
}

async function linkedDelegationGroups(workGroupId) {
  const rows = await knex('e_process_work_group_delegation_groups as l')
    .join('delegation_groups as d', 'd.id', 'l.delegation_group_id')
    .where('l.work_group_id', workGroupId)
    .orderBy('d.name_zh', 'asc')
    .select('d.id', 'd.name', 'd.name_zh', 'd.closed', 'd.user_ids');
  return rows.map((group) => ({
    id: group.id,
    name: group.name_zh || group.name,
    closed: Boolean(group.closed),
    user_ids: group.closed ? [] : parseIdList(group.user_ids),
  }));
}

async function memberRows(workGroupId) {
  const [direct, links] = await Promise.all([
    knex('e_process_work_group_members as m')
      .join('users', 'users.id', 'm.user_id')
      .leftJoin('positions', 'positions.id', 'users.position_id')
      .where('m.work_group_id', workGroupId)
      .andWhere('users.deactivated', false)
      .orderBy('users.display_name', 'asc')
      .select(
        'users.id',
        'users.employee_number as username',
        'users.display_name',
        'users.email',
        'positions.name as position_title'
      ),
    linkedDelegationGroups(workGroupId),
  ]);
  const via = new Map();
  links.forEach((group) => {
    group.user_ids.forEach((userId) => {
      const names = via.get(userId) || [];
      names.push(group.name);
      via.set(userId, names);
    });
  });
  const directIds = new Set(direct.map((member) => Number(member.id)));
  const extraIds = [...via.keys()].filter((userId) => !directIds.has(userId));
  const extra = extraIds.length
    ? await knex('users')
      .leftJoin('positions', 'positions.id', 'users.position_id')
      .whereIn('users.id', extraIds)
      .andWhere('users.deactivated', false)
      .select(
        'users.id',
        'users.employee_number as username',
        'users.display_name',
        'users.email',
        'positions.name as position_title'
      )
    : [];
  return [...direct, ...extra]
    .map((member) => ({
      ...member,
      direct: directIds.has(Number(member.id)),
      via_groups: via.get(Number(member.id)) || [],
    }))
    .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'zh'));
}

async function memberCountByWorkGroup() {
  const rows = await knex('e_process_work_group_members as m')
    .join('users', 'users.id', 'm.user_id')
    .where('users.deactivated', false)
    .groupBy('m.work_group_id')
    .select('m.work_group_id')
    .count({ member_count: '*' });
  return new Map(rows.map((row) => [String(row.work_group_id), Number(row.member_count)]));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = req.eProcess;
    const groups = await knex('e_process_work_groups')
      .where({ closed: false })
      .orderBy('name', 'asc');
    const countById = await memberCountByWorkGroup();
    const assignableRows = await knex('e_process_work_group_assignable_groups')
      .select('work_group_id', 'department_group_id');
    const assignableByWorkGroup = new Map();
    assignableRows.forEach((row) => {
      const key = String(row.work_group_id);
      const list = assignableByWorkGroup.get(key) || [];
      list.push(Number(row.department_group_id));
      assignableByWorkGroup.set(key, list);
    });
    const delegationRows = await knex('e_process_work_group_assignable_delegations')
      .select('work_group_id', 'delegation_group_id');
    const delegationsByWorkGroup = new Map();
    delegationRows.forEach((row) => {
      const key = String(row.work_group_id);
      const list = delegationsByWorkGroup.get(key) || [];
      list.push(Number(row.delegation_group_id));
      delegationsByWorkGroup.set(key, list);
    });

    const visible = groups
      .filter((group) => ctx.isSupervisor || includesId(ctx.manageWorkflowGroupIds, group.id))
      .map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description || '',
        kind: 'work',
        member_count: countById.get(String(group.id)) || 0,
        canManageWorkflows: canManageWorkflows(ctx, group.id),
        assignable_user_group_ids: assignableByWorkGroup.get(String(group.id)) || [],
        assignable_delegation_group_ids: delegationsByWorkGroup.get(String(group.id)) || [],
      }));

    return res.json({
      groups: visible,
      assignableUserGroups: await userGroups(),
      delegationGroups: await openDelegationGroups(),
      canCreateGroup: ctx.isSupervisor,
      canAssignAnyAudience: (ctx.manageWorkflowGroupIds || []).length > 0,
      isSupervisor: ctx.isSupervisor,
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const ctx = req.eProcess;
    if (!requireHr(ctx, res)) return undefined;
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 180) {
      return res.status(400).json({ message: 'Work group name is required.' });
    }
    const id = randomUUID();
    await knex('e_process_work_groups').insert({
      id,
      name,
      description: String(req.body?.description || ''),
      created_by: ctx.userId,
      closed: false,
    });
    return res.status(201).json({ id });
  })
);

router.get(
  '/member-candidates',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json({ users: [] });
    const like = `%${q.replace(/[%_]/g, '')}%`;
    const users = await knex('users')
      .where('deactivated', false)
      .andWhere(function () {
        this.whereILike('display_name', like)
          .orWhereILike('employee_number', like)
          .orWhereILike('email', like);
      })
      .orderBy('display_name', 'asc')
      .limit(20)
      .select('id', 'employee_number', 'display_name', 'email');
    return res.json({ users });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ctx = req.eProcess;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    if (!ctx.isSupervisor && !includesId(ctx.manageWorkflowGroupIds, req.params.id)) {
      return res.status(403).json({ message: 'You cannot view this work group.' });
    }
    const group = await knex('e_process_work_groups').where({ id: req.params.id, closed: false }).first();
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const [assignable, assignableDelegations, links, members] = await Promise.all([
      knex('e_process_work_group_assignable_groups').where({ work_group_id: group.id }).pluck('department_group_id'),
      knex('e_process_work_group_assignable_delegations').where({ work_group_id: group.id }).pluck('delegation_group_id'),
      linkedDelegationGroups(group.id),
      memberRows(group.id),
    ]);
    const linkedUserIds = [...new Set(links.flatMap((link) => link.user_ids))];
    const activeLinkedIds = linkedUserIds.length
      ? new Set((await knex('users').whereIn('id', linkedUserIds).andWhere({ deactivated: false }).pluck('id')).map(Number))
      : new Set();
    return res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description || '',
        kind: 'work',
        canManageWorkflows: canManageWorkflows(ctx, group.id),
        isHr: ctx.isSupervisor,
        members,
        delegation_groups: links.map((link) => ({
          id: link.id,
          name: link.name,
          closed: link.closed,
          member_count: link.user_ids.filter((userId) => activeLinkedIds.has(userId)).length,
        })),
        assignable_user_group_ids: assignable.map(Number),
        assignable_delegation_group_ids: assignableDelegations.map(Number),
      },
    });
  })
);

router.post(
  '/:id/members',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    const group = await knex('e_process_work_groups').where({ id: req.params.id, closed: false }).first('id');
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const userId = Number(req.body?.user_id);
    const user = await knex('users').where({ id: userId, deactivated: false }).first('id');
    if (!user) return res.status(400).json({ message: 'Choose an active user.' });
    const existing = await knex('e_process_work_group_members')
      .where({ work_group_id: group.id, user_id: userId })
      .first('id');
    if (!existing) {
      await knex('e_process_work_group_members').insert({ work_group_id: group.id, user_id: userId });
    }
    return res.json({ ok: true });
  })
);

router.post(
  '/:id/delegation-groups',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    const group = await knex('e_process_work_groups').where({ id: req.params.id, closed: false }).first('id');
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const delegationGroupId = Number(req.body?.delegation_group_id);
    const delegation = await knex('delegation_groups')
      .where({ id: delegationGroupId, closed: false })
      .first('id');
    if (!delegation) return res.status(400).json({ message: 'Choose an open delegation group.' });
    const existing = await knex('e_process_work_group_delegation_groups')
      .where({ work_group_id: group.id, delegation_group_id: delegationGroupId })
      .first('id');
    if (!existing) {
      await knex('e_process_work_group_delegation_groups').insert({
        work_group_id: group.id,
        delegation_group_id: delegationGroupId,
      });
    }
    return res.json({ ok: true });
  })
);

router.delete(
  '/:id/delegation-groups/:delegationGroupId',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    await knex('e_process_work_group_delegation_groups')
      .where({
        work_group_id: req.params.id,
        delegation_group_id: Number(req.params.delegationGroupId),
      })
      .del();
    return res.json({ ok: true });
  })
);

router.delete(
  '/:id/members/:userId',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    await knex('e_process_work_group_members')
      .where({ work_group_id: req.params.id, user_id: Number(req.params.userId) })
      .del();
    return res.json({ ok: true });
  })
);

router.put(
  '/:id/assignable-groups',
  asyncHandler(async (req, res) => {
    if (!requireHr(req.eProcess, res)) return undefined;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Group not found.' });
    const group = await knex('e_process_work_groups').where({ id: req.params.id, closed: false }).first('id');
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const requested = [...new Set((req.body?.target_group_ids || []).map(Number))]
      .filter((id) => Number.isInteger(id) && id > 0);
    const requestedDelegations = [...new Set((req.body?.delegation_group_ids || []).map(Number))]
      .filter((id) => Number.isInteger(id) && id > 0);
    const existing = requested.length
      ? (await knex('department_groups').whereIn('id', requested).andWhere({ closed: false }).pluck('id')).map(Number)
      : [];
    const existingDelegations = requestedDelegations.length
      ? (await knex('delegation_groups').whereIn('id', requestedDelegations).andWhere({ closed: false }).pluck('id')).map(Number)
      : [];
    await knex.transaction(async (trx) => {
      await trx('e_process_work_group_assignable_groups').where({ work_group_id: group.id }).del();
      if (existing.length) {
        await trx('e_process_work_group_assignable_groups').insert(
          existing.map((department_group_id) => ({ work_group_id: group.id, department_group_id }))
        );
      }
      await trx('e_process_work_group_assignable_delegations').where({ work_group_id: group.id }).del();
      if (existingDelegations.length) {
        await trx('e_process_work_group_assignable_delegations').insert(
          existingDelegations.map((delegation_group_id) => ({ work_group_id: group.id, delegation_group_id }))
        );
      }
    });
    return res.json({ target_group_ids: existing, delegation_group_ids: existingDelegations });
  })
);

module.exports = router;
