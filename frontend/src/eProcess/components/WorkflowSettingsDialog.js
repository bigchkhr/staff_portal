import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from '../icons';
import { api } from '../api';
import RelatedPeopleFields from './RelatedPeopleFields';

export default function WorkflowSettingsDialog({
  workflow,
  onClose,
  onSaved,
  busy = false,
}) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [delegationGroups, setDelegationGroups] = useState([]);
  const [groupId, setGroupId] = useState(workflow.group_id || '');
  const [audience, setAudience] = useState(workflow.audience === 'everyone' ? 'everyone' : 'user_groups');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState(
    (workflow.audience_groups || []).filter((group) => group.kind !== 'delegation').map((group) => group.id)
  );
  const [selectedDelegationIds, setSelectedDelegationIds] = useState(workflow.audience_delegation_group_ids || []);
  const [relatedPeople, setRelatedPeople] = useState(workflow.related_people || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canAssignAudience = workflow.canAssignAudience !== false;

  useEffect(() => {
    api
      .get('/groups')
      .then(({ data }) => {
        const workGroups = (data.groups || []).filter((g) => g.kind !== 'user');
        setGroups(workGroups);
        const assignable = data.assignableUserGroups || [];
        const fallback = (data.groups || []).filter((g) => g.kind === 'user');
        setUserGroups(assignable.length ? assignable : fallback);
        setDelegationGroups(data.delegationGroups || []);
        setIsSupervisor(Boolean(data.isSupervisor));
      })
      .catch(() => {
        setGroups([]);
        setUserGroups([]);
      });
  }, []);

  function ownerFor(id) {
    return groups.find((group) => String(group.id) === String(id));
  }

  function allowedIdsFor(id) {
    return new Set((ownerFor(id)?.assignable_user_group_ids || []).map(Number));
  }

  function allowedDelegationIdsFor(id) {
    return new Set((ownerFor(id)?.assignable_delegation_group_ids || []).map(Number));
  }

  function chooseWorkGroup(nextId) {
    setGroupId(nextId);
    setSelectedGroupIds((current) => current.filter((item) => allowedIdsFor(nextId).has(Number(item))));
    setSelectedDelegationIds((current) => current.filter((item) => allowedDelegationIdsFor(nextId).has(Number(item))));
  }

  function audienceSelected(group) {
    const ids = group.kind === 'delegation' ? selectedDelegationIds : selectedGroupIds;
    return ids.map(Number).includes(Number(group.id));
  }

  function toggleGroup(group) {
    const setter = group.kind === 'delegation' ? setSelectedDelegationIds : setSelectedGroupIds;
    setter((current) => (
      current.map(Number).includes(Number(group.id))
        ? current.filter((item) => Number(item) !== Number(group.id))
        : [...current, group.id]
    ));
  }

  const visibleUserGroups = [
    ...userGroups.filter((group) => allowedIdsFor(groupId).has(Number(group.id))).map((group) => ({ ...group, kind: 'user' })),
    ...delegationGroups.filter((group) => allowedDelegationIdsFor(groupId).has(Number(group.id))).map((group) => ({ ...group, kind: 'delegation' })),
  ];

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        group_id: groupId,
        related_user_ids: relatedPeople.map((p) => p.id),
      };
      if (canAssignAudience) {
        payload.audience = audience;
        payload.user_group_ids = audience === 'user_groups'
          ? selectedGroupIds.filter((id) => allowedIdsFor(groupId).has(Number(id)))
          : [];
        payload.delegation_group_ids = audience === 'user_groups'
          ? selectedDelegationIds.filter((id) => allowedDelegationIdsFor(groupId).has(Number(id)))
          : [];
      }
      const { data } = await api.patch(`/workflows/${workflow.id}/settings`, payload);
      onSaved(data.workflow, data.message || t('eProcess.settings.saved'));
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card modal-card-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="settings-title"
      >
        <h2 id="settings-title">
          <Settings size={18} style={{ marginRight: 8, verticalAlign: -3 }} />
          {t('eProcess.settings.title')}
        </h2>
        <p className="muted">
          {t('eProcess.settings.intro')}
        </p>

        <form className="form-stack" onSubmit={save}>
          <section className="settings-section">
            <h3>{t('eProcess.common.ownership')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.settings.ownershipHint')}
            </p>
            <label>
              {t('eProcess.common.owningWorkGroup')}
              <select
                value={groupId}
                disabled={disabled || !groups.length}
                onChange={(e) => chooseWorkGroup(e.target.value)}
                required
              >
                {!groups.some((g) => g.id === groupId) && workflow.group_id && (
                  <option value={workflow.group_id}>{workflow.group_name || t('eProcess.common.currentGroup')}</option>
                )}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>{t('eProcess.common.whoCanUse')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.settings.audienceHint')}
            </p>
            {isSupervisor && (
            <label className="radio-card">
              <input
                type="radio"
                name="audience"
                checked={audience === 'everyone'}
                disabled={disabled || !canAssignAudience}
                onChange={() => setAudience('everyone')}
              />
              <span>
                <strong>{t('eProcess.common.everyone')}</strong>
                <em>{t('eProcess.settings.everyoneHint')}</em>
              </span>
            </label>
            )}
            <label className="radio-card">
              <input
                type="radio"
                name="audience"
                checked={audience === 'user_groups'}
                disabled={disabled || !canAssignAudience}
                onChange={() => setAudience('user_groups')}
              />
              <span>
                <strong>{t('eProcess.common.userGroups')}</strong>
                <em>{t('eProcess.settings.userGroupsHint')}</em>
              </span>
            </label>

            {audience === 'user_groups' && (
              !groupId ? (
                <p className="muted">{t('eProcess.workflows.chooseGroupFirst')}</p>
              ) : visibleUserGroups.length === 0 ? (
                <p className="muted">{t('eProcess.workflows.noAssignableGroups')}</p>
              ) : (
                <div className="form-stack">
                  <div className="choice-toolbar">
                    <button
                      type="button"
                      className="button button-light small"
                      disabled={disabled || !canAssignAudience}
                      onClick={() => {
                        const allOn = visibleUserGroups.every(audienceSelected);
                        setSelectedGroupIds(allOn ? [] : visibleUserGroups.filter((group) => group.kind !== 'delegation').map((group) => group.id));
                        setSelectedDelegationIds(allOn ? [] : visibleUserGroups.filter((group) => group.kind === 'delegation').map((group) => group.id));
                      }}
                    >
                      {visibleUserGroups.every(audienceSelected)
                        ? t('eProcess.procedures.clearAll')
                        : t('eProcess.procedures.selectAll')}
                    </button>
                  </div>
                  {visibleUserGroups.map((group) => (
                    <label className="checkbox" key={`${group.kind}-${group.id}`}>
                      <input
                        type="checkbox"
                        checked={audienceSelected(group)}
                        disabled={disabled || !canAssignAudience}
                        onChange={() => toggleGroup(group)}
                      />
                      {group.name}{group.kind === 'delegation' ? ` · ${t('eProcess.workgroup.delegationChip')}` : ''}
                    </label>
                  ))}
                </div>
              )
            )}
            {!canAssignAudience && (
              <p className="muted">{t('eProcess.settings.permissionHint')}</p>
            )}
          </section>

          <section className="settings-section">
            <h3>{t('eProcess.common.relatedPeople')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.settings.relatedHint')}
            </p>
            <RelatedPeopleFields
              people={relatedPeople}
              onChange={setRelatedPeople}
              disabled={disabled}
              ownerGroupId={groupId}
            />
          </section>

          {error && <div className="alert error">{error}</div>}

          <div className="task-actions">
            <button type="button" className="button button-light" onClick={onClose} disabled={disabled}>
              {t('eProcess.common.cancel')}
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={disabled || !groupId}
            >
              {t('eProcess.settings.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
