const ON_DUTY = 'on_duty';
const WORK_MEMBERS = 'work_members';

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(Number).filter((id) => !Number.isNaN(id));
  if (typeof value === 'string') {
    return value.replace(/[{}"]/g, '').split(',').map((part) => Number(part.trim())).filter((id) => !Number.isNaN(id) && id > 0);
  }
  return [];
}

async function ensureEProcessAccess() {
  return null;
}

function userShape(row) {
  return {
    id: row.id,
    username: row.employee_number,
    employee_number: row.employee_number,
    display_name: row.display_name,
    email: row.email || '',
    position_title: row.position_name || '',
  };
}

const userColumns = [
  'users.id',
  'users.employee_number',
  'users.display_name',
  'users.email',
  'positions.name as position_name',
];

function activeUsers(knex) {
  return knex('users')
    .leftJoin('positions', 'positions.id', 'users.position_id')
    .where('users.deactivated', false);
}

async function listAssignableGroups(knex, ctx, ownerGroupId) {
  const owner = await knex('e_process_work_groups')
    .where({ id: ownerGroupId, closed: false })
    .first('id', 'name');
  if (!owner) return [];

  const rows = ctx.isSupervisor
    ? await knex('department_groups').where({ closed: false }).orderBy('name_zh', 'asc').select('id', 'name', 'name_zh')
    : await knex('e_process_work_group_assignable_groups as a')
      .join('department_groups as g', 'g.id', 'a.department_group_id')
      .where('a.work_group_id', owner.id)
      .andWhere('g.closed', false)
      .orderBy('g.name_zh', 'asc')
      .select('g.id', 'g.name', 'g.name_zh');

  const delegations = await knex('e_process_work_group_assignable_delegations as a')
    .join('delegation_groups as d', 'd.id', 'a.delegation_group_id')
    .where('a.work_group_id', owner.id)
    .andWhere('d.closed', false)
    .orderBy('d.name_zh', 'asc')
    .select('d.id', 'd.name', 'd.name_zh');

  return [
    { id: WORK_MEMBERS, name: owner.name, name_en: owner.name, synthetic: true, kind: 'work' },
    ...rows.map((row) => ({
      id: row.id,
      name: row.name_zh || row.name,
      name_en: row.name,
      kind: 'department',
    })),
    ...delegations.map((row) => ({
      id: row.id,
      name: row.name_zh || row.name,
      name_en: row.name,
      kind: 'delegation',
    })),
    { id: ON_DUTY, name: '今日在本店', name_en: 'On duty here today', synthetic: true, kind: 'duty' },
  ];
}

async function listWorkGroupMembers(knex, ownerGroupId) {
  const directIds = await knex('e_process_work_group_members')
    .where({ work_group_id: ownerGroupId })
    .pluck('user_id');
  const linked = await knex('e_process_work_group_delegation_groups as l')
    .join('delegation_groups as d', 'd.id', 'l.delegation_group_id')
    .where('l.work_group_id', ownerGroupId)
    .andWhere('d.closed', false)
    .pluck('d.user_ids');
  const ids = new Set(directIds.map(Number).filter((id) => Number.isInteger(id) && id > 0));
  linked.forEach((userIds) => parseIdList(userIds).forEach((id) => ids.add(id)));
  if (!ids.size) return [];
  const rows = await activeUsers(knex)
    .whereIn('users.id', [...ids])
    .orderBy('users.display_name', 'asc')
    .select(userColumns);
  return rows.map(userShape);
}

async function listGroupMembers(knex, groupId) {
  const group = await knex('department_groups').where({ id: Number(groupId), closed: false }).first('user_ids');
  if (!group) return [];
  const ids = parseIdList(group.user_ids);
  if (!ids.length) return [];
  const rows = await activeUsers(knex).whereIn('users.id', ids).orderBy('users.display_name', 'asc').select(userColumns);
  return rows.map(userShape);
}

async function listOnDutyMembers(knex, ownerGroupId) {
  const todaySql = "schedules.schedule_date = (timezone('Asia/Hong_Kong', now()))::date";
  const departmentIds = await knex('e_process_work_group_assignable_groups')
    .where({ work_group_id: ownerGroupId })
    .pluck('department_group_id');
  if (!departmentIds.length) return [];
  const shiftIds = await knex('schedules')
    .join('stores', 'stores.id', 'schedules.store_id')
    .whereIn('stores.department_group_id', departmentIds)
    .whereRaw(todaySql)
    .pluck('schedules.user_id');
  const loanIds = await knex('schedule_duty_assignments')
    .join('schedules', 'schedules.id', 'schedule_duty_assignments.schedule_id')
    .join('stores as loan_store', 'loan_store.id', 'schedule_duty_assignments.loan_store_id')
    .whereIn('loan_store.department_group_id', departmentIds)
    .whereRaw(todaySql)
    .pluck('schedules.user_id');
  const ids = [...new Set([...shiftIds, ...loanIds].map(Number))];
  if (!ids.length) return [];
  const rows = await activeUsers(knex).whereIn('users.id', ids).orderBy('users.display_name', 'asc').select(userColumns);
  return rows.map(userShape);
}

async function listDelegationMembers(knex, groupId) {
  const group = await knex('delegation_groups').where({ id: Number(groupId), closed: false }).first('user_ids');
  if (!group) return [];
  const ids = parseIdList(group.user_ids);
  if (!ids.length) return [];
  const rows = await activeUsers(knex).whereIn('users.id', ids).orderBy('users.display_name', 'asc').select(userColumns);
  return rows.map(userShape);
}

async function assertDelegationAssignable(knex, ownerGroupId, groupId) {
  const id = Number(groupId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Choose a delegation group to assign.');
    err.status = 400;
    throw err;
  }
  const allowed = await knex('e_process_work_group_assignable_delegations as a')
    .join('delegation_groups as d', 'd.id', 'a.delegation_group_id')
    .where({ 'a.work_group_id': ownerGroupId, 'a.delegation_group_id': id, 'd.closed': false })
    .first('a.delegation_group_id');
  if (!allowed) {
    const err = new Error('That delegation group is not one this work group can assign.');
    err.status = 403;
    throw err;
  }
}

async function assertGroupAssignable(knex, ctx, ownerGroupId, groupId) {
  const id = Number(groupId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('Choose a department group to assign.');
    err.status = 400;
    throw err;
  }
  const group = await knex('department_groups').where({ id, closed: false }).first('id');
  if (!group) {
    const err = new Error('That department group is not available.');
    err.status = 400;
    throw err;
  }
  if (ctx.isSupervisor) return;
  const allowed = await knex('e_process_work_group_assignable_groups')
    .where({ work_group_id: ownerGroupId, department_group_id: id })
    .first('department_group_id');
  if (!allowed) {
    const err = new Error('That group is not one this work group can assign.');
    err.status = 403;
    throw err;
  }
}

async function assertUsersAssignable(knex, ctx, ownerGroupId, userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  for (const id of ids) {
    const ok = await userIsAssignable(knex, ctx, ownerGroupId, id);
    if (!ok) {
      const err = new Error('That person is not in a group this department can assign.');
      err.status = 403;
      throw err;
    }
  }
}

async function userIsAssignable(knex, ctx, ownerGroupId, userId) {
  const user = await knex('users').where({ id: Number(userId), deactivated: false }).first('id');
  if (!user) return false;
  if (ctx.isSupervisor) return true;

  const groups = await listAssignableGroups(knex, ctx, ownerGroupId);
  for (const group of groups) {
    let members = [];
    if (group.id === ON_DUTY) members = await listOnDutyMembers(knex, ownerGroupId);
    else if (group.id === WORK_MEMBERS) members = await listWorkGroupMembers(knex, ownerGroupId);
    else if (group.kind === 'delegation') members = await listDelegationMembers(knex, group.id);
    else members = await listGroupMembers(knex, group.id);
    if (members.some((member) => Number(member.id) === Number(userId))) return true;
  }
  return false;
}

module.exports = {
  ON_DUTY,
  WORK_MEMBERS,
  ensureEProcessAccess,
  listAssignableGroups,
  listGroupMembers,
  listWorkGroupMembers,
  listDelegationMembers,
  listOnDutyMembers,
  assertGroupAssignable,
  assertDelegationAssignable,
  userIsAssignable,
  assertUsersAssignable,
  userShape,
};
