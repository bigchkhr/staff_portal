import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Users } from '../icons';
import { api } from '../api';

export default function GroupsPage() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [canCreate, setCanCreate] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  function load() {
    return api.get('/groups')
      .then(({ data }) => {
        setGroups(data.groups || []);
        setCanCreate(Boolean(data.canCreateGroup));
      })
      .catch(() => setMessage(t('eProcessNav.groupsLoadError')));
  }

  useEffect(() => {
    load();
  }, [t]);

  async function createGroup(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post('/groups', { name: trimmed });
      setName('');
      navigate(`/e-process/groups/${data.id}`);
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workgroup.failed'));
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('eProcessNav.groups')}</h1>
          <p>{t('eProcessNav.groupsHint')}</p>
        </div>
      </header>
      {canCreate && (
        <form className="wg-create" onSubmit={createGroup}>
          <div className="wg-create-copy">
            <strong>{t('eProcess.workgroup.new')}</strong>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('eProcess.workgroup.namePlaceholder')}
            maxLength={180}
            disabled={busy}
          />
          <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>
            <Plus size={16} /> {t('eProcess.workgroup.create')}
          </button>
        </form>
      )}
      {message && <div className="alert error">{message}</div>}
      {groups.length === 0 ? (
        <div className="empty-card">
          <Users size={28} />
          <p>{t('eProcessNav.groupsEmpty')}</p>
        </div>
      ) : (
        <div className="wg-grid">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="wg-card"
              onClick={() => navigate(`/e-process/groups/${group.id}`)}
            >
              <span className="wg-icon"><Users size={20} /></span>
              <span className="wg-card-body">
                <strong>{group.name}</strong>
                <span>{t('eProcessNav.memberCount', { count: group.member_count })}</span>
              </span>
              {group.canManageWorkflows && <span className="wg-pill">{t('eProcessNav.canManage')}</span>}
              <ChevronRight className="chevron" size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
