import { canPreviewAttachment } from './AttachmentPreviewModal';
import { useEp } from '../useEp';

function toggleMulti(values, key, optionValue, checked) {
  const current = Array.isArray(values[key]) ? values[key] : [];
  const next = checked
    ? [...new Set([...current, optionValue])]
    : current.filter((v) => v !== optionValue);
  return { ...values, [key]: next };
}

function gridValue(values, key) {
  const current = values[key];
  return current && typeof current === 'object' && !Array.isArray(current) ? current : {};
}

function GridField({ field, values, setValues, disabled }) {
  const data = gridValue(values, field.key);
  const columns = field.columns || [];
  const rows = field.rows || [];
  const multiple = field.type === 'checkbox_grid';

  function setCell(rowValue, columnValue, checked) {
    const next = { ...data };
    if (multiple) {
      const selected = Array.isArray(next[rowValue]) ? next[rowValue] : [];
      next[rowValue] = checked
        ? [...new Set([...selected, columnValue])]
        : selected.filter((value) => value !== columnValue);
    } else {
      next[rowValue] = columnValue;
    }
    setValues({ ...values, [field.key]: next });
  }

  return (
    <div className="choice-grid-wrap">
      <table className="choice-grid">
        <thead>
          <tr>
            <th />
            {columns.map((column) => (
              <th key={column.value}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.value}>
              <th scope="row">{row.label}</th>
              {columns.map((column) => {
                const selected = multiple
                  ? (Array.isArray(data[row.value]) ? data[row.value] : []).includes(column.value)
                  : data[row.value] === column.value;
                return (
                  <td key={column.value}>
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      name={multiple ? undefined : `${field.key}-${row.value}`}
                      disabled={disabled}
                      checked={selected}
                      onChange={(e) => setCell(row.value, column.value, multiple ? e.target.checked : true)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ratingRange(field) {
  const min = Number.isFinite(Number(field.ratingMin)) ? Number(field.ratingMin) : 1;
  const max = Number.isFinite(Number(field.ratingMax)) ? Number(field.ratingMax) : 5;
  const start = Math.min(min, max);
  const end = Math.max(min, max);
  const values = [];
  for (let i = start; i <= end; i += 1) values.push(i);
  return values;
}

export default function FormFields({
  schema,
  values,
  setValues,
  disabled,
  onUploadFile,
  onDownloadFile,
  onPreviewFile,
  onRemoveFile,
  attachments,
}) {
  const t = useEp();
  return (schema || []).map((field) => (
    <div key={field.id || field.key} className="form-field">
      <span className="form-field-label">
        {field.label}{field.required ? ' *' : ''}
      </span>

      {field.type === 'textarea' ? (
        <textarea
          className="form-textarea"
          disabled={disabled}
          rows={6}
          value={values[field.key] || ''}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
        />
      ) : field.type === 'checkbox' ? (
        <span className="checkbox">
          <input
            disabled={disabled}
            type="checkbox"
            checked={Boolean(values[field.key])}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.checked })}
          />
          {t('common.yes')}
        </span>
      ) : field.type === 'select' ? (
        <select
          disabled={disabled}
          value={values[field.key] || ''}
          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
        >
          <option value="">{t('form.selectOption')}</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : field.type === 'radio' ? (
        <div className="choice-list">
          {(field.options || []).map((opt) => (
            <label key={opt.value} className="choice-item">
              <input
                type="radio"
                disabled={disabled}
                name={field.key}
                checked={values[field.key] === opt.value}
                onChange={() => setValues({ ...values, [field.key]: opt.value })}
              />
              {opt.label}
            </label>
          ))}
        </div>
      ) : field.type === 'checkboxes' ? (
        <div className="choice-list">
          {(field.options || []).map((opt) => {
            const selected = Array.isArray(values[field.key]) ? values[field.key] : [];
            return (
              <label key={opt.value} className="choice-item">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.includes(opt.value)}
                  onChange={(e) => setValues(toggleMulti(values, field.key, opt.value, e.target.checked))}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      ) : field.type === 'multiple_choice_grid' || field.type === 'checkbox_grid' ? (
        <GridField field={field} values={values} setValues={setValues} disabled={disabled} />
      ) : field.type === 'rating' ? (
        <div className="rating-scale" role="radiogroup" aria-label={field.label}>
          {ratingRange(field).map((n) => (
            <button
              key={n}
              type="button"
              className={`rating-pip ${Number(values[field.key]) === n ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => setValues({ ...values, [field.key]: n })}
            >
              {n}
            </button>
          ))}
        </div>
      ) : field.type === 'file' ? (
        <div className="file-field">
          {!disabled && (
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFile(file, field.key);
                e.target.value = '';
              }}
            />
          )}
          {(attachments || [])
            .filter((a) => a.form_field_key === field.key)
            .map((a) => (
              <div key={a.id} className="file-chip-row">
                <button
                  type="button"
                  className="file-chip"
                  onClick={() =>
                    canPreviewAttachment(a) && onPreviewFile
                      ? onPreviewFile(a, (attachments || []).filter((item) => item.form_field_key === field.key))
                      : onDownloadFile?.(a.id)
                  }
                  title={canPreviewAttachment(a) ? t('form.preview') : t('form.download')}
                >
                  {a.file_name}
                </button>
                {canPreviewAttachment(a) && onPreviewFile ? (
                  <button
                    type="button"
                    className="button button-light small"
                    onClick={() => onPreviewFile(a, (attachments || []).filter((item) => item.form_field_key === field.key))}
                  >
                    {t('form.preview')}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button button-light small"
                  onClick={() => onDownloadFile?.(a.id)}
                >
                  {t('form.download')}
                </button>
                {!disabled && onRemoveFile && (
                  <button
                    type="button"
                    className="icon-button danger"
                    title={t('form.removeFile')}
                    onClick={() => onRemoveFile(a.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          {!(attachments || []).some((a) => a.form_field_key === field.key) && (
            <span className="muted">{disabled ? t('form.noFileUploaded') : t('form.noFileYet')}</span>
          )}
        </div>
      ) : (
        <input
          disabled={disabled}
          type={field.type === 'email' ? 'email' : field.type === 'time' ? 'time' : field.type}
          value={values[field.key] ?? ''}
          onChange={(e) => {
            const raw = e.target.value;
            setValues({
              ...values,
              [field.key]: field.type === 'number' ? (raw === '' ? '' : Number(raw)) : raw,
            });
          }}
        />
      )}
    </div>
  ));
}
