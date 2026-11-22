import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Play, Plus, Save, Send, Settings, Trash2, Undo2 } from '../icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import StepEditor from '../components/StepEditor';
import StatusBadge from '../components/StatusBadge';
import WorkflowSettingsDialog from '../components/WorkflowSettingsDialog';
import StartRunDialog from '../components/StartRunDialog';
import { randomUUID } from '../utils/id';
import { ep } from '../useEp';

const newStep = () => ({
  id: randomUUID(),
  title: ep('editor.newTask'),
  description: '',
  type: 'task',
  required: true,
  allow_skip: false,
  allow_review: true,
  allow_delete: false,
  visible_to_starter: true,
  form_schema: [],
  condition: null,
  assignee_mode: 'unassigned',
  assignee_user_id: null,
});

function withStableIds(workflow) {
  return {
    ...workflow,
    steps: (workflow.steps || []).map((step) => ({
      ...step,
      id: step.id || randomUUID(),
      allow_skip: step.allow_skip === true,
      allow_review: step.allow_review !== false,
      allow_delete: step.allow_delete === true,
      visible_to_starter: step.visible_to_starter !== false,
      assignee_mode: step.assignee_mode || 'unassigned',
      assignee_user_id: step.assignee_mode === 'user' ? step.assignee_user_id : null,
      assignee_group_id: step.assignee_mode === 'group' && !step.assignee_delegation_group_id ? step.assignee_group_id : null,
      assignee_delegation_group_id: step.assignee_mode === 'group' ? (step.assignee_delegation_group_id || null) : null,
      assignee_group_name: step.assignee_mode === 'work_group'
        ? (workflow.group_name || step.assignee_group_name || null)
        : (step.assignee_mode === 'group' ? step.assignee_group_name : null),
      form_schema: (step.form_schema || []).map((field) => ({
        ...field,
        id: field.id || randomUUID(),
      })),
    })),
    audience_groups: workflow.audience_groups || [],
    audience_group_ids: workflow.audience_group_ids || (workflow.audience_groups || []).map((g) => g.id),
    related_people: workflow.related_people || [],
    related_user_ids: workflow.related_user_ids || (workflow.related_people || []).map((u) => u.id),
  };
}

