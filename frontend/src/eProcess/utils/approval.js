import { ep } from '../useEp';

export const APPROVAL_DECISIONS = [
  { value: 'approval' },
  { value: 'reject' },
];

export function approvalDecisionLabel(value) {
  if (!value) return '—';
  return ep(`approval.${value}`, { defaultValue: value });
}
