import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import ChoiceOption from '../components/ChoiceOption';

function apiMessage(err, fallback) {
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

export default function ProcedureCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [delegationGroups, setDelegationGroups] = useState([]);
  const [canAssignIds, setCanAssignIds] = useState([]);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState('');
  const [audience, setAudience] = useState('user_groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedDelegationIds, setSelectedDelegationIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/me'), api.get('/groups')])
      .then(([{ data: me }, { data }]) => {
        const work = (data.groups || []).filter((group) => group.kind !== 'user');
        const manageIds = new Set(me.manageWorkflowGroupIds || []);
        const editable = me.isSupervisor ? work : work.filter((group) => manageIds.has(String(group.id)));
        setGroups(editable);
        setUserGroups(data.assignableUserGroups || []);
        setDelegationGroups(data.delegationGroups || []);
        setCanAssignIds(me.assignAudienceGroupIds || []);
        setIsSupervisor(Boolean(me.isSupervisor));
        const fromQuery = searchParams.get('group');
        if (fromQuery && editable.some((group) => group.id === fromQuery)) setGroupId(fromQuery);
        else if (editable.length === 1) setGroupId(editable[0].id);
      })
      .catch(() => setError(t('eProcess.common.failedLoadGroups')))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const currentWorkGroup = groups.find((group) => String(group.id) === String(groupId));
  const allowedUserGroupIds = new Set((currentWorkGroup?.assignable_user_group_ids || []).map(Number));
  const allowedDelegationIds = new Set((currentWorkGroup?.assignable_delegation_group_ids || []).map(Number));
  const visibleUserGroups = [
    ...userGroups.filter((group) => allowedUserGroupIds.has(Number(group.id))).map((group) => ({ ...group, kind: 'user' })),
    ...delegationGroups.filter((group) => allowedDelegationIds.has(Number(group.id))).map((group) => ({ ...group, kind: 'delegation' })),
  ];
  function audienceSelected(group) {
    const ids = group.kind === 'delegation' ? selectedDelegationIds : selectedGroupIds;
    return ids.map(Number).includes(Number(group.id));
  }
  const canAssignAudience = isSupervisor || canAssignIds.includes(groupId);

  function chooseWorkGroup(nextId) {
    const next = groups.find((group) => String(group.id) === String(nextId));
    const allowed = new Set((next?.assignable_user_group_ids || []).map(Number));
    const allowedDelegations = new Set((next?.assignable_delegation_group_ids || []).map(Number));
    setGroupId(nextId);
    setSelectedGroupIds((current) => current.filter((id) => allowed.has(Number(id))));
    setSelectedDelegationIds((current) => current.filter((id) => allowedDelegations.has(Number(id))));
  }

  function toggleGroup(group) {
    const setter = group.kind === 'delegation' ? setSelectedDelegationIds : setSelectedGroupIds;
    setter((current) => (
      current.map(Number).includes(Number(group.id))
        ? current.filter((item) => Number(item) !== Number(group.id))
        : [...current, group.id]
    ));
  }

  function selectAllAudiences() {
    const allOn = visibleUserGroups.every(audienceSelected);
    setSelectedGroupIds(allOn ? [] : visibleUserGroups.filter((group) => group.kind !== 'delegation').map((group) => group.id));
    setSelectedDelegationIds(allOn ? [] : visibleUserGroups.filter((group) => group.kind === 'delegation').map((group) => group.id));
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('eProcess.procedures.nameRequired'));
      return;
    }
    if (!groupId) {
      setError(t('eProcess.procedures.groupRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/procedures', {
        group_id: groupId,
        name: name.trim(),
        description,
        audience: canAssignAudience ? audience : 'user_groups',
        user_group_ids: canAssignAudience && audience === 'user_groups' ? selectedGroupIds : [],
        delegation_group_ids: canAssignAudience && audience === 'user_groups' ? selectedDelegationIds : [],
        steps: [],
      });
      navigate(`/e-process/procedures/${data.procedure.id}`);
    } catch (err) {
      setError(apiMessage(err, t('eProcess.procedures.createFailed')));
      setBusy(false);
    }
  }

  if (loading) return <div className="page"><div className="skeleton-block" /></div>;

  if (!groups.length) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1>{t('eProcess.procedures.newTitle')}</h1>
            <p>{t('eProcess.procedures.needPermission')}</p>
          </div>
        </header>
        <button className="button button-light" onClick={() => navigate('/e-process/procedures')}>{t('eProcess.common.back')}</button>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="run-header" style={{ marginBottom: 0 }}>
          <button className="icon-button" onClick={() => navigate('/e-process/procedures')} aria-label={t('eProcess.common.back')}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1 style={{ marginBottom: 4 }}>{t('eProcess.procedures.newTitle')}</h1>
            <p>{t('eProcess.procedures.newHint')}</p>
          </div>
        </div>
      </header>

      {error && <div className="alert error">{error}</div>}

      <form className="panel" onSubmit={submit}>
        <div className="form-stack">
          <label>
            {t('eProcess.common.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={180} />
          </label>
          <label>
            {t('eProcess.common.description')}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label>
            {t('eProcess.common.owningWorkGroup')}
            <select value={groupId} onChange={(e) => chooseWorkGroup(e.target.value)} required>
              <option value="">{t('eProcess.procedures.chooseGroup')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>
          {canAssignAudience && (
            <fieldset className="choice-group">
              <legend>{t('eProcess.procedures.whoCanRead')}</legend>
              {isSupervisor && (
              <ChoiceOption
                name="audience"
                checked={audience === 'everyone'}
                onChange={() => setAudience('everyone')}
                title={t('eProcess.common.everyone')}
                hint={t('eProcess.procedures.everyoneHint')}
              />
              )}
              <ChoiceOption
                name="audience"
                checked={audience === 'user_groups'}
                onChange={() => setAudience('user_groups')}
                title={t('eProcess.common.userGroups')}
                hint={t('eProcess.procedures.userGroupsHint')}
              />
              {audience === 'user_groups' && (
                !groupId
                  ? <p className="muted">{t('eProcess.procedures.chooseGroupFirst')}</p>
                  : visibleUserGroups.length === 0
                  ? <p className="muted">{t('eProcess.procedures.noAssignableGroups')}</p>
                  : (
                    <div className="choice-group choice-group-nested">
                      <div className="choice-toolbar">
                        <button
                          type="button"
                          className="button button-light small"
                          onClick={selectAllAudiences}
                        >
                          {visibleUserGroups.every(audienceSelected)
                            ? t('eProcess.procedures.clearAll')
                            : t('eProcess.procedures.selectAll')}
                        </button>
                      </div>
                      {visibleUserGroups.map((group) => (
                        <ChoiceOption
                          key={`${group.kind}-${group.id}`}
                          type="checkbox"
                          checked={audienceSelected(group)}
                          onChange={() => toggleGroup(group)}
                          title={group.name}
                          hint={group.kind === 'delegation' ? t('eProcess.workgroup.delegationChip') : (group.description || t('eProcess.common.userGroup'))}
                        />
                      ))}
                    </div>
                  )
              )}
            </fieldset>
          )}
          <div className="task-actions">
            <button type="button" className="button button-light" onClick={() => navigate('/e-process/procedures')}>{t('eProcess.common.cancel')}</button>
            <button type="submit" className="button button-primary" disabled={busy || !groupId || !name.trim()}>{t('eProcess.common.create')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
