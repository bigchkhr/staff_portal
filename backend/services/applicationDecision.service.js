const knex = require('../config/database');
const ApplicationAction = require('../database/models/ApplicationAction');

const STAGE_ORDER = ['checker', 'approver_1', 'approver_2', 'approver_3'];

const SNAPSHOT_STAGES = [
  { stage: 'checker', at: 'checker_at', remarks: 'checker_remarks', actor: 'checker_id' },
  { stage: 'approver_1', at: 'approver_1_at', remarks: 'approver_1_remarks', actor: 'approver_1_id' },
  { stage: 'approver_2', at: 'approver_2_at', remarks: 'approver_2_remarks', actor: 'approver_2_id' },
  { stage: 'approver_3', at: 'approver_3_at', remarks: 'approver_3_remarks', actor: 'approver_3_id' }
];

function nextOpenStage(row) {
  for (const stage of STAGE_ORDER) {
    if (row && row[`${stage}_id`] && !row[`${stage}_at`]) {
      return stage;
    }
  }
  return 'completed';
}

function nextAssignedStage(application, fromStage) {
  const index = STAGE_ORDER.indexOf(fromStage);
  for (let i = index + 1; i < STAGE_ORDER.length; i += 1) {
    const stage = STAGE_ORDER[i];
    if (application[`${stage}_id`]) {
      return stage;
    }
  }
  return 'completed';
}

function isPaperFlow(application) {
  return application.is_paper_flow === true || application.flow_type === 'paper-flow';
}

async function approveAndRecord(table, applicationType, applicationId, approverId, level, remarks = null) {
  await knex.transaction(async (trx) => {
    const updateData = {
      [`${level}_at`]: knex.fn.now(),
      [`${level}_id`]: approverId
    };
    if (remarks) {
      updateData[`${level}_remarks`] = remarks;
    }

    await trx(table).where('id', applicationId).update(updateData);
    const row = await trx(table).where('id', applicationId).first();
    const toStage = nextOpenStage(row);
    const statusUpdate = { current_approval_stage: toStage };
    if (toStage === 'completed') {
      statusUpdate.status = 'approved';
    }
    await trx(table).where('id', applicationId).update(statusUpdate);
    await ApplicationAction.create({
      application_type: applicationType,
      application_id: applicationId,
      action: 'approved',
      actor_id: approverId,
      from_stage: level,
      to_stage: toStage,
      reason: remarks || null
    }, trx);
  });
}

async function rejectAndRecord(table, applicationType, applicationId, rejectorId, reason) {
  await knex.transaction(async (trx) => {
    const row = await trx(table).where('id', applicationId).first();
    let fromStage = row?.current_approval_stage;
    if (!fromStage || fromStage === 'completed') {
      const openStage = nextOpenStage(row);
      fromStage = openStage === 'completed' ? null : openStage;
    }

    await trx(table).where('id', applicationId).update({
      status: 'rejected',
      rejected_by_id: rejectorId,
      rejected_at: knex.fn.now(),
      rejection_reason: reason,
      current_approval_stage: 'completed'
    });
    await ApplicationAction.create({
      application_type: applicationType,
      application_id: applicationId,
      action: 'rejected',
      actor_id: rejectorId,
      from_stage: fromStage,
      to_stage: 'completed',
      reason: reason || null
    }, trx);
  });
}

async function recordCreatedApproval(applicationType, application, actorId) {
  if (!application || application.status !== 'approved') {
    return;
  }

  await ApplicationAction.create({
    application_type: applicationType,
    application_id: application.id,
    action: 'approved',
    actor_id: actorId || null,
    from_stage: isPaperFlow(application) ? 'paper_flow' : null,
    to_stage: 'completed',
    reason: null
  });
}

