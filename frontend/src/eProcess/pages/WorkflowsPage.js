import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Play, Plus, Trash2, Undo2, Workflow } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import StartRunDialog from '../components/StartRunDialog';

export default function WorkflowsPage() {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [runWorkflow, setRunWorkflow] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function loadGroups() {
    const { data } = await api.get('/groups');
    const list = (data.groups || []).filter((group) => group.kind !== 'user');
    setGroups(list);
    const fromQuery = searchParams.get('group');
    if (fromQuery && list.some((group) => String(group.id) === String(fromQuery))) setGroupId(String(fromQuery));
  }

  async function loadWorkflows(selectedGroupId = groupId) {
    const params = selectedGroupId ? { group_id: selectedGroupId } : undefined;
    const { data } = await api.get('/workflows', { params });
    setWorkflows((data.workflows || []).filter((workflow) => workflow.canView !== false));
  }

  useEffect(() => {
    loadGroups().catch(() => setMessage(t('eProcess.workflows.loadGroupsFailed')));
  }, []);

  useEffect(() => {
    loadWorkflows(groupId).catch(() => setMessage(t('eProcess.workflows.loadFailed')));
  }, [groupId]);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    function onDocClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenId(null);
      }
    }
    function onKey(event) {
      if (event.key === 'Escape') setMenuOpenId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpenId]);

  function goCreate() {
    const params = groupId ? `?group=${encodeURIComponent(groupId)}` : '';
    navigate(`/e-process/workflows/new${params}`);
  }

  function openStartRun(event, workflow) {
    event.stopPropagation();
    setMenuOpenId(null);
    setMessage('');
    setRunWorkflow(workflow);
  }

  async function confirmStartRun(name) {
    if (!runWorkflow) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post(`/workflows/${runWorkflow.id}/runs`, { name });
      setRunWorkflow(null);
      navigate(`/e-process/runs/${data.runId}`);
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.startFailed'));
      setBusy(false);
    }
  }

  async function unpublishWorkflow(workflow) {
    setMenuOpenId(null);
    const ok = window.confirm(
      t('eProcess.workflows.unpublishConfirm', { name: workflow.name })
    );
    if (!ok) return;
    try {
      const { data } = await api.post(`/workflows/${workflow.id}/unpublish`, {});
      setWorkflows((prev) => prev.map((item) => (item.id === workflow.id ? { ...item, ...data.workflow } : item)));
      setMessage(t('eProcess.workflows.unpublished'));
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workflows.unpublishFailed'));
    }
  }

  async function deleteWorkflow(workflow) {
    setMenuOpenId(null);
    const ok = window.confirm(t('eProcess.common.deleteNamed', { name: workflow.name }));
    if (!ok) return;
    try {
      await api.delete(`/workflows/${workflow.id}`);
      setWorkflows((prev) => prev.filter((w) => w.id !== workflow.id));
      setMessage(t('eProcess.workflows.deleted'));
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.workflows.deleteFailed'));
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('eProcessNav.workflows')}</h1>
          <p>{t('eProcess.workflows.hint')}</p>
        </div>
        <div className="toolbar-actions">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label={t('eProcess.workflows.filter')}>
            <option value="">{t('eProcess.workflows.allAccess')}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button className="button button-primary" onClick={goCreate} disabled={!groups.length}>
            <Plus size={17} /> {t('eProcess.workflows.new')}
          </button>
        </div>
      </header>

      {message && <div className="alert">{message}</div>}

      {workflows.length === 0 ? (
        <div className="empty-card">
          <Workflow size={34} />
          <h2>{t('eProcess.workflows.emptyTitle')}</h2>
          <p>{t('eProcess.workflows.emptyHint')}</p>
          {groups.length > 0 && (
            <button className="button button-primary" onClick={goCreate}>
              {t('eProcess.workflows.create')}
            </button>
          )}
        </div>
      ) : (
        <section className="panel workflow-list-panel">
          <div className="workflow-row workflow-row-head">
            <span>{t('eProcess.common.workflow')}</span>
            <span>{t('eProcess.common.group')}</span>
            <span className="workflow-col-num">{t('eProcess.common.steps')}</span>
            <span className="workflow-col-num">{t('eProcess.common.runs')}</span>
            <span>{t('eProcess.common.status')}</span>
            <span />
          </div>
          {workflows.map((workflow) => {
            const menuOpen = menuOpenId === workflow.id;
            const audience = workflow.status === 'published'
              ? (workflow.audience === 'user_groups' ? t('eProcess.common.userGroups') : t('eProcess.common.everyone'))
              : t('eProcess.common.draft');
            return (
              <article
                className="workflow-row"
                key={workflow.id}
                onClick={() => navigate(`/e-process/workflows/${workflow.id}`)}
              >
                <div className="workflow-row-main">
                  <div className="workflow-icon"><Workflow size={18} /></div>
                  <div>
                    <strong>{workflow.name}</strong>
                    <span className="workflow-number">{workflow.workflow_number || '—'}</span>
                    <span className="workflow-audience">{audience}</span>
                  </div>
                </div>
                <span className="workflow-row-muted workflow-col">{workflow.group_name || '—'}</span>
                <span className="workflow-row-muted workflow-col workflow-col-num">{workflow.step_count}</span>
                <span className="workflow-row-muted workflow-col workflow-col-num">{workflow.run_count}</span>
                <span className="workflow-col workflow-col-status"><StatusBadge status={workflow.status} /></span>
                <div
                  className="workflow-row-actions"
                  ref={menuOpen ? menuRef : null}
                  onClick={(e) => e.stopPropagation()}
                >
                  {workflow.status === 'published' && workflow.canRun !== false && (
                    <button type="button" className="button button-light small" onClick={(e) => openStartRun(e, workflow)}>
                      <Play size={15} /> {t('eProcess.common.run')}
                    </button>
                  )}
                  <div className="card-menu">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t('eProcess.workflows.actions')}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpenId(menuOpen ? null : workflow.id)}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {menuOpen && (
                      <div className="card-menu-panel" role="menu">
                        <button type="button" role="menuitem" onClick={() => navigate(`/e-process/workflows/${workflow.id}`)}>
                          {t('eProcess.common.open')}
                        </button>
                        {workflow.status === 'published' && workflow.canRun !== false && (
                          <button type="button" role="menuitem" onClick={(e) => openStartRun(e, workflow)}>
                            <Play size={15} /> {t('eProcess.common.run')}
                          </button>
                        )}
                        {workflow.status === 'published' && workflow.canEdit && (
                          <button type="button" role="menuitem" onClick={() => unpublishWorkflow(workflow)}>
                            <Undo2 size={15} /> {t('eProcess.common.unpublish')}
                          </button>
                        )}
                        {workflow.canDelete && (
                          <button type="button" role="menuitem" className="danger" onClick={() => deleteWorkflow(workflow)}>
                            <Trash2 size={15} /> {t('eProcess.common.delete')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {runWorkflow && (
        <StartRunDialog
          workflow={runWorkflow}
          busy={busy}
          onClose={() => !busy && setRunWorkflow(null)}
          onConfirm={confirmStartRun}
        />
      )}
    </div>
  );
}
