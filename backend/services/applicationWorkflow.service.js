const knex = require('../config/database');
const ApplicationAction = require('../database/models/ApplicationAction');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');
const User = require('../database/models/User');
const emailService = require('../utils/emailService');

const STAGE_ORDER = ['checker', 'approver_1', 'approver_2', 'approver_3'];

const TYPE_CONFIG = {
  leave: {
    table: 'leave_applications',
    loadModel: () => require('../database/models/LeaveApplication'),
    canApprove: (userId, id) => User.canApprove(userId, id)
  },
  extra_working_hours: {
    table: 'extra_working_hours_applications',
    loadModel: () => require('../database/models/ExtraWorkingHoursApplication'),
    canApprove: (userId, id) => User.canApproveExtraWorkingHours(userId, id)
  },
  outdoor_work: {
    table: 'outdoor_work_applications',
    loadModel: () => require('../database/models/OutdoorWorkApplication'),
    canApprove: (userId, id) => User.canApproveOutdoorWork(userId, id)
  }
};

class WorkflowError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function resolveType(applicationType) {
  const type = applicationType || 'leave';
  const config = TYPE_CONFIG[type];
  if (!config) {
    throw new WorkflowError(400, '不支援的申請類型');
  }
  return { type, config };
}

function resolveCurrentStage(application) {
  if (application.current_approval_stage) {
    return application.current_approval_stage;
  }
  for (const stage of STAGE_ORDER) {
    if (application[`${stage}_id`] && !application[`${stage}_at`]) {
      return stage;
    }
  }
  return 'completed';
}

function returnTargets(application, currentStage) {
  const index = STAGE_ORDER.indexOf(currentStage);
  if (index < 0) return [];
  const targets = [{ stage: 'applicant' }];
  for (let i = 0; i < index; i += 1) {
    const stage = STAGE_ORDER[i];
    if (application[`${stage}_id`]) {
      targets.push({ stage });
    }
  }
  return targets;
}

function clearStageUpdates(fromStage) {
  const startIndex = fromStage === 'applicant' ? 0 : STAGE_ORDER.indexOf(fromStage);
  const update = {};
  STAGE_ORDER.slice(startIndex).forEach((stage) => {
    update[`${stage}_at`] = null;
    update[`${stage}_remarks`] = null;
  });
  return update;
}

async function loadRaw(config, id) {
  const application = await knex(config.table).where('id', id).first();
  if (!application) {
    throw new WorkflowError(404, '申請不存在');
  }
  return application;
}

async function loadFormatted(config, id) {
  return config.loadModel().findById(id);
}

async function notifyStage(application, type, stage) {
  const departmentGroups = await DepartmentGroup.findByUserId(application.user_id);
  if (!departmentGroups || departmentGroups.length === 0) return;
  const approvalFlow = await DepartmentGroup.getApprovalFlow(departmentGroups[0].id);
  const step = approvalFlow.find((item) => item.level === stage);
  if (!step || !step.delegation_group_id) return;
  const approvers = await DelegationGroup.getMembers(step.delegation_group_id);
  if (!approvers || approvers.length === 0) return;

  if (type === 'extra_working_hours') {
    await emailService.sendExtraWorkingHoursApprovalNotification(application, approvers, stage);
  } else if (type === 'outdoor_work') {
    await emailService.sendOutdoorWorkApprovalNotification(application, approvers, stage);
  } else {
    await emailService.sendApprovalNotification(application, approvers, stage);
  }
}

async function notifyReturn(application, type, toStage, reason, actorId, fromStage) {
  const actor = await User.findById(actorId);
  const actorName = actor?.display_name || actor?.name_zh || '';
  let recipients = [];

  if (toStage === 'applicant') {
    const applicant = await User.findById(application.user_id);
    if (applicant) recipients = [applicant];
  } else {
    const departmentGroups = await DepartmentGroup.findByUserId(application.user_id);
    if (departmentGroups && departmentGroups.length > 0) {
      const approvalFlow = await DepartmentGroup.getApprovalFlow(departmentGroups[0].id);
      const step = approvalFlow.find((item) => item.level === toStage);
      if (step && step.delegation_group_id) {
        recipients = await DelegationGroup.getMembers(step.delegation_group_id);
      }
    }
  }

  await emailService.sendApplicationReturnNotification(application, type, recipients, {
    reason,
    actorName,
    fromStage,
    toStage
  });
}

async function assertCanView(type, userId, applicationId) {
  let canView = false;
  if (type === 'leave') {
    canView = await User.canViewApplication(userId, applicationId);
  } else if (type === 'extra_working_hours') {
    canView = await User.canViewExtraWorkingHoursApplication(userId, applicationId);
  } else if (type === 'outdoor_work') {
    canView = await User.canViewOutdoorWorkApplication(userId, applicationId);
  }
  if (!canView) {
    throw new WorkflowError(403, '無權限查看此申請');
  }
}

