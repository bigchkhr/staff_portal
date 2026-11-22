/** Approval step: assignee must choose Approval or Reject in form_data.decision. */

const DECISIONS = [
  { value: 'approval', label: 'Approval' },
  { value: 'reject', label: 'Reject' },
];

const DECISION_VALUES = new Set(DECISIONS.map((d) => d.value));

function validateApprovalData(formData = {}) {
  const decision = String(formData.decision || '').trim().toLowerCase();
  if (!DECISION_VALUES.has(decision)) {
    return { ok: false, message: 'Select Approval or Reject.' };
  }
  return { ok: true, data: { decision } };
}

function approvalDecisionFromAction(action) {
  if (action === 'approve') return 'approval';
  if (action === 'reject') return 'reject';
  return null;
}

module.exports = {
  DECISIONS,
  DECISION_VALUES,
  validateApprovalData,
  approvalDecisionFromAction,
};
