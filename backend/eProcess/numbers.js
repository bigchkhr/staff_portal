/** Allocate human-readable E-Process workflow / run numbers from PG sequences. */

function padNumber(n, width = 5) {
  return String(n).padStart(width, '0');
}

async function nextSeqValue(trx, sequenceName) {
  // Sequence names are fixed constants — not user input.
  const result = await trx.raw(`SELECT nextval('${sequenceName}') AS n`);
  const row = result.rows?.[0] || result[0];
  return Number(row.n);
}

async function allocateWorkflowNumber(trx) {
  const n = await nextSeqValue(trx, 'e_process_workflow_number_seq');
  return `WF-${padNumber(n)}`;
}

async function allocateRunNumber(trx) {
  const n = await nextSeqValue(trx, 'e_process_run_number_seq');
  return `RUN-${padNumber(n)}`;
}

module.exports = {
  allocateWorkflowNumber,
  allocateRunNumber,
};
