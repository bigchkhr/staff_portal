import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from '../icons';
import GroupMemberPicker from './GroupMemberPicker';
import { api } from '../api';
import { randomUUID } from '../utils/id';
import { personWithEmployeeNumber } from '../utils/datetime';
import { ep, useEp } from '../useEp';

const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'date', 'time', 'select', 'radio', 'checkboxes', 'checkbox', 'multiple_choice_grid', 'checkbox_grid', 'rating', 'file'];

const needsOptions = (type) => type === 'select' || type === 'radio' || type === 'checkboxes';
const isGrid = (type) => type === 'multiple_choice_grid' || type === 'checkbox_grid';

const defaultAxis = (prefix) => ([
  { value: `${prefix}_1`, label: ep(prefix === 'row' ? 'step.row' : 'step.column', { n: 1 }) },
  { value: `${prefix}_2`, label: ep(prefix === 'row' ? 'step.row' : 'step.column', { n: 2 }) },
]);
const DELETABLE_STEP_TYPES = new Set(['task', 'approval', 'acknowledgement', 'communication']);

const emptyField = () => ({
  id: randomUUID(),
  key: `field_${Date.now()}`,
  label: ep('step.untitledQuestion'),
  type: 'text',
  required: false,
  options: [],
  ratingMin: 1,
  ratingMax: 5,
});

const defaultOptions = () => ([
  { value: 'option_1', label: ep('step.option', { n: 1 }) },
  { value: 'option_2', label: ep('step.option', { n: 2 }) },
]);

function assigneeSummary(step, t) {
  const mode = step.assignee_mode || 'unassigned';
  if (mode === 'unassigned') return t('step.summaryUnassigned');
  if (mode === 'group' || mode === 'work_group') {
    if (mode === 'work_group') return t('step.summaryWorkGroup', { name: step.assignee_group_name || t('step.workGroupMembers') });
    if (!step.assignee_group_id) return t('step.summaryPickGroup');
    return t('step.summaryGroup', { name: step.assignee_group_name || step.assignee_group_id });
  }
  if (mode !== 'user') return t('step.summaryStarter');
  if (!step.assignee_user_id) return t('step.summaryPick');
  const who = personWithEmployeeNumber(step.assignee_user_name, step.assignee_user_username);
  const text = t('step.summaryUser', { who });
  return step.assignee_user_email ? `${text} · ${step.assignee_user_email}` : text;
}

function clearPerson(step) {
  return {
    ...step,
    assignee_user_id: null,
    assignee_user_name: null,
    assignee_user_username: null,
    assignee_user_email: null,
  };
}

