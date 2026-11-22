import { ep } from '../useEp';

export const COMMUNICATION_STATUSES = [
  { value: 'contact_successful' },
  { value: 'contact_unsuccessful' },
];

export const COMMUNICATION_DIRECTIONS = [
  { value: 'inbound' },
  { value: 'outbound' },
];

export const COMMUNICATION_CONTACT_METHODS = [
  { value: 'mail' },
  { value: 'email' },
  { value: 'telephone' },
  { value: 'instant_message' },
  { value: 'sms' },
  { value: 'face_to_face' },
  { value: 'voicemail' },
  { value: 'website_contact_form' },
  { value: 'ticketing_system' },
  { value: 'video_conferencing' },
  { value: 'social_media_platform' },
];

function label(value) {
  if (!value) return '—';
  return ep(`communication.${value}`, { defaultValue: value });
}

export function communicationStatusLabel(value) {
  return label(value);
}

export function communicationMethodLabel(value) {
  return label(value);
}

export function communicationDirectionLabel(value) {
  return label(value);
}
