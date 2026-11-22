/** Acknowledgement step: assignee must choose Acknowledge or Decline in form_data.decision. */

const DECISIONS = [
  { value: 'acknowledge', label: 'Acknowledge' },
  { value: 'decline', label: 'Decline' },
];

const DECISION_VALUES = new Set(DECISIONS.map((d) => d.value));

function validateAcknowledgementData(formData = {}) {
  const decision = String(formData.decision || '').trim().toLowerCase();
  if (!DECISION_VALUES.has(decision)) {
    return { ok: false, message: 'Select Acknowledge or Decline.' };
  }
  return { ok: true, data: { decision } };
}

function acknowledgementDecisionFromAction(action) {
  if (action === 'acknowledge') return 'acknowledge';
  if (action === 'decline') return 'decline';
  return null;
}

module.exports = {
  DECISIONS,
  DECISION_VALUES,
  validateAcknowledgementData,
  acknowledgementDecisionFromAction,
};