export default function StepEditor({ step, index, total, onChange, onRemove, onMove, readOnly = false, groupId, groupName }) {
  const t = useEp();
  const assigneeMode = step.assignee_mode || 'unassigned';
  const [assignableGroups, setAssignableGroups] = useState([]);

  useEffect(() => {
    if (!groupId || readOnly) {
      setAssignableGroups([]);
      return undefined;
    }
    let cancelled = false;
    api.get('/users/assignable-groups', { params: { owner_group_id: groupId } })
      .then(({ data }) => {
        if (!cancelled) setAssignableGroups(data.groups || []);
      })
      .catch(() => {
        if (!cancelled) setAssignableGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, readOnly]);

  const update = (patch) => {
    if (readOnly) return;
    onChange(index, { ...step, ...patch });
  };

  function updateField(fieldIndex, patch) {
    const fields = [...(step.form_schema || [])];
    const current = fields[fieldIndex] || {};
    let next = { ...current, ...patch };
    if (patch.type && needsOptions(patch.type) && !(next.options || []).length) {
      next = { ...next, options: defaultOptions() };
    }
    if (patch.type === 'rating') {
      next = {
        ...next,
        ratingMin: next.ratingMin ?? 1,
        ratingMax: next.ratingMax ?? 5,
      };
    }
    if (patch.type && isGrid(patch.type)) {
      next = {
        ...next,
        rows: (next.rows || []).length ? next.rows : defaultAxis('row'),
        columns: (next.columns || []).length ? next.columns : defaultAxis('column'),
      };
    }
    fields[fieldIndex] = next;
    update({ form_schema: fields });
  }

  function removeField(fieldIndex) {
    update({ form_schema: step.form_schema.filter((_, i) => i !== fieldIndex) });
  }

  function moveField(fieldIndex, direction) {
    const fields = [...(step.form_schema || [])];
    const target = fieldIndex + direction;
    if (target < 0 || target >= fields.length) return;
    const [item] = fields.splice(fieldIndex, 1);
    fields.splice(target, 0, item);
    update({ form_schema: fields });
  }

  function syncFieldKeyFromLabel(fieldIndex) {
    const field = (step.form_schema || [])[fieldIndex];
    if (!field) return;
    const nextKey =
      String(field.label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '') || field.key;
    if (nextKey !== field.key) updateField(fieldIndex, { key: nextKey });
  }

  function updateOption(fieldIndex, optionIndex, label) {
    const field = (step.form_schema || [])[fieldIndex];
    const options = [...(field.options || [])];
    options[optionIndex] = {
      value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `option_${optionIndex + 1}`,
      label,
    };
    updateField(fieldIndex, { options });
  }

  function updateAxis(fieldIndex, axis, itemIndex, label) {
    const field = (step.form_schema || [])[fieldIndex];
    const items = [...(field[axis] || [])];
    items[itemIndex] = {
      value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `${axis}_${itemIndex + 1}`,
      label,
    };
    updateField(fieldIndex, { [axis]: items });
  }

  function addAxisItem(fieldIndex, axis) {
    const field = (step.form_schema || [])[fieldIndex];
    const items = [...(field[axis] || [])];
    const n = items.length + 1;
    const prefix = axis === 'rows' ? 'row' : 'column';
    items.push({ value: `${prefix}_${n}`, label: t(prefix === 'row' ? 'step.row' : 'step.column', { n }) });
    updateField(fieldIndex, { [axis]: items });
  }

  function removeAxisItem(fieldIndex, axis) {
    return (itemIndex) => {
      const field = (step.form_schema || [])[fieldIndex];
      const items = (field[axis] || []).filter((_, i) => i !== itemIndex);
      updateField(fieldIndex, { [axis]: items.length ? items : defaultAxis(axis === 'rows' ? 'row' : 'column') });
    };
  }

  function addOption(fieldIndex) {
    const field = (step.form_schema || [])[fieldIndex];
    const options = [...(field.options || [])];
    const n = options.length + 1;
    options.push({ value: `option_${n}`, label: t('step.option', { n }) });
    updateField(fieldIndex, { options });
  }

  function removeOption(fieldIndex, optionIndex) {
    const field = (step.form_schema || [])[fieldIndex];
    const options = (field.options || []).filter((_, i) => i !== optionIndex);
    updateField(fieldIndex, { options: options.length ? options : defaultOptions() });
  }

  function setAssigneeMode(mode) {
    if (mode === 'user') {
      update({
        ...clearPerson(step),
        assignee_mode: 'user',
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_group_name: null,
        assignee_user_id: step.assignee_user_id,
        assignee_user_name: step.assignee_user_name,
        assignee_user_username: step.assignee_user_username,
        assignee_user_email: step.assignee_user_email,
      });
      return;
    }
    if (mode === 'group') {
      if (assigneeMode === 'group' || assigneeMode === 'work_group') return;
      update({
        ...clearPerson(step),
        assignee_mode: 'group',
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_group_name: null,
      });
      return;
    }
    update({
      ...clearPerson(step),
      assignee_mode: mode === 'run_starter' ? 'run_starter' : 'unassigned',
      assignee_group_id: null,
      assignee_delegation_group_id: null,
      assignee_group_name: null,
    });
  }

  function selectGroupTarget(value) {
    if (!value) {
      update({
        ...clearPerson(step),
        assignee_mode: 'group',
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_group_name: null,
      });
      return;
    }
    if (value === 'work_group') {
      const work = assignableGroups.find((group) => group.id === 'work_members');
      update({
        ...clearPerson(step),
        assignee_mode: 'work_group',
        assignee_group_id: null,
        assignee_delegation_group_id: null,
        assignee_group_name: work?.name || groupName || null,
      });
      return;
    }
    const [kind, rawId] = String(value).split(':');
    const group = assignableGroups.find((item) => item.kind === kind && String(item.id) === String(rawId));
    update({
      ...clearPerson(step),
      assignee_mode: 'group',
      assignee_group_id: kind === 'department' ? Number(rawId) : null,
      assignee_delegation_group_id: kind === 'delegation' ? Number(rawId) : null,
      assignee_group_name: group?.name || null,
    });
  }

  function selectAssignee(user) {
    update({
      assignee_mode: 'user',
      assignee_user_id: user.id,
      assignee_user_name: user.display_name || null,
      assignee_user_username: user.username || null,
      assignee_user_email: user.email || null,
    });
  }

  return (
    <article className="step-card">
      <div className="step-head">
        <GripVertical size={18} className="muted" />
        <span className="step-number">{index + 1}</span>
        <input className="step-title-input" value={step.title} onChange={(e) => update({ title: e.target.value })} readOnly={readOnly} />
        <select
          value={step.type}
          disabled={readOnly}
          onChange={(e) => {
            const nextType = e.target.value;
            let form_schema = [];
            let allow_delete = step.allow_delete === true;
            if (nextType === 'form') {
              form_schema = step.type === 'form' ? (step.form_schema || []) : [];
              allow_delete = false;
            } else if (nextType === 'checklist') {
              form_schema =
                step.type === 'checklist' && (step.form_schema || []).length
                  ? step.form_schema
                  : [{ id: randomUUID(), key: `item_${Date.now()}`, label: t('step.newChecklistItem'), required: true }];
              allow_delete = false;
            } else {
              form_schema = [];
              if (!DELETABLE_STEP_TYPES.has(nextType)) allow_delete = false;
            }
            update({ type: nextType, form_schema, allow_delete });
          }}
        >
          {['task', 'form', 'checklist', 'approval', 'acknowledgement', 'communication'].map((type) => (
            <option key={type} value={type}>{t(`types.${type}`)}</option>
          ))}
        </select>
        {!readOnly && (
          <>
            <button className="icon-button" disabled={index === 0} onClick={() => onMove(index, -1)}><ChevronUp size={17} /></button>
            <button className="icon-button" disabled={index === total - 1} onClick={() => onMove(index, 1)}><ChevronDown size={17} /></button>
            <button className="icon-button danger" onClick={() => onRemove(index)}><Trash2 size={17} /></button>
          </>
        )}
      </div>
      <textarea
        placeholder={t('step.instructions')}
        value={step.description}
        onChange={(e) => update({ description: e.target.value })}
        readOnly={readOnly}
      />
      {step.type === 'approval' && (
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('step.approvalHint')}
        </p>
      )}
      {step.type === 'acknowledgement' && (
        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('step.ackHint')}
        </p>
      )}

      <label className="checkbox" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={step.allow_skip === true}
          disabled={readOnly}
          onChange={(e) => update({ allow_skip: e.target.checked })}
        />
        {t('step.allowSkip')}
      </label>
      <label className="checkbox" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={step.allow_review !== false}
          disabled={readOnly}
          onChange={(e) => update({ allow_review: e.target.checked })}
        />
        {t('step.allowReview')}
      </label>
      {step.allow_review === false && (
        <p className="muted" style={{ marginTop: 6, marginBottom: 0 }}>
          {t('step.reviewHidden')}
        </p>
      )}

      {DELETABLE_STEP_TYPES.has(step.type) && (
        <label className="checkbox" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={step.allow_delete === true}
            disabled={readOnly}
            onChange={(e) => update({ allow_delete: e.target.checked })}
          />
          {t('step.allowDelete')}
        </label>
      )}

      <div className="assignee-builder">
        <div className="section-label">{t('step.defaultAssignee')}</div>
        <div className="assignee-mode-row">
          <select
            value={assigneeMode === 'work_group' ? 'group' : assigneeMode}
            disabled={readOnly}
            onChange={(e) => setAssigneeMode(e.target.value)}
          >
            <option value="unassigned">{t('step.unassigned')}</option>
            <option value="run_starter">{t('step.runStarter')}</option>
            <option value="group">{t('step.specificGroup')}</option>
            <option value="user">{t('step.specificPerson')}</option>
          </select>
        </div>
        {(assigneeMode === 'group' || assigneeMode === 'work_group') && !readOnly && (
          <label>
            {t('step.specificGroup')}
            <select
              value={assigneeMode === 'work_group'
                ? 'work_group'
                : (step.assignee_delegation_group_id
                  ? `delegation:${step.assignee_delegation_group_id}`
                  : (step.assignee_group_id ? `department:${step.assignee_group_id}` : ''))}
              onChange={(e) => selectGroupTarget(e.target.value)}
            >
              <option value="">{t('step.summaryPickGroup')}</option>
              <option value="work_group">{groupName || t('step.workGroupMembers')}</option>
              <optgroup label={t('workgroup.assignableDepartments')}>
                {assignableGroups.filter((group) => group.kind === 'department').map((group) => (
                  <option key={`department-${group.id}`} value={`department:${group.id}`}>{group.name}</option>
                ))}
              </optgroup>
              <optgroup label={t('workgroup.assignableDelegations')}>
                {assignableGroups.filter((group) => group.kind === 'delegation').map((group) => (
                  <option key={`delegation-${group.id}`} value={`delegation:${group.id}`}>{group.name}</option>
                ))}
              </optgroup>
            </select>
          </label>
        )}
        {assigneeMode === 'user' && !readOnly && (
          <GroupMemberPicker ownerGroupId={groupId} actionLabel={t('picker.select')} onSelect={selectAssignee} />
        )}
        <p className="muted assignee-summary">{assigneeSummary(step, t)}</p>
      </div>

      <div className="condition-builder">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(step.condition)}
            disabled={readOnly}
            onChange={(e) => update({ condition: e.target.checked ? { stepKey: '', operator: 'eq', value: '' } : null })}
          />
          {t('step.condition')}
        </label>
        {step.condition && (
          <div className="condition-row">
            <input
              placeholder={t('step.fieldKey')}
              value={step.condition.stepKey}
              readOnly={readOnly}
              onChange={(e) => update({ condition: { ...step.condition, stepKey: e.target.value } })}
            />
            <select
              value={step.condition.operator}
              disabled={readOnly}
              onChange={(e) => update({ condition: { ...step.condition, operator: e.target.value } })}
            >
              {['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'].map((op) => (
                <option key={op} value={op}>{t(`operators.${op}`)}</option>
              ))}
            </select>
            <input
              placeholder={t('step.expected')}
              value={step.condition.value}
              readOnly={readOnly}
              onChange={(e) => update({ condition: { ...step.condition, value: e.target.value } })}
            />
          </div>
        )}
      </div>

      {step.type === 'form' && (
        <div className="field-builder">
          <div className="section-label">{t('step.questions')}</div>
          {(step.form_schema || []).map((field, fieldIndex) => (
            <div className="field-block" key={field.id || `field-${fieldIndex}`}>
              <div className="field-row field-row-main">
                <input
                  value={field.label}
                  readOnly={readOnly}
                  onChange={(e) => updateField(fieldIndex, { label: e.target.value })}
                  onBlur={() => syncFieldKeyFromLabel(fieldIndex)}
                  placeholder={t('step.question')}
                />
                <select
                  value={field.type}
                  disabled={readOnly}
                  onChange={(e) => updateField(fieldIndex, { type: e.target.value })}
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`fieldTypes.${type}`)}</option>
                  ))}
                </select>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={field.required}
                    disabled={readOnly}
                    onChange={(e) => updateField(fieldIndex, { required: e.target.checked })}
                  /> {t('common.required')}
                </label>
                {!readOnly && (
                  <div className="field-actions">
                    <button
                      type="button"
                      className="icon-button"
                      disabled={fieldIndex === 0}
                      title={t('step.moveQuestionUp')}
                      onClick={() => moveField(fieldIndex, -1)}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={fieldIndex === (step.form_schema || []).length - 1}
                      title={t('step.moveQuestionDown')}
                      onClick={() => moveField(fieldIndex, 1)}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      title={t('step.removeQuestion')}
                      onClick={() => removeField(fieldIndex)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>

              {needsOptions(field.type) && (
                <div className="field-options">
                  {(field.options || []).map((opt, optionIndex) => (
                    <div className="option-row" key={`${field.id}-opt-${optionIndex}`}>
                      <span className="muted">{field.type === 'select' ? '▾' : field.type === 'radio' ? '○' : '☐'}</span>
                      <input
                        value={opt.label}
                        readOnly={readOnly}
                        onChange={(e) => updateOption(fieldIndex, optionIndex, e.target.value)}
                        placeholder={t('step.option', { n: optionIndex + 1 })}
                      />
                      {!readOnly && (
                        <button className="icon-button danger" onClick={() => removeOption(fieldIndex, optionIndex)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <button type="button" className="button button-light small" onClick={() => addOption(fieldIndex)}>
                      <Plus size={14} /> {t('step.addOption')}
                    </button>
                  )}
                </div>
              )}

              {isGrid(field.type) && (
                <div className="grid-editor">
                  {['rows', 'columns'].map((axis) => (
                    <div key={axis}>
                      <div className="section-label">{axis === 'rows' ? t('step.rows') : t('step.columns')}</div>
                      {(field[axis] || []).map((item, itemIndex) => (
                        <div className="option-row" key={`${field.id}-${axis}-${itemIndex}`}>
                          <span className="muted">{itemIndex + 1}</span>
                          <input
                            value={item.label}
                            readOnly={readOnly}
                            onChange={(e) => updateAxis(fieldIndex, axis, itemIndex, e.target.value)}
                            placeholder={t(axis === 'rows' ? 'step.row' : 'step.column', { n: itemIndex + 1 })}
                          />
                          {!readOnly && (
                            <button className="icon-button danger" onClick={() => removeAxisItem(fieldIndex, axis)(itemIndex)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      {!readOnly && (
                        <button type="button" className="button button-light small" onClick={() => addAxisItem(fieldIndex, axis)}>
                          <Plus size={14} /> {axis === 'rows' ? t('step.addRow') : t('step.addColumn')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {field.type === 'rating' && (
                <div className="rating-config">
                  <label>
                    {t('step.from')}
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={field.ratingMin ?? 1}
                      disabled={readOnly}
                      onChange={(e) => updateField(fieldIndex, { ratingMin: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    {t('step.to')}
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={field.ratingMax ?? 5}
                      disabled={readOnly}
                      onChange={(e) => updateField(fieldIndex, { ratingMax: Number(e.target.value) })}
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
          {!readOnly && (
            <button className="button button-light small" onClick={() => update({ form_schema: [...(step.form_schema || []), emptyField()] })}>
              <Plus size={15} /> {t('step.addQuestion')}
            </button>
          )}
        </div>
      )}

      {step.type === 'checklist' && (
        <div className="field-builder">
          <div className="section-label">{t('step.checklist')}</div>
          {(step.form_schema || []).map((item, itemIndex) => (
            <div className="field-block" key={item.id || `item-${itemIndex}`}>
              <div className="field-row field-row-main checklist-item-row">
                <input
                  value={item.label}
                  readOnly={readOnly}
                  onChange={(e) => updateField(itemIndex, { label: e.target.value })}
                  onBlur={() => syncFieldKeyFromLabel(itemIndex)}
                  placeholder={t('step.checklistItem')}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={item.required !== false}
                    disabled={readOnly}
                    onChange={(e) => updateField(itemIndex, { required: e.target.checked })}
                  /> {t('common.required')}
                </label>
                {!readOnly && (
                  <div className="field-actions">
                    <button
                      type="button"
                      className="icon-button"
                      disabled={itemIndex === 0}
                      title={t('step.moveItemUp')}
                      onClick={() => moveField(itemIndex, -1)}
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={itemIndex === (step.form_schema || []).length - 1}
                      title={t('step.moveItemDown')}
                      onClick={() => moveField(itemIndex, 1)}
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger"
                      title={t('step.removeItem')}
                      onClick={() => removeField(itemIndex)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!readOnly && (
            <button
              className="button button-light small"
              onClick={() => update({
                form_schema: [
                  ...(step.form_schema || []),
                  {
                    id: randomUUID(),
                    key: `item_${Date.now()}`,
                    label: t('step.newChecklistItem'),
                    required: true,
                  },
                ],
              })}
            >
              <Plus size={15} /> {t('step.addItem')}
            </button>
          )}
        </div>
      )}

      {step.type === 'communication' && (
        <div className="field-builder">
          <div className="section-label">{t('step.communication')}</div>
          <p className="muted" style={{ margin: 0 }}>
            {t('step.communicationHint')}
          </p>
        </div>
      )}
    </article>
  );
}
