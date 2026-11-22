/** Communication step: fixed fields stored in form_data at run time. */

const STATUSES = [
  { value: 'contact_successful', label: 'Contact Successful' },
  { value: 'contact_unsuccessful', label: 'Contact Unsuccessful' },
];

const DIRECTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

const CONTACT_METHODS = [
  { value: 'mail', label: 'Mail' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Telephone' },
  { value: 'instant_message', label: 'Instant Message' },
  { value: 'sms', label: 'SMS' },
  { value: 'face_to_face', label: 'Face-to-Face' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'website_contact_form', label: 'Website Contact Form' },
  { value: 'ticketing_system', label: 'Ticketing System' },
  { value: 'video_conferencing', label: 'Video Conferencing' },
  { value: 'social_media_platform', label: 'Social Media Platform' },
];

const STATUS_VALUES = new Set(STATUSES.map((s) => s.value));
const DIRECTION_VALUES = new Set(DIRECTIONS.map((d) => d.value));
const CONTACT_METHOD_VALUES = new Set(CONTACT_METHODS.map((m) => m.value));

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function validateCommunicationData(formData = {}) {
  const status = String(formData.status || '').trim().toLowerCase();
  if (!STATUS_VALUES.has(status)) {
    return { ok: false, message: 'Status must be Contact Successful or Contact Unsuccessful.' };
  }

  const direction = String(formData.direction || '').trim().toLowerCase();
  if (!DIRECTION_VALUES.has(direction)) {
    return { ok: false, message: 'Direction must be Inbound or Outbound.' };
  }

  const contact_method = String(formData.contact_method || '').trim().toLowerCase();
  if (!CONTACT_METHOD_VALUES.has(contact_method)) {
    return { ok: false, message: 'Contact method is required.' };
  }

  const contact_date = String(formData.contact_date || '').trim();
  if (!contact_date) {
    return { ok: false, message: 'Contact date is required.' };
  }
  if (!isDateOnly(contact_date)) {
    return { ok: false, message: 'Contact date must be YYYY-MM-DD.' };
  }

  const next_review_date =
    formData.next_review_date == null || formData.next_review_date === ''
      ? null
      : String(formData.next_review_date).trim();
  if (next_review_date && !isDateOnly(next_review_date)) {
    return { ok: false, message: 'Next review date must be YYYY-MM-DD.' };
  }

  return {
    ok: true,
    data: {
      status,
      direction,
      contact_method,
      contact_date,
      next_review_date,
    },
  };
}

module.exports = {
  STATUSES,
  DIRECTIONS,
  CONTACT_METHODS,
  STATUS_VALUES,
  DIRECTION_VALUES,
  CONTACT_METHOD_VALUES,
  validateCommunicationData,
};
