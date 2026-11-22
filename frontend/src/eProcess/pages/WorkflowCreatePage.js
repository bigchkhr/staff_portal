import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import RelatedPeopleFields from '../components/RelatedPeopleFields';

export default function WorkflowCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [delegationGroups, setDelegationGroups] = useState([]);
  const [canAssignAudience, setCanAssignAudience] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState('');
  const [audience, setAudience] = useState('user_groups');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedDelegationIds, setSelectedDelegationIds] = useState([]);
  const [relatedPeople, setRelatedPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/groups')
      .then(({ data }) => {
        const list = (data.groups || []).filter((g) => g.kind !== 'user');
        setGroups(list);
        const assignable = data.assignableUserGroups || [];
        const fallback = (data.groups || []).filter((g) => g.kind === 'user');
        setUserGroups(assignable.length ? assignable : fallback);
        setDelegationGroups(data.delegationGroups || []);
        setCanAssignAudience(Boolean(data.canAssignAnyAudience));
        setIsSupervisor(Boolean(data.isSupervisor));
        const fromQuery = searchParams.get('group');
        if (fromQuery && list.some((g) => String(g.id) === String(fromQuery))) {
          setGroupId(String(fromQuery));
        } else if (list.length === 1) {
          setGroupId(String(list[0].id));
        }
      })
      .catch(() => setError(t('eProcess.common.failedLoadGroups')))
      .finally(() => setLoading(false));
  }, [searchParams]);

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
    setSelectedGroupIds((current) => current.filter((id) => allowedIdsFor(nextId).has(Number(id))));
    setSelectedDelegationIds((current) => current.filter((id) => allowedDelegationIdsFor(nextId).has(Number(id))));
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

  async function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('eProcess.workflows.nameRequired'));
      return;
    }
    if (!groupId) {
      setError(t('eProcess.workflows.groupRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/workflows', {
        group_id: groupId,
        name: trimmed,
        description,
        steps: [],
        audience,
        user_group_ids: audience === 'user_groups' ? selectedGroupIds : [],
        delegation_group_ids: audience === 'user_groups' ? selectedDelegationIds : [],
        related_user_ids: relatedPeople.map((p) => p.id),
      });
      navigate(`/e-process/workflows/${data.workflow.id}`);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.workflows.createFailed'));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton-block" />
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <button className="icon-button" onClick={() => navigate('/e-process/workflows')} aria-label={t('eProcess.common.back')}>
              <ArrowLeft size={19} />
            </button>
          </div>
        </header>
        <div className="empty-card">
          <Users size={34} />
          <h2>{t('eProcess.workflows.needGroupTitle')}</h2>
          <p>{t('eProcess.workflows.needGroupHint')}</p>
          <button className="button button-primary" onClick={() => navigate('/e-process/groups')}>
            {t('eProcess.workflows.goGroups')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="editor-title-group" style={{ gap: 12 }}>
          <button className="icon-button" onClick={() => navigate('/e-process/workflows')} aria-label={t('eProcess.common.back')}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>{t('eProcess.workflows.newTitle')}</h1>
            <p>{t('eProcess.workflows.newHint')}</p>
          </div>
        </div>
      </header>

      <form className="panel create-workflow-panel" onSubmit={submit}>
        <div className="form-stack">
          <label>
            {t('eProcess.common.name')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('eProcess.workflows.namePlaceholder')}
              maxLength={180}
              autoFocus
              disabled={busy}
              required
            />
          </label>

          <label>
            {t('eProcess.common.description')}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('eProcess.workflows.descriptionPlaceholder')}
              rows={3}
              disabled={busy}
            />
          </label>

          <section className="settings-section">
            <h3>{t('eProcess.common.ownership')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.workflows.ownershipHint')}
            </p>
            <label>
              {t('eProcess.common.owningWorkGroup')}
              <select
                value={groupId}
                onChange={(e) => chooseWorkGroup(e.target.value)}
                disabled={busy}
                required
              >
                <option value="">{t('eProcess.common.selectGroup')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-section">
            <h3>{t('eProcess.common.whoCanUse')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.workflows.audienceHint')}
            </p>
            {isSupervisor && (
            <label className="radio-card">
              <input
                type="radio"
                name="audience"
                checked={audience === 'everyone'}
                disabled={busy}
                onChange={() => setAudience('everyone')}
              />
              <span>
                <strong>{t('eProcess.common.everyone')}</strong>
                <em>{t('eProcess.workflows.everyoneHint')}</em>
              </span>
            </label>
            )}
            <label className="radio-card">
              <input
                type="radio"
                name="audience"
                checked={audience === 'user_groups'}
                disabled={busy || !canAssignAudience}
                onChange={() => setAudience('user_groups')}
              />
              <span>
                <strong>{t('eProcess.common.userGroups')}</strong>
                <em>{t('eProcess.workflows.userGroupsHint')}</em>
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
                      disabled={busy}
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
                        disabled={busy}
                        onChange={() => toggleGroup(group)}
                      />
                      {group.name}{group.kind === 'delegation' ? ` · ${t('eProcess.workgroup.delegationChip')}` : ''}
                    </label>
                  ))}
                </div>
              )
            )}
          </section>

          <section className="settings-section">
            <h3>{t('eProcess.common.relatedPeople')}</h3>
            <p className="muted settings-hint">
              {t('eProcess.workflows.relatedHint')}
            </p>
            <RelatedPeopleFields
              people={relatedPeople}
              onChange={setRelatedPeople}
              disabled={busy}
              ownerGroupId={groupId}
            />
          </section>

          {error && <div className="alert error">{error}</div>}

          <div className="task-actions">
            <button
              type="button"
              className="button button-light"
              disabled={busy}
              onClick={() => navigate('/e-process/workflows')}
            >
              {t('eProcess.common.cancel')}
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !groupId || !name.trim()}
            >
              {t('eProcess.workflows.create')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
