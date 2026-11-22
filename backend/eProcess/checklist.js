/** Checklist step items stored in form_schema; checked state lives in form_data[key]. */

function slugKey(label, fallback) {
  const slug = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || fallback;
}

function normalizeChecklistItem(item, stepIndex, itemIndex) {
  const label = String(item?.label || `Item ${itemIndex + 1}`).trim() || `Item ${itemIndex + 1}`;
  const fallback = `item_${stepIndex}_${itemIndex}`;
  return {
    id: item?.id ? String(item.id) : undefined,
    key: String(item?.key || '').trim() || slugKey(label, fallback),
    label,
    required: item?.required !== false,
  };
}

function isChecklistComplete(schema, formData = {}) {
  const items = Array.isArray(schema) ? schema : [];
  const missing = items.filter((item) => item.required && formData[item.key] !== true);
  return { ok: missing.length === 0, missing };
}

module.exports = {
  normalizeChecklistItem,
  isChecklistComplete,
};