async function getWorkflow(applicationType, applicationId, userId) {
  const { type, config } = resolveType(applicationType);
  const application = await loadRaw(config, applicationId);
  await assertCanView(type, userId, applicationId);
  const stage = resolveCurrentStage(application);
  const isApplicant = Number(application.user_id) === Number(userId);
  const pending = application.status === 'pending';
  const canApprove = pending && STAGE_ORDER.includes(stage)
    ? await config.canApprove(userId, applicationId)
    : false;

  return {
    current_stage: stage,
    can_withdraw: isApplicant && pending,
    can_resubmit: isApplicant && pending && stage === 'applicant',
    can_return: canApprove,
    return_targets: canApprove ? returnTargets(application, stage) : [],
    actions: await ApplicationAction.listByApplication(type, applicationId)
  };
}

async function withdraw(applicationType, applicationId, userId, reason) {
  const { type, config } = resolveType(applicationType);
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new WorkflowError(400, '請填寫撤銷原因');
  }

  const application = await loadRaw(config, applicationId);
  if (Number(application.user_id) !== Number(userId)) {
    throw new WorkflowError(403, '只有申請人可以撤銷申請');
  }
  if (application.status !== 'pending') {
    throw new WorkflowError(400, '只有尚未正式批准的申請可以撤銷');
  }

  const fromStage = resolveCurrentStage(application);
  await knex.transaction(async (trx) => {
    await trx(config.table).where('id', applicationId).update({
      status: 'withdrawn'
    });
    await ApplicationAction.create({
      application_type: type,
      application_id: applicationId,
      action: 'withdrawn',
      actor_id: userId,
      from_stage: fromStage,
      to_stage: null,
      reason: trimmedReason
    }, trx);
  });

  return loadFormatted(config, applicationId);
}

async function returnApplication(applicationType, applicationId, userId, toStage, reason) {
  const { type, config } = resolveType(applicationType);
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new WorkflowError(400, '請填寫發還原因');
  }
  if (toStage !== 'applicant' && !STAGE_ORDER.includes(toStage)) {
    throw new WorkflowError(400, '發還對象不正確');
  }

  const application = await loadRaw(config, applicationId);
  if (application.status !== 'pending') {
    throw new WorkflowError(400, '只有待批核的申請可以發還');
  }

  const fromStage = resolveCurrentStage(application);
  if (!STAGE_ORDER.includes(fromStage)) {
    throw new WorkflowError(400, '現階段不能發還');
  }

  const allowed = returnTargets(application, fromStage).some((item) => item.stage === toStage);
  if (!allowed) {
    throw new WorkflowError(400, '只能發還給前面的申請人或批核者');
  }

  const canApprove = await config.canApprove(userId, applicationId);
  if (!canApprove) {
    throw new WorkflowError(403, '無權限發還此申請');
  }

  await knex.transaction(async (trx) => {
    await trx(config.table).where('id', applicationId).update({
      status: 'pending',
      current_approval_stage: toStage,
      ...clearStageUpdates(toStage)
    });
    await ApplicationAction.create({
      application_type: type,
      application_id: applicationId,
      action: 'returned',
      actor_id: userId,
      from_stage: fromStage,
      to_stage: toStage,
      reason: trimmedReason
    }, trx);
  });

  const updated = await loadFormatted(config, applicationId);
  try {
    await notifyReturn(updated, type, toStage, trimmedReason, userId, fromStage);
  } catch (error) {
    console.error('[applicationWorkflow] 發送發還電郵失敗:', error);
  }
  return updated;
}

async function resubmit(applicationType, applicationId, userId) {
  const { type, config } = resolveType(applicationType);
  const application = await loadRaw(config, applicationId);
  if (Number(application.user_id) !== Number(userId)) {
    throw new WorkflowError(403, '只有申請人可以再呈交');
  }
  if (application.status !== 'pending' || resolveCurrentStage(application) !== 'applicant') {
    throw new WorkflowError(400, '此申請不在待再呈交狀態');
  }

  const nextStage = STAGE_ORDER.find((stage) => application[`${stage}_id`]);
  if (!nextStage) {
    throw new WorkflowError(400, '沒有可呈交的批核階段');
  }

  await knex(config.table).where('id', applicationId).update({
    current_approval_stage: nextStage
  });
  await ApplicationAction.create({
    application_type: type,
    application_id: applicationId,
    action: 'resubmitted',
    actor_id: userId,
    from_stage: 'applicant',
    to_stage: nextStage,
    reason: null
  });

  const updated = await loadFormatted(config, applicationId);
  try {
    await notifyStage(updated, type, nextStage);
  } catch (error) {
    console.error('[applicationWorkflow] 發送再呈交電郵失敗:', error);
  }
  return updated;
}

module.exports = {
  WorkflowError,
  getWorkflow,
  withdraw,
  returnApplication,
  resubmit
};