async function withActorNames(rows) {
  const ids = [...new Set(rows.map((row) => row.actor_id).filter(Boolean))];
  if (ids.length === 0) {
    return rows;
  }

  const users = await knex('users')
    .whereIn('id', ids)
    .select('id', 'display_name', 'employee_number');
  const byId = new Map(users.map((user) => [Number(user.id), user]));

  return rows.map((row) => {
    if (row.actor_display_name || !row.actor_id) {
      return row;
    }
    const user = byId.get(Number(row.actor_id));
    if (!user) {
      return row;
    }
    return {
      ...row,
      actor_display_name: user.display_name,
      actor_employee_number: user.employee_number
    };
  });
}

async function mergeSnapshotActions(applicationType, application, actions) {
  const covered = new Set();
  actions.forEach((item) => {
    if (item.action === 'approved' && item.from_stage) {
      covered.add(`approved:${item.from_stage}`);
    }
    if (item.action === 'approved' && !item.from_stage) {
      covered.add('approved:auto');
    }
    if (item.action === 'rejected') {
      covered.add('rejected');
    }
  });

  const extras = [];
  SNAPSHOT_STAGES.forEach((stage) => {
    if (!application[stage.at] || covered.has(`approved:${stage.stage}`)) {
      return;
    }
    extras.push({
      id: `snapshot-approved-${stage.stage}`,
      application_type: applicationType,
      application_id: application.id,
      action: 'approved',
      actor_id: application[stage.actor] || null,
      from_stage: stage.stage,
      to_stage: nextAssignedStage(application, stage.stage),
      reason: application[stage.remarks] || null,
      created_at: application[stage.at]
    });
  });

  if (application.rejected_at && !covered.has('rejected')) {
    extras.push({
      id: 'snapshot-rejected',
      application_type: applicationType,
      application_id: application.id,
      action: 'rejected',
      actor_id: application.rejected_by_id || null,
      from_stage: null,
      to_stage: 'completed',
      reason: application.rejection_reason || null,
      created_at: application.rejected_at
    });
  }

  const latestReturn = actions
    .filter((item) => item.action === 'returned' && STAGE_ORDER.includes(item.from_stage))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  if (latestReturn) {
    const fromIndex = STAGE_ORDER.indexOf(latestReturn.from_stage);
    const returnTime = new Date(latestReturn.created_at).getTime();
    STAGE_ORDER.slice(0, fromIndex).forEach((stage, index) => {
      const actorId = application[`${stage}_id`];
      const alreadyRecorded = application[`${stage}_at`]
        || actions.some((item) => item.action === 'approved' && item.from_stage === stage)
        || extras.some((item) => item.action === 'approved' && item.from_stage === stage);
      if (!actorId || alreadyRecorded) {
        return;
      }
      const nextStage = STAGE_ORDER.slice(index + 1, fromIndex).find((candidate) => application[`${candidate}_id`])
        || latestReturn.from_stage;
      extras.push({
        id: `recovered-approved-${stage}`,
        application_type: applicationType,
        application_id: application.id,
        action: 'approved',
        actor_id: actorId,
        from_stage: stage,
        to_stage: nextStage,
        reason: null,
        created_at: null,
        sort_at: new Date(returnTime - ((fromIndex - index) * 1000)).toISOString(),
        recovered: true
      });
    });
  }

  const hasApproved = actions.some((item) => item.action === 'approved')
    || extras.some((item) => item.action === 'approved');
  if (application.status === 'approved' && !hasApproved && !covered.has('approved:auto')) {
    extras.push({
      id: 'snapshot-approved-auto',
      application_type: applicationType,
      application_id: application.id,
      action: 'approved',
      actor_id: null,
      from_stage: isPaperFlow(application) ? 'paper_flow' : null,
      to_stage: 'completed',
      reason: null,
      created_at: application.updated_at || application.created_at
    });
  }

  const named = await withActorNames(extras);
  return [...actions, ...named].sort((a, b) => {
    const timeOf = (item) => new Date(item.sort_at || item.created_at || 0).getTime();
    const diff = timeOf(a) - timeOf(b);
    if (Number.isNaN(diff) || diff === 0) return 0;
    return diff;
  });
}

module.exports = {
  approveAndRecord,
  rejectAndRecord,
  recordCreatedApproval,
  mergeSnapshotActions
};
