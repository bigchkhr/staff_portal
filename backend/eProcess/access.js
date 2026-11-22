/**
 * E-Process access.
 * Work groups own workflows and procedures. HR adds their members.
 * Those members create and edit that work group's workflows.
 * User groups are the existing department groups: they are the audience
 * that may use a published workflow, including same-day shop loans.
 * HR sees everything.
 */

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(Number).filter((id) => !Number.isNaN(id));
  if (typeof value === 'string') {
    return value.replace(/[{}"]/g, '').split(',').map((part) => Number(part.trim())).filter((id) => !Number.isNaN(id) && id > 0);
  }
  return [];
}

function includesId(list, id) {
  return (list || []).some((item) => String(item) === String(id));
}

async function loadEProcessContext(knex, user) {
  const userId = Number(user.id);
  const isSupervisor = Boolean(user.is_system_admin);

  const [workGroups, directMemberships, linkedMemberships, departments, delegationGroupIds] = await Promise.all([
    knex('e_process_work_groups').where({ closed: false }).pluck('id'),
    knex('e_process_work_group_members').where({ user_id: userId }).pluck('work_group_id'),
    knex('e_process_work_group_delegation_groups as l')
      .join('delegation_groups as d', 'd.id', 'l.delegation_group_id')
      .where('d.closed', false)
      .whereRaw('? = ANY(d.user_ids)', [userId])
      .pluck('l.work_group_id'),
    knex('department_groups').where({ closed: false }).select('id', 'user_ids'),
    knex('delegation_groups').where({ closed: false }).whereRaw('? = ANY(user_ids)', [userId]).pluck('id'),
  ]);

  const memberships = [...new Set([...directMemberships, ...linkedMemberships].map(String))];
  const manageWorkflowGroupIds = isSupervisor
    ? workGroups.map(String)
    : memberships;

  const memberGroupIds = [];
  departments.forEach((group) => {
    if (parseIdList(group.user_ids).includes(userId)) memberGroupIds.push(String(group.id));
  });

  const loanedGroupIds = await loanedGroupIdsFor(knex, userId);
  const audienceGroupIds = [...new Set([...memberGroupIds, ...loanedGroupIds])];
  const departmentWorkflowIds = audienceGroupIds.length
    ? await knex('workflow_audience_groups').whereIn('group_id', audienceGroupIds).pluck('workflow_id')
    : [];
  const delegationWorkflowIds = delegationGroupIds.length
    ? await knex('workflow_audience_delegations').whereIn('delegation_group_id', delegationGroupIds).pluck('workflow_id')
    : [];
  const audienceWorkflowIds = [...new Set([...departmentWorkflowIds, ...delegationWorkflowIds].map(String))];

  return {
    userId,
    isSupervisor,
    memberGroupIds,
    delegationGroupIds: delegationGroupIds.map(String),
    manageWorkflowGroupIds,
    workGroupIds: memberships,
    loanedGroupIds,
    audienceWorkflowIds,
  };
}

async function loanedGroupIdsFor(knex, userId) {
  const todaySql = "schedules.schedule_date = (timezone('Asia/Hong_Kong', now()))::date";
  const byShift = await knex('schedules')
    .join('stores', 'stores.id', 'schedules.store_id')
    .where('schedules.user_id', userId)
    .whereRaw(todaySql)
    .whereNotNull('stores.department_group_id')
    .pluck('stores.department_group_id');

  const byLoan = await knex('schedule_duty_assignments')
    .join('schedules', 'schedules.id', 'schedule_duty_assignments.schedule_id')
    .join('stores as loan_store', 'loan_store.id', 'schedule_duty_assignments.loan_store_id')
    .where('schedules.user_id', userId)
    .whereRaw(todaySql)
    .whereNotNull('loan_store.department_group_id')
    .pluck('loan_store.department_group_id');

  return [...new Set([...byShift, ...byLoan].map((id) => String(id)))];
}

function canManageGroup(ctx, groupId) {
  return canManageWorkflows(ctx, groupId);
}

function canManageWorkflows(ctx, groupId) {
  if (ctx.isSupervisor) return true;
  return includesId(ctx.manageWorkflowGroupIds, groupId);
}

function canCreateWorkflowInGroup(ctx, groupId) {
  return canManageWorkflows(ctx, groupId);
}

function canAssignUserGroups(ctx, groupId) {
  return canManageWorkflows(ctx, groupId);
}

function canEditProcedure(ctx, procedure) {
  return canManageWorkflows(ctx, procedure.group_id);
}

function canViewProcedure(ctx, procedure) {
  if (ctx.isSupervisor) return true;
  if (canEditProcedure(ctx, procedure)) return true;
  if (procedure.status !== 'published') return false;
  if (procedure.audience === 'everyone') return true;
  const mine = new Set([...(ctx.memberGroupIds || []), ...(ctx.loanedGroupIds || [])]);
  const groups = procedure.audience_group_ids
    || (procedure.audience_groups || []).filter((group) => group.kind !== 'delegation').map((group) => group.id);
  if (groups.some((id) => mine.has(String(id)))) return true;
  const mineDelegations = new Set(ctx.delegationGroupIds || []);
  const delegations = procedure.audience_delegation_group_ids
    || (procedure.audience_groups || []).filter((group) => group.kind === 'delegation').map((group) => group.id);
  return delegations.some((id) => mineDelegations.has(String(id)));
}

function applyVisibleProcedureFilter(query, ctx) {
  if (ctx.isSupervisor) return query;
  const grantIds = [...new Set([...(ctx.memberGroupIds || []), ...(ctx.loanedGroupIds || [])])];
  const manageIds = ctx.manageWorkflowGroupIds || [];
  return query.where(function () {
    if (manageIds.length) this.whereIn('p.group_id', manageIds);
    this.orWhere(function () {
      this.where('p.status', 'published').andWhere(function () {
        this.where('p.audience', 'everyone');
        if (grantIds.length) {
          this.orWhereExists(function existsAudience() {
            this.select(this.client.raw('1'))
              .from('e_process_procedure_audience_groups as pag')
              .whereRaw('pag.procedure_id = p.id')
              .whereIn('pag.group_id', grantIds);
          });
        }
        const delegationIds = ctx.delegationGroupIds || [];
        if (delegationIds.length) {
          this.orWhereExists(function existsDelegationAudience() {
            this.select(this.client.raw('1'))
              .from('e_process_procedure_audience_delegations as pad')
              .whereRaw('pad.procedure_id = p.id')
              .whereIn('pad.delegation_group_id', delegationIds);
          });
        }
      });
    });
  });
}

function canEditWorkflow(ctx, workflow) {
  return canManageWorkflows(ctx, workflow.group_id);
}

function canViewWorkflow(ctx, workflow) {
  if (ctx.isSupervisor) return true;
  if (canEditWorkflow(ctx, workflow)) return true;
  if (workflow.status !== 'published') return false;
  if (workflow.audience === 'everyone') return true;
  return (ctx.audienceWorkflowIds || []).includes(String(workflow.id));
}

function canViewWorkflowContent(ctx, workflow) {
  if (ctx.isSupervisor) return true;
  if (canEditWorkflow(ctx, workflow)) return true;
  const mine = new Set((ctx.delegationGroupIds || []).map((id) => String(id)));
  const allowed = workflow.audience_delegation_group_ids || [];
  return allowed.some((id) => mine.has(String(id)));
}

function canUseWorkflow(ctx, workflow) {
  if (workflow.status !== 'published') return false;
  return canViewWorkflow(ctx, workflow);
}

function canViewRun(ctx, run) {
  if (ctx.isSupervisor) return true;
  if (Number(run.started_by) === Number(ctx.userId)) return true;
  if (canEditWorkflow(ctx, { group_id: run.group_id })) return true;
  return false;
}

function applyRunsVisibility(query, knex, ctx) {
  if (ctx.isSupervisor) return query;
  const userId = Number(ctx.userId);
  const manageIds = ctx.manageWorkflowGroupIds || [];
  return query.where(function () {
    this.where('r.started_by', userId);
    if (manageIds.length) this.orWhereIn('w.group_id', manageIds);
    this.orWhereExists(function () {
      this.select(knex.raw('1'))
        .from('task_runs as mine')
        .whereRaw('mine.run_id = r.id')
        .andWhere('mine.assigned_to', userId);
    });
    const deptIds = ctx.memberGroupIds || [];
    const delegationIds = ctx.delegationGroupIds || [];
    const workIds = ctx.workGroupIds || [];
    if (deptIds.length || delegationIds.length || workIds.length) {
      this.orWhereExists(function () {
        this.select(knex.raw('1'))
          .from('task_runs as mine')
          .whereRaw('mine.run_id = r.id')
          .whereNull('mine.assigned_to')
          .where('mine.assignment_status', 'pending')
          .where(function pool() {
            if (deptIds.length) this.whereIn('mine.assignee_group_id', deptIds);
            if (delegationIds.length) {
              const delegationPool = function delegationPoolClause() {
                this.whereIn('mine.assignee_delegation_group_id', delegationIds);
              };
              if (deptIds.length) this.orWhere(delegationPool);
              else this.where(delegationPool);
            }
            if (workIds.length) {
              const workPool = function workPoolClause() {
                this.where('mine.assignee_is_work_group', true).whereIn('w.group_id', workIds);
              };
              if (deptIds.length || delegationIds.length) this.orWhere(workPool);
              else this.where(workPool);
            }
          });
      });
    }
    this.orWhereExists(function () {
      this.select(knex.raw('1'))
        .from('workflow_run_participants as rp')
        .whereRaw('rp.run_id = r.id')
        .andWhere('rp.user_id', userId);
    });
  });
}

function applyVisibleWorkflowFilter(query, ctx) {
  if (ctx.isSupervisor) return query;
  const grantIds = [...new Set([...(ctx.memberGroupIds || []), ...(ctx.loanedGroupIds || [])])];
  const manageIds = ctx.manageWorkflowGroupIds || [];
  return query.where(function () {
    if (manageIds.length) this.whereIn('w.group_id', manageIds);
    this.orWhere(function () {
      this.where('w.status', 'published').andWhere(function () {
        this.where('w.audience', 'everyone');
        if (grantIds.length) {
          this.orWhereExists(function existsAudience() {
            this.select(this.client.raw('1'))
              .from('workflow_audience_groups as wag')
              .whereRaw('wag.workflow_id = w.id')
              .whereIn('wag.group_id', grantIds);
          });
        }
        const delegationIds = ctx.delegationGroupIds || [];
        if (delegationIds.length) {
          this.orWhereExists(function existsDelegationAudience() {
            this.select(this.client.raw('1'))
              .from('workflow_audience_delegations as wad')
              .whereRaw('wad.workflow_id = w.id')
              .whereIn('wad.delegation_group_id', delegationIds);
          });
        }
      });
    });
  });
}

module.exports = {
  loadEProcessContext,
  loanedGroupIdsFor,
  canManageGroup,
  canManageWorkflows,
  canAssignUserGroups,
  canCreateWorkflowInGroup,
  canEditProcedure,
  canViewProcedure,
  applyVisibleProcedureFilter,
  canEditWorkflow,
  canViewWorkflow,
  canViewWorkflowContent,
  canUseWorkflow,
  canViewRun,
  applyRunsVisibility,
  applyVisibleWorkflowFilter,
  includesId,
};
