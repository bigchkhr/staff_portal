import { useCallback, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Shield, Trash2, UserCheck, UserX } from '../icons';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { topicRoleLabel } from '../../sectionRoles';
import { personWithEmployeeNumber } from '../utils/datetime';

function initialOf(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase();
}

const SYSTEM = 'e_process';

export default function MembersPage() {
  const { hasPermission } = useContext(AuthContext);
  const canManage = hasPermission('e_process', 'admin');

  const [members, setMembers] = useState([]);
  const [allowedRoles, setAllowedRoles] = useState([]);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [addRole, setAddRole] = useState('read');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await axios.get(`/api/topic-permissions/${SYSTEM}/members`);
    setMembers(data.members || []);
    setAllowedRoles(data.allowed_roles || []);
  }, []);

  useEffect(() => {
    if (!canManage) return;
    load().catch((err) => setMessage(err.response?.data?.error || 'Failed to load members.'));
  }, [canManage, load]);

  useEffect(() => {
    if (!canManage || query.trim().length < 1) {
      setCandidates([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      axios
        .get(`/api/topic-permissions/${SYSTEM}/candidates`, { params: { q: query.trim() } })
        .then(({ data }) => setCandidates(data.users || []))
        .catch(() => setCandidates([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, canManage]);

  if (!canManage) {
    return <Navigate to="/e-process" replace />;
  }

  async function addMember(userId) {
    setBusy(true);
    setMessage('');
    try {
      await axios.post(`/api/topic-permissions/${SYSTEM}/members`, {
        userId,
        permissionType: addRole,
      });
      setQuery('');
      setCandidates([]);
      await load();
      setMessage('Member added.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Could not add member.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId, permissionType) {
    setBusyId(userId);
    setMessage('');
    try {
      await axios.put(`/api/topic-permissions/${SYSTEM}/members/${userId}`, { permissionType });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(member) {
    const disabling = member.section_is_active !== false;
    const label = member.display_name || member.username;
    const ok = window.confirm(
      disabling
        ? `Disable ${label} in E-Process only? They can still use other sections.`
        : `Re-enable ${label} in E-Process?`
    );
    if (!ok) return;
    setBusyId(member.id);
    setMessage('');
    try {
      await axios.patch(`/api/topic-permissions/${SYSTEM}/members/${member.id}/active`, {
        is_active: !disabling,
      });
      await load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(member) {
    const label = member.display_name || member.username;
    if (!window.confirm(`Remove ${label} from E-Process? They will lose access.`)) return;
    setBusyId(member.id);
    setMessage('');
    try {
      await axios.delete(`/api/topic-permissions/${SYSTEM}/members/${member.id}`);
      await load();
      setMessage('Member removed.');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Remove failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Member roles</h1>
          <p>Grant section access and roles for E-Process. Global admins manage accounts under User Management.</p>
        </div>
      </header>

      {message && (
        <div className={`alert ${/fail|Could|error/i.test(message) ? 'error' : ''}`}>{message}</div>
      )}

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <div>
            <h2>Add member</h2>
            <p>Search any active BOSS user and assign a section role.</p>
          </div>
        </div>
        <div className="form-stack">
          <div className="member-add-row">
            <label>
              Search user
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, employee number, or email"
              />
            </label>
            <label>
              Role
              <select value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>{topicRoleLabel(r)}</option>
                ))}
              </select>
            </label>
          </div>
          {candidates.length > 0 && (
            <div className="member-list">
              {candidates.map((c) => (
                <div className="member-card member-card-candidate" key={c.id}>
                  <div className="member-avatar">{initialOf(c.display_name || c.username)}</div>
                  <div className="member-card-main">
                    <strong>{personWithEmployeeNumber(c.display_name, c.username)}</strong>
                    <span>{c.email || 'No email'}</span>
                  </div>
                  <button className="button button-light button-compact" onClick={() => addMember(c.id)} disabled={busy}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Section members</h2>
            <p>Disable removes E-Process access only; remove deletes the permission row.</p>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="empty-state">
            <Shield size={28} />
            <p>No members yet.</p>
          </div>
        ) : (
          <div className="member-list">
            {members.map((m) => {
              const sectionActive = m.section_is_active !== false;
              const globalActive = m.user_is_active !== false;
              const label = personWithEmployeeNumber(m.display_name, m.username);
              return (
                <article className={`member-card${!sectionActive || !globalActive ? ' is-inactive' : ''}`} key={m.id}>
                  <div className="member-avatar">{initialOf(m.display_name || m.username)}</div>
                  <div className="member-card-main">
                    <strong>{label}</strong>
                    <span>{m.email || 'No email'}</span>
                    {(!sectionActive || !globalActive) && (
                      <div className="member-flags">
                        {!sectionActive && <span className="member-flag warn">Disabled in section</span>}
                        {!globalActive && <span className="member-flag warn">Globally disabled</span>}
                      </div>
                    )}
                  </div>
                  <div className="member-card-actions">
                    <select
                      className="member-role-select"
                      value={m.topic_role}
                      disabled={busyId === m.id || !sectionActive}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                    >
                      {allowedRoles.map((r) => (
                        <option key={r} value={r}>{topicRoleLabel(r)}</option>
                      ))}
                    </select>
                    <div className="member-icon-actions">
                      <button
                        type="button"
                        className="icon-button"
                        title={sectionActive ? 'Disable in section' : 'Re-enable'}
                        disabled={busyId === m.id}
                        onClick={() => toggleActive(m)}
                      >
                        {sectionActive ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Remove"
                        disabled={busyId === m.id}
                        onClick={() => removeMember(m)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
