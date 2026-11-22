import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Search, UserPlus, Users } from '../icons';
import { api } from '../api';

function initialOf(person) {
  const source = person?.display_name || person?.username || person?.employee_number || '?';
  return String(source).trim().slice(0, 1).toUpperCase();
}

export default function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [delegationOptions, setDelegationOptions] = useState([]);
  const [delegationId, setDelegationId] = useState('');
  const [assignableIds, setAssignableIds] = useState([]);
  const [assignableDelegationIds, setAssignableDelegationIds] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    return api.get(`/groups/${id}`)
      .then(({ data }) => {
        setGroup(data.group);
        setAssignableIds((data.group?.assignable_user_group_ids || []).map(Number));
        setAssignableDelegationIds((data.group?.assignable_delegation_group_ids || []).map(Number));
      })
      .catch((err) => setMessage(err.response?.data?.message || t('eProcessNav.groupLoadError')));
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!group?.isHr) return undefined;
    api.get('/groups')
      .then(({ data }) => {
        setUserGroups(data.assignableUserGroups || []);
        setDelegationOptions(data.delegationGroups || []);
      })
      .catch(() => {
        setUserGroups([]);
        setDelegationOptions([]);
      });
    return undefined;
  }, [group?.isHr]);

  useEffect(() => {
    if (!group?.isHr) return undefined;
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api.get('/groups/member-candidates', { params: { q } })
        .then(({ data }) => {
          const taken = new Set((group.members || []).map((member) => Number(member.id)));
          setMatches((data.users || []).filter((user) => !taken.has(Number(user.id))));
        })
        .catch(() => setMatches([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, group]);

  const visibleAssignable = useMemo(() => {
    const items = [
      ...userGroups.map((group) => ({ ...group, kind: 'user' })),
      ...delegationOptions.map((group) => ({ ...group, kind: 'delegation' })),
    ];
    const q = groupFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(item.name || '').toLowerCase().includes(q));
  }, [userGroups, delegationOptions, groupFilter]);

  async function addMember(userId) {
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/groups/${id}/members`, { user_id: userId });
      setQuery('');
      setMatches([]);
      setNotice(t('eProcess.workgroup.added'));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function addDelegation() {
    if (!delegationId) return;
    setBusy(true);
    setMessage('');
    try {
      await api.post(`/groups/${id}/delegation-groups`, { delegation_group_id: Number(delegationId) });
      setDelegationId('');
      setNotice(t('eProcess.workgroup.delegationAdded'));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeDelegation(delegationGroupId) {
    setBusy(true);
    setMessage('');
    try {
      await api.delete(`/groups/${id}/delegation-groups/${delegationGroupId}`);
      setNotice(t('eProcess.workgroup.delegationRemoved'));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId) {
    setBusy(true);
    setMessage('');
    try {
      await api.delete(`/groups/${id}/members/${userId}`);
      setNotice(t('eProcess.workgroup.removed'));
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
    } finally {
      setBusy(false);
    }
  }

  function isAssignable(item) {
    const ids = item.kind === 'delegation' ? assignableDelegationIds : assignableIds;
    return ids.includes(Number(item.id));
  }

  function toggleAssignable(item) {
    const setter = item.kind === 'delegation' ? setAssignableDelegationIds : setAssignableIds;
    const id = Number(item.id);
    setter((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  async function saveAssignable() {
    setBusy(true);
    setMessage('');
    try {
      await api.put(`/groups/${id}/assignable-groups`, {
        target_group_ids: assignableIds,
        delegation_group_ids: assignableDelegationIds,
      });
      setNotice(t('eProcess.workgroup.assignableSaved'));
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
    } finally {
      setBusy(false);
    }
  }

  const members = (group?.members || []).filter((member) => member.direct !== false);
  const linkedDelegations = group?.delegation_groups || [];
  const availableDelegations = delegationOptions.filter((option) => (
    !linkedDelegations.some((item) => Number(item.id) === Number(option.id))
  ));

  return (
    <div className="page">
      <header className="page-header">
        <div className="editor-title-group" style={{ gap: 12 }}>
          <button className="icon-button" onClick={() => navigate('/e-process/groups')} aria-label={t('eProcessNav.back')}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <h1>{group?.name || t('eProcessNav.groupFallback')}</h1>
            <p>{group?.description || t('eProcessNav.groupMembersHint')}</p>
          </div>
        </div>
        {group?.canManageWorkflows && (
          <div className="toolbar-actions">
            <button className="button button-light" type="button" onClick={() => navigate(`/e-process/workflows?group=${id}`)}>
              {t('eProcess.workgroup.viewWorkflows')}
            </button>
            <button className="button button-primary" type="button" onClick={() => navigate(`/e-process/workflows/new?group=${id}`)}>
              {t('eProcess.workgroup.createWorkflow')}
            </button>
          </div>
        )}
      </header>
      {message && <div className="alert error">{message}</div>}
      {notice && <div className="alert">{notice}</div>}
      <div className="wg-detail">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>{t('eProcess.workgroup.membersTitle')}</h2>
              <p>{t('eProcessNav.memberCount', { count: members.length })}</p>
              {group?.isHr && <p>{t('eProcess.workgroup.membersHint')}</p>}
            </div>
          </div>
          {group?.isHr && (
            <div className="search-bar wg-filter">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('eProcess.workgroup.searchPlaceholder')}
                disabled={busy}
              />
            </div>
          )}
          {group?.isHr && (
            <div className="wg-add-row">
              <select
                value={delegationId}
                onChange={(e) => setDelegationId(e.target.value)}
                disabled={busy || availableDelegations.length === 0}
              >
                <option value="">{t('eProcess.workgroup.chooseDelegation')}</option>
                {availableDelegations.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              <button className="button button-primary" type="button" disabled={busy || !delegationId} onClick={addDelegation}>
                {t('eProcess.workgroup.addDelegation')}
              </button>
            </div>
          )}
          {linkedDelegations.length > 0 && (
            <div className="wg-people" style={{ marginBottom: 12 }}>
              {linkedDelegations.map((item) => (
                <div className="wg-person" key={`delegation-${item.id}`}>
                  <span className="wg-avatar"><Users size={18} /></span>
                  <div className="wg-person-copy">
                    <strong>{item.name}</strong>
                    {item.closed && <span>{t('eProcess.workgroup.delegationClosed')}</span>}
                  </div>
                  {group.isHr && (
                    <button className="button button-light small" type="button" disabled={busy} onClick={() => removeDelegation(item.id)}>
                      {t('eProcess.workgroup.remove')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {query.trim() && matches.length === 0 && <p className="muted">{t('eProcess.workgroup.noMatch')}</p>}
          {matches.length > 0 && (
            <div className="wg-results" style={{ marginBottom: 12 }}>
              {matches.map((user) => (
                <div className="wg-person is-result" key={user.id}>
                  <span className="wg-avatar">{initialOf(user)}</span>
                  <div className="wg-person-copy">
                    <strong>{user.display_name || user.employee_number}</strong>
                    <span>{user.employee_number}{user.email ? ` · ${user.email}` : ''}</span>
                  </div>
                  <button className="button button-primary small" type="button" disabled={busy} onClick={() => addMember(user.id)}>
                    <UserPlus size={14} /> {t('eProcess.workgroup.addMember')}
                  </button>
                </div>
              ))}
            </div>
          )}
          {group && members.length === 0 && linkedDelegations.length === 0 && <p className="muted">{t('eProcessNav.noActiveMembers')}</p>}
          <div className="wg-people">
            {members.map((member) => (
              <div className="wg-person" key={member.id}>
                <span className="wg-avatar">{initialOf(member)}</span>
                <div className="wg-person-copy">
                  <strong>{member.display_name || member.username}</strong>
                  <span>
                    {member.username}
                    {member.position_title ? ` · ${member.position_title}` : ''}
                  </span>
                </div>
                {group.isHr && member.direct && (
                  <button className="button button-light small" type="button" disabled={busy} onClick={() => removeMember(member.id)}>
                    {t('eProcess.workgroup.remove')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
        {group?.isHr && (
          <aside className="panel">
            <div className="panel-head">
              <div>
                <h2>{t('eProcess.workgroup.assignableTitle')}</h2>
                <p>{t('eProcess.workgroup.assignableHint')}</p>
              </div>
            </div>
            <div className="search-bar wg-filter">
              <Search size={18} />
              <input
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                placeholder={t('eProcess.workgroup.filterPlaceholder')}
              />
            </div>
            <p className="muted">{t('eProcess.workgroup.selectedCount', { count: assignableIds.length + assignableDelegationIds.length })}</p>
            {[
              ['user', t('eProcess.workgroup.assignableDepartments')],
              ['delegation', t('eProcess.workgroup.assignableDelegations')],
            ].map(([kind, label]) => {
              const items = visibleAssignable.filter((item) => item.kind === kind);
              if (!items.length) return null;
              return (
                <div className="wg-chip-section" key={kind}>
                  <h3>{label}</h3>
                  <div className="wg-chips">
                    {items.map((item) => {
                      const selected = isAssignable(item);
                      return (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          className={`wg-chip${selected ? ' is-on' : ''}${kind === 'delegation' ? ' is-delegation' : ''}`}
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => toggleAssignable(item)}
                        >
                          {selected && <Check size={14} />}
                          {item.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button className="button button-primary" type="button" disabled={busy} onClick={saveAssignable}>
              {t('eProcess.common.save')}
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
