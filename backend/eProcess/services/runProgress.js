const { randomUUID } = require('crypto');
const { shouldRunStep } = require('../utils/condition');

async function collectValues(runId, trx) {
  const tasks = await trx('task_runs').where({ run_id: runId }).select('form_data');
  return tasks.reduce((acc, task) => ({ ...acc, ...(task.form_data || {}) }), {});
}

async function advanceRun(runId, trx) {
  const rows = await trx('task_runs as tr')
    .where('tr.run_id', runId)
    .orderBy('tr.position', 'asc')
    .select('tr.id as task_id', 'tr.status as task_status', 'tr.position', 'tr.condition');

  const values = await collectValues(runId, trx);
  const terminal = new Set(['completed', 'rejected', 'skipped']);

  for (const row of rows) {
    if (terminal.has(row.task_status)) continue;

    if (!shouldRunStep(row.condition, values)) {
      await trx('task_runs').where({ id: row.task_id }).update({
        status: 'skipped',
        completed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
      continue;
    }

    if (row.task_status === 'blocked') {
      await trx('task_runs').where({ id: row.task_id }).update({
        status: 'pending',
        updated_at: trx.fn.now(),
      });
      return row.task_id;
    }
    return null;
  }

  const unfinished = await trx('task_runs')
    .where({ run_id: runId })
    .whereNotIn('status', ['completed', 'rejected', 'skipped'])
    .first();

  if (!unfinished) {
    await trx('workflow_runs').where({ id: runId }).update({
      status: 'completed',
      completed_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
  }
}

const TERMINAL = new Set(['completed', 'rejected', 'skipped']);

async function returnRunToTask(runId, targetTaskId, trx, { reason, returnedBy } = {}) {
  const rows = await trx('task_runs')
    .where({ run_id: runId })
    .orderBy('position', 'asc')
    .select('id', 'status', 'position');

  const current = rows.find((row) => row.status === 'pending' || row.status === 'in_progress');
  const target = rows.find((row) => row.id === targetTaskId);
  if (!current) {
    const error = new Error('This run has no open stage to return from.');
    error.status = 400;
    throw error;
  }
  if (!target || Number(target.position) >= Number(current.position) || !TERMINAL.has(target.status)) {
    const error = new Error('Choose an earlier completed stage.');
    error.status = 400;
    throw error;
  }

  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const error = new Error('A reason is required to return to a previous stage.');
    error.status = 400;
    throw error;
  }
  if (trimmedReason.length > 5000) {
    const error = new Error('Reason must be 5000 characters or fewer.');
    error.status = 400;
    throw error;
  }

  await trx('e_process_stage_returns').insert({
    id: randomUUID(),
    run_id: runId,
    from_task_id: current.id,
    to_task_id: target.id,
    reason: trimmedReason,
    returned_by: returnedBy || null,
  });

  for (const row of rows) {
    if (row.position < target.position) continue;
    await trx('task_runs').where({ id: row.id }).update({
      status: 'blocked',
      completed_by: null,
      completed_at: null,
      updated_at: trx.fn.now(),
    });
  }

  await trx('workflow_runs').where({ id: runId }).update({
    status: 'active',
    completed_at: null,
    updated_at: trx.fn.now(),
  });

  const openedId = await advanceRun(runId, trx);
  if (openedId) return openedId;
  const open = await trx('task_runs')
    .where({ run_id: runId })
    .whereIn('status', ['pending', 'in_progress'])
    .orderBy('position', 'asc')
    .first('id');
  return open?.id || target.id;
}

module.exports = { advanceRun, returnRunToTask };
