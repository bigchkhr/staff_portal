import { ep } from '../useEp';

export const ACKNOWLEDGEMENT_DECISIONS = [
  { value: 'acknowledge' },
  { value: 'decline' },
];

export function acknowledgementDecisionLabel(value) {
  if (!value) return '—';
  return ep(`ack.${value}`, { defaultValue: value });
}