function relatedPeopleSummary(workflow) {
  const people = workflow.related_people || [];
  if (!people.length) return ep('common.none');
  const names = people.map((p) => p.display_name || p.username).filter(Boolean);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

function audienceSummary(workflow) {
  if (workflow.audience === 'user_groups') {
    const groups = workflow.audience_groups || [];
    if (!groups.length) return ep('workflows.userGroupsNone');
    const names = groups.map((g) => g.name).filter(Boolean);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }
  return ep('common.everyone');
}

export default function WorkflowEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [canRun, setCanRun] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);

  async function load() {
    const { data } = await api.get(`/workflows/${id}`);
    const wf = withStableIds(data.workflow);
    setWorkflow(wf);
    setCanEdit(Boolean(data.canEdit));
    setCanDelete(Boolean(data.canDelete));
    setCanRun(Boolean(data.canRun));
  }

  useEffect(() => { load(); }, [id]);

  function applyWorkflowPayload(wf, caps = {}) {
    const next = withStableIds(wf);
    setWorkflow(next);
    if (caps.canEdit !== undefined) setCanEdit(Boolean(caps.canEdit));
    else if (wf.canEdit !== undefined) setCanEdit(Boolean(wf.canEdit));
    if (caps.canDelete !== undefined) setCanDelete(Boolean(caps.canDelete));
    else if (wf.canDelete !== undefined) setCanDelete(Boolean(wf.canDelete));
    if (caps.canRun !== undefined) setCanRun(Boolean(caps.canRun));
    else if (wf.canRun !== undefined) setCanRun(Boolean(wf.canRun));
    return next;
  }

  function updateStep(index, step) {
    if (!canEdit) return;
    const steps = [...workflow.steps];
    steps[index] = step;
    setWorkflow({ ...workflow, steps });
  }

  function removeStep(index) {
    if (!canEdit) return;
    setWorkflow({ ...workflow, steps: workflow.steps.filter((_, i) => i !== index) });
  }

  function moveStep(index, direction) {
    if (!canEdit) return;
    const target = index + direction;
    if (target < 0 || target >= workflow.steps.length) return;
    const steps = [...workflow.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    setWorkflow({ ...workflow, steps });
  }

  async function save() {
    setBusy(true); setMessage('');
    try {
      const { data } = await api.put(`/workflows/${id}`, {
        name: workflow.name,
        description: workflow.description,
        steps: workflow.steps,
      });
      applyWorkflowPayload(data.workflow);
      setMessage(t('eProcess.editor.savedDraft'));
      return data.workflow;
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.saveFailed'));
      return null;
    } finally { setBusy(false); }
  }

  function openPublish() {
    if (workflow.audience === 'user_groups' && !(workflow.audience_groups || []).length) {
      setMessage(t('eProcess.editor.publishNeedsAudience'));
      setShowSettings(true);
      return;
    }
    setShowPublish(true);
  }

  async function confirmPublish() {
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post(`/workflows/${id}/publish`, {});
      applyWorkflowPayload(data.workflow);
      setShowPublish(false);
      setMessage(
        data.workflow.audience === 'user_groups'
          ? t('eProcess.editor.publishedGroups', { count: (data.workflow.audience_groups || []).length })
          : t('eProcess.editor.publishedEveryone')
      );
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.publishFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmStartRun(name) {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post(`/workflows/${id}/runs`, { name });
      setShowStartRun(false);
      navigate(`/e-process/runs/${data.runId}`);
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.startFailed'));
      setBusy(false);
    }
  }

  async function unpublish() {
    const ok = window.confirm(
      t('eProcess.workflows.unpublishConfirm', { name: workflow.name })
    );
    if (!ok) return;
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.post(`/workflows/${id}/unpublish`, {});
      applyWorkflowPayload(data.workflow);
      setMessage(t('eProcess.editor.unpublished'));
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.unpublishFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkflow() {
    const ok = window.confirm(t('eProcess.common.deleteNamed', { name: workflow.name }));
    if (!ok) return;
    try {
      await api.delete(`/workflows/${id}`);
      navigate('/e-process/workflows');
    } catch (err) {
      setMessage(err.response?.data?.message || t('eProcess.editor.deleteFailed'));
    }
  }

  function onSettingsSaved(updated, note) {
    applyWorkflowPayload(updated);
    setShowSettings(false);
    setMessage(note || t('eProcess.settings.saved'));
  }

  if (!workflow) return <div className="page"><div className="skeleton-block" /></div>;

  return (
    <div className="page editor-page">
      <header className="editor-toolbar">
        <button className="icon-button" onClick={() => navigate('/e-process/workflows')}><ArrowLeft size={19} /></button>
        <div className="editor-title-group">
          <input
            value={workflow.name}
            onChange={(e) => canEdit && setWorkflow({ ...workflow, name: e.target.value })}
            readOnly={!canEdit}
          />
          <StatusBadge status={workflow.status} />
          {workflow.workflow_number && (
            <span className="muted" style={{ fontSize: 13 }}>{workflow.workflow_number}</span>
          )}
          {workflow.group_name && <span className="muted" style={{ fontSize: 13 }}>{workflow.group_name}</span>}
        </div>
        <div className="toolbar-actions">
          {message && <span className="save-message">{message}</span>}
          {canEdit && (
            <button className="button button-light" onClick={() => setShowSettings(true)} disabled={busy}>
              <Settings size={16} /> {t('eProcess.common.settings')}
            </button>
          )}
          {canEdit && <button className="button button-light" onClick={save} disabled={busy}><Save size={16} /> {t('eProcess.common.save')}</button>}
          {canEdit && workflow.status === 'published' && (
            <button className="button button-light" onClick={unpublish} disabled={busy}>
              <Undo2 size={16} /> {t('eProcess.common.unpublish')}
            </button>
          )}
          {canEdit && <button className="button button-primary" onClick={openPublish} disabled={busy}><Send size={16} /> {t('eProcess.common.publish')}</button>}
          {canRun && (
            <button className="button button-dark" onClick={() => setShowStartRun(true)} disabled={busy}>
              <Play size={16} /> {t('eProcess.common.run')}
            </button>
          )}
        </div>
      </header>

      <div className="editor-layout">
        <section className="editor-main">
          <textarea
            className="workflow-description"
            placeholder={t('eProcess.editor.descriptionPlaceholder')}
            value={workflow.description}
            onChange={(e) => canEdit && setWorkflow({ ...workflow, description: e.target.value })}
            readOnly={!canEdit}
          />
          <div className="steps-list">
            {workflow.steps.map((step, index) => (
              <StepEditor
                key={step.id}
                step={step}
                index={index}
                total={workflow.steps.length}
                onChange={updateStep}
                onRemove={removeStep}
                onMove={moveStep}
                readOnly={!canEdit}
                groupId={workflow.group_id}
                groupName={workflow.group_name}
              />
            ))}
          </div>
          {canEdit && (
            <button className="add-step" onClick={() => setWorkflow({ ...workflow, steps: [...workflow.steps, newStep()] })}>
              <Plus size={18} /> {t('eProcess.editor.addStep')}
            </button>
          )}
        </section>
        <aside className="editor-help panel">
          <h3>{t('eProcess.common.settings')}</h3>
          <p><strong>{t('eProcess.editor.owningGroup')}</strong> {workflow.group_name || '—'}</p>
          <p><strong>{t('eProcess.editor.whoCanUse')}</strong> {audienceSummary(workflow)}</p>
          <p><strong>{t('eProcess.editor.relatedPeople')}</strong> {relatedPeopleSummary(workflow)}</p>
          <p><strong>{t('eProcess.editor.status')}</strong> {workflow.status === 'published' ? t('eProcess.common.published') : t('eProcess.common.draft')}</p>
          <p className="muted" style={{ marginBottom: 14 }}>
            {t('eProcess.editor.sideHint')}
          </p>
          {canEdit && (
            <button className="button button-light wide" style={{ marginBottom: 12 }} onClick={() => setShowSettings(true)} disabled={busy}>
              <Settings size={16} /> {t('eProcess.editor.openSettings')}
            </button>
          )}
          {canDelete && (
            <div className="form-stack" style={{ marginBottom: 18 }}>
              <button className="button button-light wide danger-text" onClick={deleteWorkflow}>
                <Trash2 size={16} /> {t('eProcess.editor.deleteWorkflow')}
              </button>
            </div>
          )}
          <h3>{t('eProcess.editor.guide')}</h3>
          <p><strong>{t('eProcess.editor.guideTask')}</strong> {t('eProcess.editor.guideTaskText')}</p>
          <p><strong>{t('eProcess.editor.guideForm')}</strong> {t('eProcess.editor.guideFormText')}</p>
          <p><strong>{t('eProcess.editor.guideChecklist')}</strong> {t('eProcess.editor.guideChecklistText')}</p>
          <p><strong>{t('eProcess.editor.guideApproval')}</strong> {t('eProcess.editor.guideApprovalText')}</p>
          <p><strong>{t('eProcess.editor.guideAck')}</strong> {t('eProcess.editor.guideAckText')}</p>
          <p><strong>{t('eProcess.editor.guideComm')}</strong> {t('eProcess.editor.guideCommText')}</p>
          <p className="muted">{t('eProcess.editor.guideNote')}</p>
        </aside>
      </div>

      {showSettings && (
        <WorkflowSettingsDialog
          workflow={workflow}
          busy={busy}
          onClose={() => setShowSettings(false)}
          onSaved={onSettingsSaved}
        />
      )}

      {showPublish && (
        <div className="modal-backdrop" onClick={() => setShowPublish(false)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="publish-title">
            <h2 id="publish-title">{t('eProcess.editor.publishTitle')}</h2>
            <p className="muted">
              {t('eProcess.editor.publishHint')}
            </p>
            <div className="form-stack">
              <p><strong>{t('eProcess.editor.owningGroup')}</strong> {workflow.group_name || '—'}</p>
              <p><strong>{t('eProcess.editor.whoCanUse')}</strong> {audienceSummary(workflow)}</p>
              { (workflow.related_people || []).length > 0 && (
                <p><strong>{t('eProcess.editor.relatedPeople')}</strong> {relatedPeopleSummary(workflow)}</p>
              )}
              <div className="task-actions">
                <button type="button" className="button button-light" onClick={() => setShowPublish(false)} disabled={busy}>{t('eProcess.common.cancel')}</button>
                <button type="button" className="button button-primary" disabled={busy} onClick={confirmPublish}>
                  <Send size={16} /> {t('eProcess.common.publish')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStartRun && (
        <StartRunDialog
          workflow={workflow}
          busy={busy}
          onClose={() => !busy && setShowStartRun(false)}
          onConfirm={confirmStartRun}
        />
      )}
    </div>
  );
}
