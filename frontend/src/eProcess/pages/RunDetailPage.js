import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Lock,
  Plus,
  SkipForward,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from '../icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import FormFields from '../components/FormFields';
import LinkifiedText from '../components/LinkifiedText';
import EndFlowDialog from '../components/EndFlowDialog';
import AttachmentPreviewModal, { fetchApiBlob, isPreviewImage, isPreviewPdf } from '../components/AttachmentPreviewModal';
import { useMediaQuery } from '../hooks/useMediaQuery';
import GroupMemberPicker from '../components/GroupMemberPicker';
import { assigneeLabel, completedByLabel, formatDateHkt, formatDateTimeHkt, isRunOverdue, isTaskOverdue, personWithEmployeeNumber } from '../utils/datetime';
import { ep } from '../useEp';
import {
  COMMUNICATION_CONTACT_METHODS,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_STATUSES,
  communicationDirectionLabel,
  communicationMethodLabel,
  communicationStatusLabel,
} from '../utils/communication';
import { APPROVAL_DECISIONS, approvalDecisionLabel } from '../utils/approval';
import { ACKNOWLEDGEMENT_DECISIONS, acknowledgementDecisionLabel } from '../utils/acknowledgement';

function TaskIcon({ status }) {
  if (status === 'blocked') return <Lock size={18} />;
  if (status === 'rejected') return <ThumbsDown size={18} />;
  if (['completed', 'skipped'].includes(status)) return <Check size={18} />;
  return <Circle size={18} />;
}

function isPastTask(task) {
  return ['completed', 'skipped', 'rejected'].includes(task?.status);
}

function isOpenTask(task) {
  return ['pending', 'in_progress'].includes(task?.status);
}

const FINISH_ACTIONS = new Set(['complete', 'skip', 'approve', 'reject', 'acknowledge', 'decline']);

function finishNotice(action, task, next, runStatus) {
  const title = {
    skip: ep('run.skipped'),
    approve: ep('run.approved'),
    reject: ep('run.rejected'),
    acknowledge: ep('run.acknowledged'),
    decline: ep('run.declined'),
  }[action] || ep('run.stepCompleted');
  const finished = `${Number(task.position) + 1}. ${task.title}`;
  if (next) {
    return {
      title,
      text: ep('run.doneNext', { finished, next: `${Number(next.position) + 1}. ${next.title}` }),
    };
  }
  if (runStatus === 'completed') {
    return { title, text: ep('run.doneRun', { finished }) };
  }
  return { title, text: ep('run.done', { finished }) };
}

function stepCompletedLabel(task) {
  return task.completed_at_hkt || formatDateTimeHkt(task.completed_at);
}

function stepCompletedSummary(task) {
  const time = stepCompletedLabel(task);
  if (!time) return '';
  const who = task.completed_by_name || task.completed_by_username || '';
  return who ? `${time} UTC+8 · ${who}` : `${time} UTC+8`;
}

const AD_HOC_TYPES = ['task', 'communication', 'approval', 'acknowledgement', 'attachment'];

function isDecisionTask(type) {
  return type === 'approval' || type === 'acknowledgement';
}

function decisionOptions(type) {
  return type === 'acknowledgement' ? ACKNOWLEDGEMENT_DECISIONS : APPROVAL_DECISIONS;
}

function inferredPastDecision(task) {
  if (task.type === 'acknowledgement') {
    if (task.status === 'rejected') return 'decline';
    if (task.status === 'completed') return 'acknowledge';
    return '';
  }
  if (task.status === 'rejected') return 'reject';
  if (task.status === 'completed') return 'approval';
  return '';
}

function decisionSubmitAction(type, decision) {
  if (type === 'acknowledgement') return decision === 'decline' ? 'decline' : 'acknowledge';
  return decision === 'reject' ? 'reject' : 'approve';
}

function isPositiveDecision(type, value) {
  return type === 'acknowledgement' ? value === 'acknowledge' : value === 'approval';
}

