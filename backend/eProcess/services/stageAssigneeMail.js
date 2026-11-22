const emailService = require('../../utils/emailService');
const { listGroupMembers, listWorkGroupMembers, listDelegationMembers } = require('../users');

function runUrl(runId) {
  const base = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
  return `${base}/e-process/runs/${runId}`;
}

async function recipientsForTask(knex, row) {
  if (row.assigned_to) {
    if (row.deactivated) return { people: [], groupName: '' };
    return {
      people: [{ id: row.assigned_to, email: row.email, display_name: row.display_name }],
      groupName: '',
    };
  }

  let members = [];
  let groupName = row.work_group_name || '';
  if (row.assignee_is_work_group && row.work_group_id) {
    members = await listWorkGroupMembers(knex, row.work_group_id);
  } else if (row.assignee_delegation_group_id) {
    members = await listDelegationMembers(knex, row.assignee_delegation_group_id);
    const group = await knex('delegation_groups')
      .where({ id: row.assignee_delegation_group_id })
      .first('name', 'name_zh');
    groupName = group?.name_zh || group?.name || '';
  } else if (row.assignee_group_id) {
    members = await listGroupMembers(knex, row.assignee_group_id);
    const group = await knex('department_groups')
      .where({ id: row.assignee_group_id })
      .first('name', 'name_zh');
    groupName = group?.name_zh || group?.name || '';
  }

  const seen = new Set();
  const people = [];
  for (const member of members) {
    const email = String(member.email || '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    people.push({ id: member.id, email: member.email.trim(), display_name: member.display_name || '' });
  }
  return { people, groupName };
}

async function notifyTaskAssignee(knex, { runId, taskId, reassigned = false, returned = false, reason = '', returnedByName = '' } = {}) {
  if (!runId || !taskId) {
    console.log('[eProcess] stage assignment email skipped: no newly opened stage', { runId, taskId });
    return;
  }
  try {
    const row = await knex('task_runs as tr')
      .join('workflow_runs as r', 'r.id', 'tr.run_id')
      .join('workflows as w', 'w.id', 'r.workflow_id')
      .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
      .leftJoin('users as u', 'u.id', 'tr.assigned_to')
      .where('tr.id', taskId)
      .andWhere('tr.run_id', runId)
      .whereIn('tr.status', ['pending', 'in_progress'])
      .first(
        'tr.title',
        'tr.assignment_status',
        'tr.assigned_to',
        'tr.assignee_group_id',
        'tr.assignee_delegation_group_id',
        'tr.assignee_is_work_group',
        'r.name as run_name',
        'r.run_number',
        'w.name as workflow_name',
        'w.group_id as work_group_id',
        'g.name as work_group_name',
        'u.email',
        'u.display_name',
        'u.deactivated'
      );
    if (!row) {
      console.log('[eProcess] stage assignment email skipped: stage is not open', { runId, taskId });
      return;
    }

    const { people, groupName } = await recipientsForTask(knex, row);
    if (!people.length) {
      console.log('[eProcess] stage assignment email skipped: no recipients', { runId, taskId });
      return;
    }

    console.log('[eProcess] sending stage assignment email', {
      runId,
      taskId,
      to: people.map((person) => person.email),
      reassigned,
      groupName,
    });
    for (const person of people) {
      await emailService.sendEProcessStageAssignment({
        to: person.email,
        assigneeName: person.display_name,
        runName: row.run_name,
        runNumber: row.run_number,
        workflowName: row.workflow_name,
        stageTitle: row.title,
        runUrl: runUrl(runId),
        reassigned,
        returned,
        reason,
        returnedByName,
        needsAccept: row.assignment_status === 'pending',
        groupName,
      });
    }
  } catch (error) {
    console.error('[eProcess] stage assignment email failed:', error.message);
  }
}

function addRecipient(bucket, person, excludeUserId) {
  if (!person) return;
  if (excludeUserId && Number(person.id) === Number(excludeUserId)) return;
  const email = String(person.email || '').trim();
  if (!email) return;
  const key = email.toLowerCase();
  if (bucket.has(key)) return;
  bucket.set(key, { email, display_name: person.display_name || '' });
}

async function notifyRunEnded(knex, { runId, endedById, reason } = {}) {
  if (!runId) return;
  try {
    const run = await knex('workflow_runs as r')
      .join('workflows as w', 'w.id', 'r.workflow_id')
      .leftJoin('e_process_work_groups as g', 'g.id', 'w.group_id')
      .leftJoin('users as ender', 'ender.id', endedById)
      .where('r.id', runId)
      .first(
        'r.name as run_name',
        'r.run_number',
        'r.started_by',
        'w.name as workflow_name',
        'w.group_id as work_group_id',
        'g.name as work_group_name',
        'ender.display_name as ended_by_name'
      );
    if (!run) return;

    const tasks = await knex('task_runs as tr')
      .leftJoin('users as u', 'u.id', 'tr.assigned_to')
      .where('tr.run_id', runId)
      .select(
        'tr.assigned_to',
        'tr.assignee_group_id',
        'tr.assignee_delegation_group_id',
        'tr.assignee_is_work_group',
        'u.id as user_id',
        'u.email',
        'u.display_name',
        'u.deactivated'
      );
    const participants = await knex('workflow_run_participants as p')
      .join('users as u', 'u.id', 'p.user_id')
      .where('p.run_id', runId)
      .andWhere('u.deactivated', false)
      .select('u.id', 'u.email', 'u.display_name');
    const starter = run.started_by
      ? await knex('users').where({ id: run.started_by, deactivated: false }).first('id', 'email', 'display_name')
      : null;

    const bucket = new Map();
    for (const task of tasks) {
      const { people } = await recipientsForTask(knex, {
        ...task,
        work_group_id: run.work_group_id,
        work_group_name: run.work_group_name,
      });
      people.forEach((person) => addRecipient(bucket, person, endedById));
    }
    participants.forEach((person) => addRecipient(bucket, person, endedById));
    addRecipient(bucket, starter, endedById);

    const recipients = [...bucket.values()];
    if (!recipients.length) {
      console.log('[eProcess] flow ended email skipped: no recipients', { runId });
      return;
    }
    console.log('[eProcess] sending flow ended email', {
      runId,
      to: recipients.map((person) => person.email),
    });
    for (const person of recipients) {
      await emailService.sendEProcessFlowEnded({
        to: person.email,
        assigneeName: person.display_name,
        runName: run.run_name,
        runNumber: run.run_number,
        workflowName: run.workflow_name,
        runUrl: runUrl(runId),
        reason,
        endedByName: run.ended_by_name || '',
      });
    }
  } catch (error) {
    console.error('[eProcess] flow ended email failed:', error.message);
  }
}

module.exports = { notifyTaskAssignee, notifyRunEnded };
