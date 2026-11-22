/** Shared E-Process form field types (Google Forms–inspired). */

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'date',
  'time',
  'checkbox',
  'checkboxes',
  'radio',
  'select',
  'multiple_choice_grid',
  'checkbox_grid',
  'rating',
  'file',
];

const FIELD_TYPE_SET = new Set(FIELD_TYPES);

function normalizeOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt, index) => {
      if (typeof opt === 'string') {
        const value = opt.trim();
        return value ? { value, label: value } : null;
      }
      const label = String(opt?.label || opt?.value || `Option ${index + 1}`).trim();
      const value = String(opt?.value || label).trim();
      if (!label || !value) return null;
      return { value, label };
    })
    .filter(Boolean)
    .slice(0, 50);
}

const GRID_TYPES = new Set(['multiple_choice_grid', 'checkbox_grid']);

function normalizeAxis(raw, prefix) {
  const items = normalizeOptions(raw).map((item, index) => ({
    value: item.value || `${prefix}_${index + 1}`,
    label: item.label,
  }));
  if (items.length) return items.slice(0, 20);
  return [
    { value: `${prefix}_1`, label: prefix === 'row' ? 'Row 1' : 'Column 1' },
    { value: `${prefix}_2`, label: prefix === 'row' ? 'Row 2' : 'Column 2' },
  ];
}

function normalizeFormField(field, index, fieldIndex) {
  const type = FIELD_TYPE_SET.has(field?.type) ? field.type : 'text';
  const isGrid = GRID_TYPES.has(type);
  const needsOptions = type === 'select' || type === 'radio' || type === 'checkboxes';
  let options = needsOptions ? normalizeOptions(field?.options) : [];
  if (needsOptions && options.length === 0) {
    options = [
      { value: 'option_1', label: 'Option 1' },
      { value: 'option_2', label: 'Option 2' },
    ];
  }
  const rows = isGrid ? normalizeAxis(field?.rows, 'row') : [];
  const columns = isGrid ? normalizeAxis(field?.columns || field?.options, 'column') : [];

  let ratingMin = 1;
  let ratingMax = 5;
  if (type === 'rating') {
    ratingMin = Number.isFinite(Number(field?.ratingMin)) ? Number(field.ratingMin) : 1;
    ratingMax = Number.isFinite(Number(field?.ratingMax)) ? Number(field.ratingMax) : 5;
    if (ratingMin < 0) ratingMin = 0;
    if (ratingMax > 10) ratingMax = 10;
    if (ratingMax <= ratingMin) ratingMax = ratingMin + 4;
  }

  return {
    id: field?.id ? String(field.id) : undefined,
    key: String(field?.key || '').trim() || `field_${index}_${fieldIndex}`,
    label: String(field?.label || 'Field').trim(),
    type,
    required: Boolean(field?.required),
    options,
    rows,
    columns,
    ratingMin,
    ratingMax,
  };
}

function isEmptyFormValue(field, value, attachments = []) {
  if (field.type === 'file') {
    return !attachments.some((a) => a.form_field_key === field.key);
  }
  if (field.type === 'checkbox') {
    // Required checkbox means it must be ticked (Google Forms style).
    return value !== true;
  }
  if (field.type === 'checkboxes') {
    return !Array.isArray(value) || value.length === 0;
  }
  if (field.type === 'multiple_choice_grid') {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return (field.rows || []).some((row) => !data[row.value]);
  }
  if (field.type === 'checkbox_grid') {
    const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return (field.rows || []).some((row) => !Array.isArray(data[row.value]) || data[row.value].length === 0);
  }
  if (field.type === 'rating' || field.type === 'number') {
    return value === undefined || value === null || value === '';
  }
  return value === undefined || value === null || String(value).trim() === '';
}

module.exports = {
  FIELD_TYPES,
  FIELD_TYPE_SET,
  normalizeFormField,
  isEmptyFormValue,
};