function AttachmentStepFile({ runId, taskId, file }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    fetchApiBlob(`/runs/${runId}/tasks/${taskId}/attachments/${file.id}/download?inline=1`)
      .then((raw) => {
        if (cancelled) return;
        let type = String(raw?.type || '').split(';')[0].trim();
        if (!type || type === 'application/octet-stream' || type === 'application/json') {
          if (isPreviewPdf(file)) type = 'application/pdf';
          else if (isPreviewImage(file)) type = 'image/jpeg';
        }
        const blob = raw instanceof Blob && raw.type === type ? raw : new Blob([raw], { type });
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [runId, taskId, file.id, file.file_name, file.mime_type]);

  if (!src) return <span className="muted procedure-image-pending">{file.file_name}</span>;
  if (isPreviewPdf(file)) {
    return (
      <embed
        className="procedure-pdf-frame"
        type="application/pdf"
        title={file.file_name || ep('common.pdf')}
        src={`${src}#toolbar=1&navpanes=0`}
      />
    );
  }
  if (isPreviewImage(file)) return <img src={src} alt={file.file_name || ep('common.attachment')} />;
  return <span className="muted">{file.file_name}</span>;
}

function AttachmentStepCarousel({ runId, taskId, files, canEdit, onDelete }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const count = files?.length || 0;

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, count - 1)));
  }, [count]);

  if (!count) return null;
  const file = files[Math.min(index, count - 1)];
  const multiple = count > 1;

  return (
    <div className="procedure-carousel attachment-step-carousel" role="region" aria-label={t('eProcess.run.attachments')}>
      <div className={`procedure-carousel-frame${isPreviewPdf(file) ? ' is-pdf' : ''}`}>
        <AttachmentStepFile runId={runId} taskId={taskId} file={file} />
        {multiple && (
          <>
            <button type="button" className="procedure-carousel-nav is-prev" aria-label={t('eProcess.procedures.previousFile')} disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="procedure-carousel-nav is-next" aria-label={t('eProcess.procedures.nextFile')} disabled={index >= count - 1} onClick={() => setIndex((current) => Math.min(count - 1, current + 1))}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {canEdit && (
          <button type="button" className="icon-button danger procedure-carousel-remove" title={t('eProcess.procedures.removeFile')} onClick={() => onDelete(file.id)}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="procedure-carousel-meta">
        <span>{file.file_name}</span>
        {multiple ? <span>{index + 1} / {count}</span> : null}
      </div>
      {multiple && (
        <div className="procedure-carousel-dots" role="tablist" aria-label={t('eProcess.procedures.chooseFile')}>
          {files.map((item, dotIndex) => (
            <button
              key={item.id}
              type="button"
              className={dotIndex === index ? 'is-active' : ''}
              aria-label={`File ${dotIndex + 1}`}
              onClick={() => setIndex(dotIndex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RunDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isCompact = useMediaQuery('(max-width: 900px)');
  const isStageModal = useMediaQuery('(max-width: 1100px)');
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [values, setValues] = useState({});
  const [note, setNote] = useState('');
  const [returnTaskId, setReturnTaskId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddElement, setShowAddElement] = useState(false);
  const [addElementForm, setAddElementForm] = useState({
    type: 'task',
    title: '',
    description: '',
    insert_at: 0,
    allow_skip: false,
    allow_review: true,
  });
  const [error, setError] = useState('');
  const [attachmentPreview, setAttachmentPreview] = useState({
    open: false,
    files: [],
    index: 0,
  });
  const [busy, setBusy] = useState(false);
  const [copiedReference, setCopiedReference] = useState(false);
  const [runName, setRunName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [stepEndDateDraft, setStepEndDateDraft] = useState('');
  const [showEndFlow, setShowEndFlow] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [entering, setEntering] = useState(false);
  const [arrivingTaskId, setArrivingTaskId] = useState(null);

  function applyRun(payload, preferredTaskId) {
    setData(payload);
    setRunName(payload.run?.name || '');
    const tasks = payload.tasks || [];
    const preferred =
      tasks.find((t) => t.id === preferredTaskId) ||
      tasks.find((t) => t.canRespondAssignment) ||
      tasks.find((t) => isOpenTask(t) && t.canWork) ||
      tasks.find((t) => isOpenTask(t)) ||
      tasks.find((t) => t.status !== 'blocked') ||
      tasks[0];
    setSelectedTaskId(preferred?.id || null);
    setValues(preferred?.form_data || {});
    setAssigneeId(preferred?.assigned_to ? String(preferred.assigned_to) : '');
    setShowAssignDialog(false);
    setStepEndDateDraft(preferred?.end_date || '');
    setNote(isPastTask(preferred) ? (preferred?.note || '') : '');
    setReturnTaskId('');
    setReturnReason('');
    setShowReturn(false);
    return preferred;
  }

  async function load(preferredTaskId) {
    const response = await api.get(`/runs/${id}`);
    return applyRun(response.data, preferredTaskId);
  }

  useEffect(() => {
    if (!arrivingTaskId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(`[data-step-id="${arrivingTaskId}"]`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    });
    const timer = window.setTimeout(() => {
      setEntering(false);
      setArrivingTaskId(null);
    }, 720);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [arrivingTaskId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!isStageModal) setMobileExpanded(false);
  }, [isStageModal]);

  useEffect(() => {
    if (!isStageModal || !mobileExpanded) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event) {
      if (event.key !== 'Escape') return;
      if (showAssignDialog || showReturn || showAddElement || showEndFlow || showParticipants || attachmentPreview.open) return;
      setMobileExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [
    isStageModal,
    mobileExpanded,
    showAssignDialog,
    showReturn,
    showAddElement,
    showEndFlow,
    showParticipants,
    attachmentPreview.open,
  ]);

  const selectedTask = useMemo(
    () => (data?.tasks || []).find((t) => t.id === selectedTaskId) || null,
    [data, selectedTaskId]
  );


  const currentStage = useMemo(
    () => (data?.tasks || []).find((task) => isOpenTask(task)) || null,
    [data]
  );
  const previousStages = useMemo(
    () => (data?.tasks || []).filter(
      (task) => currentStage && Number(task.position) < Number(currentStage.position) && isPastTask(task)
    ),
    [data, currentStage]
  );
  const viewingPast = isPastTask(selectedTask);
  const starterHidden = Boolean(selectedTask?.starter_hidden);
  const contentHidden = Boolean(viewingPast && (selectedTask?.content_hidden || selectedTask?.allow_review === false));
  const canEditSelected = Boolean(selectedTask?.canWork && isOpenTask(selectedTask));

  function copyReferenceNumber() {
    const reference = data?.run?.id || id;
    if (!reference) return;
    navigator.clipboard.writeText(reference).then(() => {
      setCopiedReference(true);
      window.setTimeout(() => setCopiedReference(false), 1600);
    }).catch(() => {});
  }

  function selectTask(task) {
    if (task.status === 'blocked') return;
    setEntering(false);
    setArrivingTaskId(null);
    if (isStageModal && selectedTaskId === task.id && mobileExpanded) {
      setMobileExpanded(false);
      return;
    }
    setSelectedTaskId(task.id);
    setValues(task.form_data || {});
    setAssigneeId(task.assigned_to ? String(task.assigned_to) : '');
    setShowAssignDialog(false);
    setReturnTaskId('');
    setReturnReason('');
    setShowReturn(false);
    setStepEndDateDraft(task.end_date || '');
    setNote(isPastTask(task) ? (task.note || '') : '');
    setError('');
    if (isStageModal) setMobileExpanded(true);
  }

  async function returnToPreviousStage() {
    const reason = returnReason.trim();
    if (!returnTaskId || !reason) return;
    setError('');
    setBusy(true);
    try {
      await api.post(`/runs/${id}/return`, { target_task_id: returnTaskId, reason });
      const nextId = returnTaskId;
      setReturnTaskId('');
      setReturnReason('');
      setShowReturn(false);
      await load(nextId);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableReturn'));
    } finally {
      setBusy(false);
    }
  }

  async function act(task, action) {
    setError('');
    setBusy(true);
    try {
      await api.patch(`/runs/${id}/tasks/${task.id}`, { action, form_data: values, note });
      if (!FINISH_ACTIONS.has(action)) {
        await load(task.id);
        return;
      }
      const response = await api.get(`/runs/${id}`);
      const tasks = response.data.tasks || [];
      const next = tasks.find((item) => Number(item.position) > Number(task.position) && isOpenTask(item)) || null;
      const notice = finishNotice(action, task, next, response.data.run?.status);
      await Swal.fire({
        icon: 'success',
        title: notice.title,
        text: notice.text,
        confirmButtonText: next ? 'Continue' : 'OK',
        confirmButtonColor: '#6658e8',
        timer: 1700,
        timerProgressBar: true,
      });
      applyRun(response.data, next?.id || task.id);
      if (next) {
        if (isStageModal) setMobileExpanded(true);
        setEntering(true);
        setArrivingTaskId(next.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableUpdate'));
      // Server persists draft on validation failure; refresh attachments/meta without wiping local edits
      // unless the server already stored the same payload.
      try {
        const response = await api.get(`/runs/${id}`);
        const nextTask = (response.data.tasks || []).find((t) => t.id === task.id);
        if (nextTask) {
          setData(response.data);
          setValues((prev) => ({ ...(nextTask.form_data || {}), ...prev }));
          setNote((prev) => prev || nextTask.note || '');
        }
      } catch {
        // keep local values
      }
    } finally {
      setBusy(false);
    }
  }

  async function assign(userId) {
    const targetId = userId || assigneeId;
    if (!selectedTask || !targetId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/runs/${id}/tasks/${selectedTask.id}/assign`, {
        assignee_user_id: Number(targetId),
      });
      setShowAssignDialog(false);
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableAssign'));
    } finally {
      setBusy(false);
    }
  }

  async function assignGroup(group) {
    if (!selectedTask || !group) return;
    const body = group.id === 'work_members'
      ? { assignee_work_group: true }
      : { assignee_group_id: Number(group.id) };
    setBusy(true);
    setError('');
    try {
      await api.post(`/runs/${id}/tasks/${selectedTask.id}/assign`, body);
      setShowAssignDialog(false);
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableAssign'));
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    if (!selectedTask?.canAssign) return;
    if (!window.confirm(t('eProcess.run.clearAssignee'))) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/runs/${id}/tasks/${selectedTask.id}/assign`, {
        assignee_user_id: null,
      });
      setShowAssignDialog(false);
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableUnassign'));
    } finally {
      setBusy(false);
    }
  }

  function openAssignDialog() {
    setAssigneeId(data?.currentUserId ? String(data.currentUserId) : '');
    setShowAssignDialog(true);
  }

  async function respond(action) {
    if (!selectedTask) return;
    setBusy(true);
    setError('');
    try {
      const path =
        action === 'accept'
          ? `/runs/${id}/tasks/${selectedTask.id}/accept`
          : `/runs/${id}/tasks/${selectedTask.id}/reject-assignment`;
      await api.post(path, {});
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.unableRespond'));
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachment(file, formFieldKey = null) {
    if (!selectedTask) return;
    const key = selectedTask.type === 'attachment' ? 'attachment' : formFieldKey;
    if (!key) {
      setError(t('eProcess.run.fileFieldOnly'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Persist typed fields before upload+reload so they are not wiped.
      if (canEditSelected) {
        await api.patch(`/runs/${id}/tasks/${selectedTask.id}`, {
          action: 'save',
          form_data: values,
          note,
        });
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('form_field_key', key);
      await api.postForm(`/runs/${id}/tasks/${selectedTask.id}/attachments`, formData);
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || t('eProcess.run.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(attachmentId) {
    if (!selectedTask) return;
    setBusy(true);
    try {
      if (canEditSelected) {
        await api.patch(`/runs/${id}/tasks/${selectedTask.id}`, {
          action: 'save',
          form_data: values,
          note,
        });
      }
      await api.delete(`/runs/${id}/tasks/${selectedTask.id}/attachments/${attachmentId}`);
      await load(selectedTask.id);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.deleteAttachmentFailed'));
    } finally {
      setBusy(false);
    }
  }

  function downloadAttachment(attachmentId) {
    window.open(`/api/e-process/runs/${id}/tasks/${selectedTask.id}/attachments/${attachmentId}/download`, '_blank');
  }

  function openAttachmentPreview(file, filesForField = []) {
    const list = (filesForField || []).length ? filesForField : [file];
    const index = Math.max(0, list.findIndex((item) => item.id === file.id));
    setAttachmentPreview({ open: true, files: list, index });
  }

  function closeAttachmentPreview() {
    setAttachmentPreview({ open: false, files: [], index: 0 });
  }

  const fetchAttachmentBlob = useCallback(
    (file) =>
      fetchApiBlob(
        `/runs/${id}/tasks/${selectedTaskId}/attachments/${file.id}/download?inline=1`
      ),
    [id, selectedTaskId]
  );

  async function saveRunName() {
    const name = runName.trim();
    if (!name) {
      setError(t('eProcess.run.nameRequired'));
      setRunName(data.run.name);
      return;
    }
    if (name === data.run.name) return;
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.patch(`/runs/${id}`, { name });
      setData((prev) => ({ ...prev, run: { ...prev.run, name: res.run.name } }));
      setRunName(res.run.name);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.renameFailed'));
      setRunName(data.run.name);
    } finally {
      setBusy(false);
      setRenaming(false);
    }
  }

  async function saveStepEndDate(rawValue) {
    if (!selectedTask) return;
    const trimmed = String(rawValue ?? stepEndDateDraft).trim();
    const end_date = trimmed === '' ? null : trimmed;
    if (end_date && !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      setError(t('eProcess.run.badEndDate'));
      setStepEndDateDraft(selectedTask.end_date || '');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.patch(`/runs/${id}/tasks/${selectedTask.id}/schedule`, {
        end_date,
      });
      setData((prev) => {
        const tasks = (prev.tasks || []).map((t) => (t.id === selectedTask.id ? { ...t, ...res.task } : t));
        return {
          ...prev,
          tasks,
          run: { ...prev.run, is_overdue: isRunOverdue(prev.run, tasks) },
        };
      });
      setStepEndDateDraft(res.task?.end_date || '');
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.endDateFailed'));
      setStepEndDateDraft(selectedTask.end_date || '');
    } finally {
      setBusy(false);
    }
  }

  async function endFlow(reason) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/runs/${id}/cancel`, { reason });
      setShowEndFlow(false);
      await load(selectedTaskId);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.endFlowFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function addParticipant(user) {
    if (!user?.id) return;
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.post(`/runs/${id}/participants`, { user_id: user.id });
      setData((prev) => (prev ? { ...prev, participants: res.participants || [] } : prev));
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.addPersonFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function removeParticipant(userId) {
    if (!userId) return;
    if (!window.confirm(t('eProcess.run.removePerson'))) return;
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.delete(`/runs/${id}/participants/${userId}`);
      setData((prev) => (prev ? { ...prev, participants: res.participants || [] } : prev));
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.removePersonFailed'));
    } finally {
      setBusy(false);
    }
  }

  function openAddElement(defaultInsertAt) {
    const tasks = data?.tasks || [];
    const currentIdx = tasks.findIndex((t) => isOpenTask(t));
    const insert_at =
      typeof defaultInsertAt === 'number'
        ? defaultInsertAt
        : currentIdx >= 0
          ? currentIdx
          : tasks.length;
    setAddElementForm({
      type: 'task',
      title: '',
      description: '',
      insert_at,
      allow_skip: false,
      allow_review: true,
    });
    setShowAddElement(true);
  }

  async function submitAddElement() {
    setBusy(true);
    setError('');
    try {
      const { data: res } = await api.post(`/runs/${id}/elements`, {
        type: addElementForm.type,
        title: addElementForm.title.trim(),
        description: addElementForm.description,
        insert_at: Number(addElementForm.insert_at),
        allow_skip: addElementForm.allow_skip === true,
        allow_review: addElementForm.allow_review !== false,
      });
      setShowAddElement(false);
      await load(res.taskId || selectedTaskId);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.addElementFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteElement(task) {
    if (!task?.canDeleteElement) return;
    if (!window.confirm(t('eProcess.common.deleteNamed', { name: task.title }))) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/runs/${id}/elements/${task.id}`);
      await load(selectedTaskId === task.id ? null : selectedTaskId);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.run.deleteElementFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="page"><div className="skeleton-block" /></div>;
  const completed = data.tasks.filter((task) => isPastTask(task)).length;
  const progress = Math.round((completed / Math.max(data.tasks.length, 1)) * 100);
  const overdue = isRunOverdue(data.run, data.tasks);
  const selectedOverdue = selectedTask ? isTaskOverdue(selectedTask) : false;
  const stageModalOpen = isStageModal && mobileExpanded && Boolean(selectedTask);
  const currentOpenIndex = data.tasks.findIndex((t) => isOpenTask(t));
  const insertPositionOptions = [];
  for (let i = 0; i <= data.tasks.length; i += 1) {
    let label;
    if (i === 0) label = t('eProcess.run.beforeStart');
    else if (i === data.tasks.length) label = t('eProcess.run.afterEnd', { n: data.tasks.length });
    else label = t('eProcess.run.beforeStep', { n: i + 1, title: data.tasks[i]?.title || '' });
    if (currentOpenIndex >= 0) {
      if (i === currentOpenIndex) label += ` · ${t('eProcess.run.currentStage')}`;
      else if (i < currentOpenIndex) label += ` · ${t('eProcess.run.beforeCurrent')}`;
      else label += ` · ${t('eProcess.run.afterCurrent')}`;
    }
    insertPositionOptions.push({ value: i, label });
  }

  return (
    <div className={`page run-detail-page${isCompact ? ' is-compact-run' : ''}${isStageModal ? ' is-stage-modal' : ''}`}>
      <header className="run-header">
        <button className="icon-button" onClick={() => navigate('/e-process/runs')}><ArrowLeft size={19} /></button>
        <div className="run-title-block">
          {renaming ? (
            <input
              className="run-title-input"
              value={runName}
              maxLength={220}
              autoFocus
              disabled={busy}
              onChange={(e) => setRunName(e.target.value)}
              onBlur={saveRunName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  setRunName(data.run.name);
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button type="button" className="run-title-button" onClick={() => setRenaming(true)} title={t('eProcess.common.renameRun')}>
              <h1>{data.run.name}</h1>
            </button>
          )}
          <p>
            {data.run.run_number ? `${data.run.run_number} · ` : ''}
            {data.run.group_name ? `${data.run.group_name} · ` : ''}
            {data.run.workflow_name}
            {data.run.workflow_number ? ` (${data.run.workflow_number})` : ''}
          </p>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="button button-light"
            disabled={busy}
            title={t('eProcess.common.copyReference')}
            onClick={copyReferenceNumber}
          >
            {copiedReference ? <Check size={15} /> : <Copy size={15} />}
            {copiedReference ? t('eProcess.common.copied') : t('eProcess.common.copyReference')}
          </button>
          {(data.canManageParticipants || (data.participants || []).length > 0) && (
            <button
              type="button"
              className="button button-light"
              disabled={busy}
              onClick={() => {
                setShowParticipants(true);
              }}
            >
              <Users size={15} /> {t('eProcess.common.relatedPeople')}
              {(data.participants || []).length > 0 ? ` (${data.participants.length})` : ''}
            </button>
          )}
          {data.canEndRun && (
            <button type="button" className="button button-danger" disabled={busy} onClick={() => setShowEndFlow(true)}>
              <Square size={15} /> {t('eProcess.endFlow.title')}
            </button>
          )}
          {overdue && <StatusBadge status="overdue" />}
          <StatusBadge status={data.run.status} />
        </div>
      </header>
      {data.run.status === 'cancelled' && data.run.cancel_reason && (
        <div className="alert" style={{ marginTop: 12 }}>
          <strong>{t('eProcess.run.ended')}</strong> {data.run.cancel_reason}
        </div>
      )}
      <div className="run-progress">
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        <strong>{t('eProcess.common.percentComplete', { progress })}</strong>
      </div>
      {isStageModal && (
        <div className="mobile-stage-index-head">
          <h2>{t('eProcess.common.stage')}</h2>
          <p>{t('eProcess.run.viewStep')}</p>
        </div>
      )}
      {error && !stageModalOpen && <div className="alert error">{error}</div>}
      <div className="run-layout">
        <aside className="run-step-list">
          <div className="run-step-scroller">
          {data.tasks.map((task) => {
            const viewable = task.status !== 'blocked';
            const isSelected = selectedTask?.id === task.id;
            const isOpenInModal = isStageModal && isSelected && mobileExpanded;
            return (
              <div
                key={task.id}
                data-step-id={task.id}
                className={`run-step-row ${isSelected ? 'active' : ''}${arrivingTaskId === task.id ? ' is-arriving' : ''}`}
              >
                <button
                  type="button"
                  className={`run-step-item ${isSelected ? 'active' : ''} ${viewable ? 'viewable' : ''}`}
                  disabled={!viewable}
                  onClick={() => selectTask(task)}
                  title={viewable ? t('eProcess.run.viewStep') : t('eProcess.run.lockedStep')}
                  aria-haspopup={isStageModal ? 'dialog' : undefined}
                  aria-expanded={isStageModal ? isOpenInModal : undefined}
                >
                  <TaskIcon status={task.status} />
                  <span>
                    {task.position + 1}. {task.title}
                    <small className="step-type-tag">{t(`eProcess.types.${task.type}`, { defaultValue: task.type })}</small>
                    {task.end_date ? (
                      <small className={`step-completed-at ${isTaskOverdue(task) ? 'overdue-text' : ''}`}>
                        {t('eProcess.run.endOn', { date: formatDateHkt(task.end_date) })}{isTaskOverdue(task) ? ` · ${t('eProcess.status.overdue')}` : ''}
                      </small>
                    ) : null}
                    {isPastTask(task) && stepCompletedLabel(task) ? (
                      <small className="step-completed-at">{stepCompletedSummary(task)}</small>
                    ) : null}
                  </span>
                  <div className="run-step-badges">
                    {isTaskOverdue(task) && <StatusBadge status="overdue" />}
                    <StatusBadge status={task.assignment_status === 'pending' ? 'assignment_pending' : task.status} />
                    {isStageModal && viewable && (
                      <ChevronDown size={16} className="run-step-chevron" aria-hidden="true" />
                    )}
                  </div>
                </button>
                {data.canEditStructure && task.canDeleteElement && (
                  <button
                    type="button"
                    className="icon-button danger run-step-delete"
                    title={t('eProcess.run.deleteElement')}
                    disabled={busy}
                    onClick={() => deleteElement(task)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
          {data.canEditStructure && (
            <button type="button" className="button button-light wide" disabled={busy} onClick={() => openAddElement()}>
              <Plus size={16} /> {t('eProcess.run.addElement')}
            </button>
          )}
          </div>
          {data.run.status === 'cancelled' && (
            <div className="run-cancelled-banner">{t('eProcess.run.cancelled')}</div>
          )}
        </aside>
        {stageModalOpen && (
          <button
            type="button"
            className="stage-modal-backdrop"
            aria-label={t('eProcess.run.closeStage')}
            onClick={() => { if (!busy) setMobileExpanded(false); }}
          />
        )}
        {(!isStageModal || stageModalOpen) && (
          <section
            key={selectedTask?.id || 'empty'}
            className={`panel task-panel${entering ? ' is-step-enter' : ''}${stageModalOpen ? ' is-stage-dialog' : ''}`}
            role={stageModalOpen ? 'dialog' : undefined}
            aria-modal={stageModalOpen ? 'true' : undefined}
            aria-labelledby={stageModalOpen ? 'stage-modal-title' : undefined}
          >
            {stageModalOpen && (
              <>
                <div className="stage-modal-bar">
                  <button type="button" className="icon-button" aria-label={t('eProcess.run.closeStage')} onClick={() => setMobileExpanded(false)}>
                    <X size={18} />
                  </button>
                </div>
                {error && <div className="alert error">{error}</div>}
              </>
            )}
          {!selectedTask ? (
            <div className="completion-state">
              <Check size={42} />
              <h2>{data.run.status === 'completed' ? t('eProcess.run.workflowComplete') : t('eProcess.run.noActiveTask')}</h2>
              <p>{t('eProcess.run.allProcessed')}</p>
            </div>
          ) : (
            <>
              {viewingPast && (
                <div className="readonly-banner">
                  {t('eProcess.run.viewingPast')}
                </div>
              )}
              <div className="task-panel-head">
                <div>
                  <span className="eyebrow">{t(`eProcess.types.${selectedTask.type}`, { defaultValue: selectedTask.type })}</span>
                  <h2 id="stage-modal-title"><LinkifiedText text={selectedTask.title} /></h2>
                </div>
                <div className="task-panel-head-side">
                  <StatusBadge status={selectedTask.status} />
                  {selectedTask.canWork && previousStages.length > 0 && (
                    <button
                      type="button"
                      className="button button-light button-compact"
                      disabled={busy}
                      onClick={() => {
                        setError('');
                        setReturnTaskId('');
                        setReturnReason('');
                        setShowReturn(true);
                      }}
                    >
                      <ArrowLeft size={13} /> {t('eProcess.run.returnPrevious')}
                    </button>
                  )}
                </div>
              </div>
              {(selectedTask.stage_returns || []).length > 0 && (
                <div className="return-history">
                  {selectedTask.stage_returns.map((row) => (
                    <p key={row.id}>
                      <strong>{t('eProcess.run.returnedFrom', { title: row.from_task_title || t('eProcess.run.laterStage') })}</strong>
                      <span>{row.reason}</span>
                      <span className="muted">
                        {personWithEmployeeNumber(row.returned_by_name, row.returned_by_username)}
                        {row.created_at ? ` · ${formatDateTimeHkt(row.created_at)} UTC+8` : ''}
                      </span>
                    </p>
                  ))}
                </div>
              )}
              {starterHidden ? (
                <p className="muted">{t('eProcess.run.starterBlocked')}</p>
              ) : contentHidden ? (
                <p className="muted">{t('eProcess.run.titleOnly')}</p>
              ) : (
              <>
              <p className="task-description">
                <LinkifiedText text={selectedTask.description || t('eProcess.run.completeToContinue')} />
              </p>
              {!viewingPast && (
                <div className="assign-box">
                  <div className="assign-pair">
                    <div className="assign-meta">
                      <strong>{t('eProcess.common.assignee')}</strong>
                      <span className="assignee-name">{assigneeLabel(selectedTask)}</span>
                      {selectedTask.assignment_status ? (
                        <span className="muted">{t('eProcess.run.statusOf', { status: t(`eProcess.status.${selectedTask.assignment_status}`, { defaultValue: selectedTask.assignment_status }) })}</span>
                      ) : null}
                    </div>
                    <label className="step-end-date">
                      <span>{t('eProcess.run.endDateLabel')}{selectedOverdue ? ` · ${t('eProcess.status.overdue')}` : ''}</span>
                      <input
                        type="date"
                        value={stepEndDateDraft || ''}
                        disabled={busy || !(selectedTask.canAssign || selectedTask.canWork)}
                        onChange={(e) => setStepEndDateDraft(e.target.value)}
                        onBlur={(e) => saveStepEndDate(e.target.value)}
                      />
                      <span className="muted">{t('eProcess.run.noDue')}</span>
                    </label>
                  </div>
                  {(selectedTask.canRespondAssignment || selectedTask.canClaimGroup) && (
                    <div className="task-actions" style={{ marginTop: 10 }}>
                      {selectedTask.canRespondAssignment && (
                        <button className="button button-danger" disabled={busy} onClick={() => respond('reject')}>
                          <ThumbsDown size={16} /> {t('eProcess.run.rejectAssignment')}
                        </button>
                      )}
                      <button className="button button-primary" disabled={busy} onClick={() => respond('accept')}>
                        <ThumbsUp size={16} /> {selectedTask.canClaimGroup ? t('eProcess.run.claimGroup') : t('eProcess.run.acceptAssignment')}
                      </button>
                    </div>
                  )}
                  {selectedTask.canAssign && selectedTask.assignment_status === 'pending' && (
                    <p className="muted" style={{ marginTop: 8 }}>
                      {t('eProcess.run.waitingResponse')}
                    </p>
                  )}
                  {selectedTask.canAssign && (
                    <div className="task-actions task-actions-start">
                      <button
                        type="button"
                        className={`button button-compact ${selectedTask.assigned_to ? 'button-gold' : 'button-light'}`}
                        disabled={busy}
                        onClick={openAssignDialog}
                      >
                        <UserPlus size={13} /> {selectedTask.assigned_to ? t('eProcess.run.changeAssignee') : t('eProcess.run.assignSomeone')}
                      </button>
                      {selectedTask.assigned_to ? (
                        <button
                          type="button"
                          className="button button-light button-compact"
                          disabled={busy}
                          onClick={unassign}
                        >
                          {t('eProcess.run.unassign')}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {showAssignDialog && selectedTask?.canAssign && (
                <div className="modal-backdrop" onClick={() => setShowAssignDialog(false)} role="presentation">
                  <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="assign-title">
                    <h2 id="assign-title">{t('eProcess.run.assignTitle')}</h2>
                    <p className="muted">
                      {t('eProcess.run.assignHint')}
                    </p>
                    <div className="form-stack">
                      <button
                        type="button"
                        className="button button-primary wide"
                        disabled={busy || !data?.currentUserId}
                        onClick={() => assign(data.currentUserId)}
                      >
                        {t('eProcess.run.assignToMe')}
                      </button>
                      {selectedTask.assigned_to ? (
                        <button
                          type="button"
                          className="button button-light wide"
                          disabled={busy}
                          onClick={unassign}
                        >
                          {t('eProcess.run.unassign')}
                        </button>
                      ) : null}
                      <GroupMemberPicker
                        ownerGroupId={data?.run?.group_id}
                        disabled={busy}
                        actionLabel={t('eProcess.picker.assign')}
                        onSelect={(member) => assign(member.id)}
                        onAssignGroup={assignGroup}
                      />
                      <div className="task-actions">
                        <button type="button" className="button button-light" onClick={() => setShowAssignDialog(false)} disabled={busy}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewingPast && (
                <div className="assign-box">
                  <div className="assign-pair">
                    <div className="assign-meta">
                      <strong>{t('eProcess.common.assignee')}</strong>
                      <span className="assignee-name">{assigneeLabel(selectedTask)}</span>
                    </div>
                    <div className="assign-meta">
                      <strong>{t('eProcess.common.endDate')}</strong>
                      <span>{selectedTask.end_date ? formatDateHkt(selectedTask.end_date) : t('eProcess.run.noneDate')}</span>
                    </div>
                  </div>
                  {(stepCompletedLabel(selectedTask) || completedByLabel(selectedTask)) && (
                    <div className="assign-pair">
                      <div className="assign-meta">
                        <strong>{t('eProcess.common.completed')}</strong>
                        <span>{stepCompletedLabel(selectedTask) ? `${stepCompletedLabel(selectedTask)} UTC+8` : '—'}</span>
                      </div>
                      <div className="assign-meta">
                        <strong>{t('eProcess.common.completedBy')}</strong>
                        <span className="assignee-name">{completedByLabel(selectedTask) || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedTask.type === 'form' && (
                <div className="form-stack">
                  <FormFields
                    schema={selectedTask.form_schema}
                    values={values}
                    setValues={setValues}
                    disabled={!canEditSelected}
                    attachments={selectedTask.attachments}
                    onUploadFile={uploadAttachment}
                    onDownloadFile={downloadAttachment}
                    onPreviewFile={openAttachmentPreview}
                    onRemoveFile={canEditSelected ? removeAttachment : undefined}
                  />
                </div>
              )}

              {selectedTask.type === 'checklist' && (
                <div className="checklist-run">
                  <div className="section-label">{t('eProcess.types.checklist')}</div>
                  <div className="checklist-run-list">
                    {(selectedTask.form_schema || []).map((item) => (
                      <label className="checklist-run-item" key={item.id || item.key}>
                        <input
                          type="checkbox"
                          checked={Boolean(values[item.key])}
                          disabled={!canEditSelected}
                          onChange={(e) => setValues({ ...values, [item.key]: e.target.checked })}
                        />
                        <span>
                          {item.label}
                          {item.required !== false ? <em className="required-mark">*</em> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
                    {t('eProcess.run.checked', {
                      done: (selectedTask.form_schema || []).filter((i) => values[i.key]).length,
                      total: (selectedTask.form_schema || []).length,
                    })}
                    {(selectedTask.form_schema || []).some((i) => i.required !== false)
                      ? ` · ${t('eProcess.run.requiredChecked')}`
                      : ''}
                  </p>
                </div>
              )}

              {selectedTask.type === 'attachment' && (
                <div className="attachment-step">
                  <div className="section-label">{t('eProcess.run.pdfOrImage')}</div>
                  {canEditSelected && (
                    <div className="file-field">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) uploadAttachment(file, 'attachment');
                        }}
                      />
                    </div>
                  )}
                  {(selectedTask.attachments || []).length === 0 ? (
                    <p className="muted">{t('eProcess.run.noAttachment')}</p>
                  ) : (
                    <AttachmentStepCarousel
                      runId={id}
                      taskId={selectedTask.id}
                      files={selectedTask.attachments}
                      canEdit={canEditSelected}
                      onDelete={removeAttachment}
                    />
                  )}
                </div>
              )}

              {selectedTask.type === 'communication' && (
                <div className="form-stack communication-run">
                  <label>
                    {t('eProcess.common.status')}<em className="required-mark">*</em>
                    <select
                      value={values.status || ''}
                      disabled={!canEditSelected}
                      onChange={(e) => setValues({ ...values, status: e.target.value })}
                    >
                      <option value="">{t('eProcess.run.selectStatus')}</option>
                      {COMMUNICATION_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{communicationStatusLabel(s.value)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('eProcess.run.direction')}<em className="required-mark">*</em>
                    <select
                      value={values.direction || ''}
                      disabled={!canEditSelected}
                      onChange={(e) => setValues({ ...values, direction: e.target.value })}
                    >
                      <option value="">{t('eProcess.run.selectDirection')}</option>
                      {COMMUNICATION_DIRECTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{communicationDirectionLabel(d.value)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('eProcess.run.contactMethod')}<em className="required-mark">*</em>
                    <select
                      value={values.contact_method || ''}
                      disabled={!canEditSelected}
                      onChange={(e) => setValues({ ...values, contact_method: e.target.value })}
                    >
                      <option value="">{t('eProcess.run.selectMethod')}</option>
                      {COMMUNICATION_CONTACT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{communicationMethodLabel(m.value)}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t('eProcess.run.contactDate')}<em className="required-mark">*</em>
                    <input
                      type="date"
                      value={values.contact_date || ''}
                      disabled={!canEditSelected}
                      onChange={(e) => setValues({ ...values, contact_date: e.target.value })}
                    />
                  </label>
                  <label>
                    {t('eProcess.run.nextReview')}
                    <input
                      type="date"
                      value={values.next_review_date || ''}
                      disabled={!canEditSelected}
                      onChange={(e) => setValues({ ...values, next_review_date: e.target.value })}
                    />
                  </label>
                  {viewingPast && (
                    <p className="muted" style={{ margin: 0 }}>
                      {communicationStatusLabel(values.status)}
                      {' · '}
                      {communicationDirectionLabel(values.direction)}
                      {' · '}
                      {communicationMethodLabel(values.contact_method)}
                    </p>
                  )}
                </div>
              )}

              <label>
                {t('eProcess.common.notes')}
                <textarea
                  className="form-textarea"
                  value={note}
                  disabled={!canEditSelected}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={viewingPast ? t('eProcess.run.notesPast') : t('eProcess.run.notesPlaceholder')}
                  rows={5}
                />
              </label>

              {isDecisionTask(selectedTask.type) && (
                <div className="approval-run">
                  <div className="section-label">
                    {t('eProcess.run.decision')}{canEditSelected ? <em className="required-mark">*</em> : null}
                  </div>
                  <div
                    className="approval-choice"
                    role="group"
                    aria-label={selectedTask.type === 'acknowledgement' ? t('eProcess.run.ackDecision') : t('eProcess.run.approvalDecision')}
                  >
                    {decisionOptions(selectedTask.type).filter((option) => {
                      const selectedDecision = values.decision || inferredPastDecision(selectedTask);
                      const locked = !canEditSelected && (selectedTask.status === 'completed' || selectedTask.status === 'rejected');
                      return !locked || !selectedDecision || option.value === selectedDecision;
                    }).map((option) => {
                      const selectedDecision = values.decision || inferredPastDecision(selectedTask);
                      const selected = selectedDecision === option.value;
                      const isPositive = isPositiveDecision(selectedTask.type, option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`button ${isPositive ? 'button-approve' : 'button-reject'}${selected ? ' selected' : ''}`}
                          disabled={!canEditSelected}
                          aria-pressed={selected}
                          onClick={() => setValues({ ...values, decision: option.value })}
                        >
                          {isPositive ? <Check size={16} /> : <X size={16} />}
                          {selectedTask.type === 'acknowledgement' ? acknowledgementDecisionLabel(option.value) : approvalDecisionLabel(option.value)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {canEditSelected && (
                <div className="task-actions task-submit">
                  {selectedTask.allow_skip && (
                    <button
                      type="button"
                      className="button button-light"
                      disabled={busy}
                      onClick={() => act(selectedTask, 'skip')}
                    >
                      <SkipForward size={16} /> {t('eProcess.run.skipStep')}
                    </button>
                  )}
                  <button
                    className={`button button-primary${isDecisionTask(selectedTask.type) ? ' wide' : ''}`}
                    disabled={busy || (isDecisionTask(selectedTask.type) && !values.decision) || (selectedTask.type === 'attachment' && !(selectedTask.attachments || []).length)}
                    onClick={() => {
                      if (isDecisionTask(selectedTask.type)) {
                        act(selectedTask, decisionSubmitAction(selectedTask.type, values.decision));
                        return;
                      }
                      act(selectedTask, 'complete');
                    }}
                  >
                    <Check size={16} />
                    {isDecisionTask(selectedTask.type)
                      ? (values.decision ? t('eProcess.run.submit') : t('eProcess.run.selectAction'))
                      : t('eProcess.run.completeStep')}
                  </button>
                </div>
              )}

              {!canEditSelected && selectedTask.assignment_status === 'pending' && !selectedTask.canRespondAssignment && !viewingPast && (
                <p className="muted">{t('eProcess.run.waitingAssignee')}</p>
              )}
              </>
              )}
            </>
          )}
          </section>
        )}
      </div>

      {showReturn && selectedTask?.canWork && previousStages.length > 0 && (
        <div
          className="modal-backdrop"
          onClick={() => { if (!busy) setShowReturn(false); }}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-stage-title"
          >
            <h2 id="return-stage-title">{t('eProcess.run.returnTitle')}</h2>
            <p className="muted">{t('eProcess.run.returnHint')}</p>
            <div className="form-stack">
              <label>
                {t('eProcess.common.stage')}
                <select
                  value={returnTaskId}
                  disabled={busy}
                  autoFocus
                  onChange={(e) => setReturnTaskId(e.target.value)}
                >
                  <option value="">{t('eProcess.run.chooseStage')}</option>
                  {previousStages.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </label>
              <label className="return-reason">
                {t('eProcess.common.reason')}
                <textarea
                  rows={3}
                  value={returnReason}
                  disabled={busy}
                  maxLength={5000}
                  placeholder={t('eProcess.run.returnPlaceholder')}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </label>
              {error && <div className="alert error">{error}</div>}
              <div className="task-actions">
                <button
                  type="button"
                  className="button button-light"
                  disabled={busy}
                  onClick={() => setShowReturn(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-light"
                  disabled={busy || !returnTaskId || !returnReason.trim()}
                  onClick={returnToPreviousStage}
                >
                  <ArrowLeft size={16} /> {t('eProcess.common.return')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddElement && data.canEditStructure && (
        <div className="modal-backdrop" onClick={() => setShowAddElement(false)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="add-element-title">
            <h2 id="add-element-title">{t('eProcess.run.addElement')}</h2>
            <p className="muted">
              {t('eProcess.run.addElementHint')}
            </p>
            <div className="form-stack">
              <label>
                {t('eProcess.common.type')}
                <select
                  value={addElementForm.type}
                  onChange={(e) => setAddElementForm({ ...addElementForm, type: e.target.value })}
                >
                  {AD_HOC_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`eProcess.types.${type}`)}</option>
                  ))}
                </select>
              </label>
              <label>
                {t('eProcess.common.title')}
                <input
                  value={addElementForm.title}
                  onChange={(e) => setAddElementForm({ ...addElementForm, title: e.target.value })}
                  placeholder={t('eProcess.run.elementTitle')}
                  autoFocus
                />
              </label>
              <label>
                {t('eProcess.run.instructionsOptional')}
                <textarea
                  value={addElementForm.description}
                  onChange={(e) => setAddElementForm({ ...addElementForm, description: e.target.value })}
                  placeholder={t('eProcess.run.whatToDo')}
                />
              </label>
              <label>
                {t('eProcess.run.insertAt')}
                <select
                  value={addElementForm.insert_at}
                  onChange={(e) => setAddElementForm({ ...addElementForm, insert_at: Number(e.target.value) })}
                >
                  {insertPositionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={addElementForm.allow_skip === true}
                  onChange={(e) => setAddElementForm({ ...addElementForm, allow_skip: e.target.checked })}
                />
                {t('eProcess.run.allowSkip')}
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={addElementForm.allow_review !== false}
                  onChange={(e) => setAddElementForm({ ...addElementForm, allow_review: e.target.checked })}
                />
                {t('eProcess.run.allowReview')}
              </label>
              <div className="task-actions">
                <button type="button" className="button button-light" disabled={busy} onClick={() => setShowAddElement(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy || !addElementForm.title.trim()}
                  onClick={submitAddElement}
                >
                  <Plus size={16} /> {t('eProcess.common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEndFlow && (
        <EndFlowDialog
          busy={busy}
          onClose={() => !busy && setShowEndFlow(false)}
          onConfirm={endFlow}
        />
      )}

      {showParticipants && (
        <div className="modal-backdrop" onClick={() => setShowParticipants(false)} role="presentation">
          <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="related-people-title">
            <h2 id="related-people-title">{t('eProcess.common.relatedPeople')}</h2>
            <p className="muted">
              {t('eProcess.run.relatedHint')}
            </p>
            <div className="form-stack">
              {(data.participants || []).length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>{t('eProcess.run.noRelated')}</p>
              ) : (
                <div className="table-list">
                  {data.participants.map((p) => (
                    <div className="table-row" key={p.id}>
                      <div>
                        <strong>{p.display_name || p.username}</strong>
                        <span>
                          {p.username}
                          {p.position_title ? ` · ${p.position_title}` : ''}
                          {p.email ? ` · ${p.email}` : ''}
                        </span>
                      </div>
                      {data.canManageParticipants && (
                        <button
                          type="button"
                          className="icon-button danger"
                          disabled={busy}
                          title={t('eProcess.common.remove')}
                          onClick={() => removeParticipant(p.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {data.canManageParticipants && (
                <>
                  <GroupMemberPicker
                    ownerGroupId={data?.run?.group_id}
                    disabled={busy}
                    actionLabel={t('eProcess.picker.add')}
                    onSelect={addParticipant}
                  />
                </>
              )}

              <div className="task-actions">
                <button type="button" className="button button-light" disabled={busy} onClick={() => setShowParticipants(false)}>
                  {t('eProcess.common.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AttachmentPreviewModal
        open={attachmentPreview.open}
        onClose={closeAttachmentPreview}
        files={attachmentPreview.files}
        initialIndex={attachmentPreview.index}
        fetchBlob={fetchAttachmentBlob}
        onDownload={(file) => downloadAttachment(file.id)}
      />
    </div>
  );
}
