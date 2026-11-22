import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CornerDownRight, CornerUpLeft, Download, FilePlus, GripVertical, Pencil, Plus, Trash2 } from '../icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import ChoiceOption from '../components/ChoiceOption';
import StatusBadge from '../components/StatusBadge';
import { isPreviewImage, isPreviewPdf } from '../components/AttachmentPreviewModal';
import { randomUUID } from '../utils/id';
import { ep } from '../useEp';

const PROCEDURE_FILE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,application/pdf,.pdf';

function apiMessage(err, fallback) {
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

function blankStep() {
  return { id: randomUUID(), title: ep('procedures.newStep'), body: '', images: [], children: [] };
}

function findStep(steps, id) {
  for (const step of steps) {
    if (step.id === id) return step;
    const child = (step.children || []).find((item) => item.id === id);
    if (child) return child;
  }
  return null;
}

function removeStep(steps, id) {
  return steps
    .filter((step) => step.id !== id)
    .map((step) => ({
      ...step,
      children: (step.children || []).filter((child) => child.id !== id),
    }));
}

function insertStep(steps, node, parentId, index) {
  if (!parentId) {
    const next = steps.slice();
    next.splice(index, 0, { ...node, children: node.children || [] });
    return next;
  }
  return steps.map((step) => {
    if (step.id !== parentId) return step;
    const children = (step.children || []).slice();
    children.splice(index, 0, { ...node, children: [] });
    return { ...step, children };
  });
}

function moveStep(steps, dragId, parentId, index) {
  const dragged = findStep(steps, dragId);
  if (!dragged || parentId === dragId) return steps;
  if (parentId && (dragged.children || []).length) return steps;
  const without = removeStep(steps, dragId);
  let targetIndex = index;
  if (!parentId) {
    const oldIndex = steps.findIndex((step) => step.id === dragId);
    if (oldIndex !== -1 && oldIndex < index) targetIndex -= 1;
  } else {
    const parent = steps.find((step) => step.id === parentId);
    const oldIndex = (parent?.children || []).findIndex((child) => child.id === dragId);
    if (oldIndex !== -1 && oldIndex < index) targetIndex -= 1;
  }
  return insertStep(without, dragged, parentId, Math.max(0, targetIndex));
}

function shiftStep(steps, id, parentId, direction) {
  const list = parentId
    ? (steps.find((step) => step.id === parentId)?.children || [])
    : steps;
  const index = list.findIndex((step) => step.id === id);
  if (index < 0) return steps;
  if (direction < 0 && index === 0) return steps;
  if (direction > 0 && index === list.length - 1) return steps;
  return moveStep(steps, id, parentId, direction < 0 ? index - 1 : index + 2);
}

function indentStep(steps, id) {
  const index = steps.findIndex((step) => step.id === id);
  if (index <= 0) return steps;
  const step = steps[index];
  if ((step.children || []).length) return steps;
  const previousId = steps[index - 1].id;
  return moveStep(steps, id, previousId, (steps[index - 1].children || []).length);
}

function outdentStep(steps, parentId, childId) {
  const parentIndex = steps.findIndex((step) => step.id === parentId);
  if (parentIndex < 0) return steps;
  return moveStep(steps, childId, null, parentIndex + 1);
}

function addImage(steps, stepId, image) {
  return steps.map((step) => {
    if (step.id === stepId) return { ...step, images: [...(step.images || []), image] };
    return {
      ...step,
      children: (step.children || []).map((child) => (
        child.id === stepId ? { ...child, images: [...(child.images || []), image] } : child
      )),
    };
  });
}

function removeImage(steps, imageId) {
  const strip = (images) => (images || []).filter((image) => image.id !== imageId);
  return steps.map((step) => ({
    ...step,
    images: strip(step.images),
    children: (step.children || []).map((child) => ({ ...child, images: strip(child.images) })),
  }));
}

function ProcedureFile({ procedureId, file }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState('');
  const isImage = isPreviewImage(file);
  const isPdf = isPreviewPdf(file);

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    api.get(`/procedures/${procedureId}/images/${file.id}`, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        const raw = res.data;
        const header = String(raw?.type || res.headers?.['content-type'] || '').split(';')[0].trim();
        let type = header;
        if (!type || type === 'application/octet-stream') {
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
  }, [procedureId, file.id]);

  if (!src) return <span className="muted procedure-image-pending">{file.file_name}</span>;
  if (isPdf) {
    return (
      <embed
        className="procedure-pdf-frame"
        type="application/pdf"
        title={file.file_name || 'PDF'}
        src={`${src}#toolbar=1&navpanes=0`}
      />
    );
  }
  if (isImage) {
    return <img src={src} alt={file.file_name} />;
  }
  return (
    <a className="button button-light small" href={src} download={file.file_name}>
      {t('eProcess.procedures.downloadFile', { name: file.file_name })}
    </a>
  );
}

function ImageCarousel({ procedureId, images, canEdit, onDelete }) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const count = images?.length || 0;

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, count - 1)));
  }, [count]);

  if (!count) return null;
  const file = images[Math.min(index, count - 1)];

  return (
    <>
      <div className="procedure-carousel no-print" role="region" aria-label={t('eProcess.procedures.stepFiles')}>
        <div className={`procedure-carousel-frame${isPreviewPdf(file) ? ' is-pdf' : ''}`}>
          <ProcedureFile procedureId={procedureId} file={file} />
          {count > 1 && (
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
          <span>{index + 1} / {count}</span>
        </div>
        {count > 1 && (
          <div className="procedure-carousel-dots" role="tablist" aria-label={t('eProcess.procedures.chooseFile')}>
            {images.map((item, dotIndex) => (
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
      <div className="procedure-print-images">
        {images.map((item) => (
          <figure className="procedure-figure" key={item.id}>
            <ProcedureFile procedureId={procedureId} file={item} />
            <figcaption>{item.file_name}</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

export default function ProcedureEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]);
  const [audience, setAudience] = useState('everyone');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedDelegationIds, setSelectedDelegationIds] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [delegationGroups, setDelegationGroups] = useState([]);
  const [workGroups, setWorkGroups] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [canAssign, setCanAssign] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragId, setDragId] = useState(null);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  function applyProcedure(next) {
    setProcedure(next);
    setName(next.name || '');
    setDescription(next.description || '');
    setSteps(next.steps || []);
    setAudience(next.audience === 'user_groups' ? 'user_groups' : 'everyone');
    setSelectedGroupIds(next.audience_group_ids || []);
    setSelectedDelegationIds(next.audience_delegation_group_ids || []);
    setCanEdit(Boolean(next.canEdit));
    setCanAssign(Boolean(next.canAssignAudience));
  }

  useEffect(() => {
    setEditing(false);
    api.get(`/procedures/${id}`)
      .then(({ data }) => applyProcedure(data.procedure))
      .catch((err) => {
        setMessageIsError(true);
        setMessage(apiMessage(err, t('eProcess.procedures.loadOneFailed')));
      });
  }, [id]);

  useEffect(() => {
    if (!canAssign) return undefined;
    api.get('/groups')
      .then(({ data }) => {
        setUserGroups(data.assignableUserGroups || []);
        setDelegationGroups(data.delegationGroups || []);
        setWorkGroups((data.groups || []).filter((group) => group.kind !== 'user'));
      })
      .catch(() => {
        setUserGroups([]);
        setWorkGroups([]);
      });
    return undefined;
  }, [canAssign]);

  function payload(status) {
    const body = {
      name: name.trim(),
      description,
      steps: stepsRef.current.map((step) => ({
        id: step.id,
        title: step.title,
        body: step.body,
        children: (step.children || []).map((child) => ({
          id: child.id,
          title: child.title,
          body: child.body,
        })),
      })),
    };
    if (canAssign) {
      const owner = workGroups.find((item) => String(item.id) === String(procedure?.group_id));
      const allowed = new Set((owner?.assignable_user_group_ids || []).map(Number));
      const allowedDelegations = new Set((owner?.assignable_delegation_group_ids || []).map(Number));
      body.audience = audience;
      body.user_group_ids = audience === 'user_groups'
        ? selectedGroupIds.filter((id) => allowed.has(Number(id)))
        : [];
      body.delegation_group_ids = audience === 'user_groups'
        ? selectedDelegationIds.filter((id) => allowedDelegations.has(Number(id)))
        : [];
    }
    if (status) body.status = status;
    return body;
  }

  async function save(status) {
    setBusy(true);
    setMessage('');
    try {
      const { data } = await api.put(`/procedures/${id}`, payload(status));
      applyProcedure(data.procedure);
      setEditing(false);
      setMessageIsError(false);
      setMessage(status === 'published' ? t('eProcess.procedures.published') : status === 'draft' ? t('eProcess.procedures.unpublished') : t('eProcess.procedures.saved'));
      return data.procedure;
    } catch (err) {
      setMessageIsError(true);
      setMessage(apiMessage(err, t('eProcess.common.saveFailed')));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function updateStep(stepId, parentId, patch) {
    setSteps((current) => current.map((step) => {
      if (!parentId && step.id === stepId) return { ...step, ...patch };
      if (step.id !== parentId) return step;
      return {
        ...step,
        children: (step.children || []).map((child) => (child.id === stepId ? { ...child, ...patch } : child)),
      };
    }));
  }

  async function uploadImage(stepId, file) {
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await api.put(`/procedures/${id}`, payload());
      applyProcedure(saved.data.procedure);
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.postForm(`/procedures/${id}/steps/${stepId}/images`, form);
      setSteps((current) => addImage(current, stepId, data.image));
      setMessageIsError(false);
      setMessage(t('eProcess.procedures.imageUploaded'));
    } catch (err) {
      setMessageIsError(true);
      setMessage(apiMessage(err, t('eProcess.procedures.uploadFailed')));
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage(imageId) {
    setMessage('');
    try {
      await api.delete(`/procedures/${id}/images/${imageId}`);
      setSteps((current) => removeImage(current, imageId));
    } catch (err) {
      setMessageIsError(true);
      setMessage(apiMessage(err, t('eProcess.procedures.removeImageFailed')));
    }
  }

  async function removeProcedure() {
    if (!window.confirm(t('eProcess.common.deleteNamed', { name }))) return;
    try {
      await api.delete(`/procedures/${id}`);
      navigate('/e-process/procedures');
    } catch (err) {
      setMessageIsError(true);
      setMessage(apiMessage(err, t('eProcess.procedures.deleteFailed')));
    }
  }

  async function exportPdf() {
    setExporting(true);
    setMessage('');
    try {
      const res = await api.get(`/procedures/${id}/pdf`, { responseType: 'blob' });
      const blob = res.data;
      if (blob?.type && blob.type.includes('application/json')) {
        const json = JSON.parse(await blob.text());
        throw new Error(json.message || json.error || t('eProcess.procedures.exportFailed'));
      }
      const file = blob?.type ? blob : new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      const base = String(procedure?.name || 'procedure').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'procedure';
      link.href = url;
      link.download = `${base}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let text = '';
      const data = err.response?.data;
      if (data && typeof data.text === 'function') {
        try {
          const json = JSON.parse(await data.text());
          text = json.message || json.error || '';
        } catch {
          text = '';
        }
      }
      setMessageIsError(true);
      setMessage(text || err.message || apiMessage(err, t('eProcess.procedures.exportFailed')));
    } finally {
      setExporting(false);
    }
  }

  function cancelEdit() {
    if (!procedure) return;
    setName(procedure.name || '');
    setDescription(procedure.description || '');
    setSteps(procedure.steps || []);
    setAudience(procedure.audience === 'user_groups' ? 'user_groups' : 'everyone');
    setSelectedGroupIds(procedure.audience_group_ids || []);
    setEditing(false);
    setMessage('');
  }

  function onDrop(event, parentId, index) {
    event.preventDefault();
    event.stopPropagation();
    if (!dragId) return;
    setSteps((current) => moveStep(current, dragId, parentId, index));
    setDragId(null);
  }

  if (!procedure && !message) return <div className="page"><div className="skeleton-block" /></div>;
  if (!procedure) {
    return (
      <div className="page">
        <div className="alert error">{message}</div>
        <button className="button button-light" onClick={() => navigate('/e-process/procedures')}>{t('eProcess.common.back')}</button>
      </div>
    );
  }

  const readers = procedure.audience === 'user_groups'
    ? (procedure.audience_groups || []).map((group) => group.name).join(', ') || t('eProcess.common.userGroups')
    : t('eProcess.common.everyone');
  const owner = workGroups.find((item) => String(item.id) === String(procedure.group_id));
  const allowedUserGroupIds = new Set((owner?.assignable_user_group_ids || []).map(Number));
  const allowedDelegationIds = new Set((owner?.assignable_delegation_group_ids || []).map(Number));
  const visibleUserGroups = [
    ...userGroups.filter((group) => allowedUserGroupIds.has(Number(group.id))).map((group) => ({ ...group, kind: 'user' })),
    ...delegationGroups.filter((group) => allowedDelegationIds.has(Number(group.id))).map((group) => ({ ...group, kind: 'delegation' })),
  ];
  function audienceSelected(group) {
    const ids = group.kind === 'delegation' ? selectedDelegationIds : selectedGroupIds;
    return ids.map(Number).includes(Number(group.id));
  }

  return (
    <div className="page procedure-sheet">
      <header className="page-header">
        <div className="run-header" style={{ marginBottom: 0, width: '100%' }}>
          <button className="icon-button no-print" onClick={() => navigate('/e-process/procedures')} aria-label={t('eProcess.common.back')}>
            <ArrowLeft size={19} />
          </button>
          <div className="procedure-heading">
            {editing ? (
              <label className="procedure-field procedure-field-title">
                <span>{t('eProcess.procedures.title')}</span>
                <input
                  className="procedure-title-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={180}
                  placeholder={t('eProcess.procedures.titlePlaceholder')}
                />
              </label>
            ) : (
              <h1 style={{ marginBottom: 4 }}>{procedure.name}</h1>
            )}
            <p>
              {procedure.group_name || t('eProcess.common.workGroup')}
              {' · '}
              {procedure.status === 'published' ? readers : t('eProcess.common.draft')}
            </p>
          </div>
          <div className="toolbar-actions no-print" style={{ marginLeft: 'auto' }}>
            <StatusBadge status={procedure.status} />
            <button type="button" className="button button-light" onClick={exportPdf} disabled={exporting}>
              <Download size={16} /> {exporting ? t('eProcess.procedures.exporting') : t('eProcess.procedures.exportPdf')}
            </button>
            {canEdit && !editing && (
              <button type="button" className="button button-primary" onClick={() => setEditing(true)}>
                <Pencil size={16} /> {t('eProcess.common.edit')}
              </button>
            )}
            {editing && (
              <>
                <button type="button" className="button button-primary" onClick={() => save()} disabled={busy}>{t('eProcess.common.save')}</button>
                {procedure.status === 'published' ? (
                  <button type="button" className="button button-light" onClick={() => save('draft')} disabled={busy}>{t('eProcess.common.unpublish')}</button>
                ) : (
                  <button type="button" className="button button-light" onClick={() => save('published')} disabled={busy}>{t('eProcess.common.publish')}</button>
                )}
                <button type="button" className="button button-light" onClick={cancelEdit} disabled={busy}>{t('eProcess.common.cancel')}</button>
                <button type="button" className="button button-danger" onClick={removeProcedure} disabled={busy}>{t('eProcess.common.delete')}</button>
              </>
            )}
          </div>
        </div>
      </header>

      {message && <div className={`alert no-print ${messageIsError ? 'error' : ''}`}>{message}</div>}

      <section className="panel procedure-intro">
        {editing ? (
          <label className="procedure-field">
            <span>{t('eProcess.common.description')}</span>
            <textarea
              className="procedure-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('eProcess.procedures.descriptionPlaceholder')}
            />
          </label>
        ) : (
          <p className="procedure-description">{procedure.description || t('eProcess.common.noDescription')}</p>
        )}
        {editing && canAssign && (
          <fieldset className="choice-group no-print">
            <legend>{t('eProcess.procedures.whoCanRead')}</legend>
            <ChoiceOption
              name="procedure-audience"
              checked={audience === 'everyone'}
              onChange={() => setAudience('everyone')}
              title={t('eProcess.common.everyone')}
              hint={t('eProcess.procedures.everyoneHintShort')}
            />
            <ChoiceOption
              name="procedure-audience"
              checked={audience === 'user_groups'}
              onChange={() => setAudience('user_groups')}
              title={t('eProcess.common.userGroups')}
              hint={t('eProcess.procedures.userGroupsHint')}
            />
            {audience === 'user_groups' && (
              visibleUserGroups.length === 0
                ? <p className="muted">{t('eProcess.procedures.noAssignableGroups')}</p>
                : (
                  <div className="choice-group choice-group-nested">
                    <div className="choice-toolbar">
                      <button
                        type="button"
                        className="button button-light small"
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
                      <ChoiceOption
                        key={`${group.kind}-${group.id}`}
                        type="checkbox"
                        checked={audienceSelected(group)}
                        onChange={() => {
                          const setter = group.kind === 'delegation' ? setSelectedDelegationIds : setSelectedGroupIds;
                          setter((current) => (
                            current.map(Number).includes(Number(group.id))
                              ? current.filter((item) => Number(item) !== Number(group.id))
                              : [...current, group.id]
                          ));
                        }}
                        title={group.name}
                        hint={group.kind === 'delegation' ? t('eProcess.workgroup.delegationChip') : (group.description || t('eProcess.common.userGroup'))}
                      />
                    ))}
                  </div>
                )
            )}
          </fieldset>
        )}
        {editing && (
          <p className="muted no-print">{t('eProcess.procedures.dragHint')}</p>
        )}
      </section>

      <ol className="procedure-steps">
        {steps.map((step, index) => (
          <StepCard
            key={step.id}
            procedureId={id}
            step={step}
            number={`${index + 1}`}
            canEdit={editing}
            busy={busy}
            dragId={dragId}
            onDragId={setDragId}
            onDrop={onDrop}
            onChange={(patch) => updateStep(step.id, null, patch)}
            onChangeChild={(childId, patch) => updateStep(childId, step.id, patch)}
            onShift={(direction) => setSteps((current) => shiftStep(current, step.id, null, direction))}
            onShiftChild={(childId, direction) => setSteps((current) => shiftStep(current, childId, step.id, direction))}
            onIndent={() => setSteps((current) => indentStep(current, step.id))}
            onOutdent={(childId) => setSteps((current) => outdentStep(current, step.id, childId))}
            onRemove={() => setSteps((current) => removeStep(current, step.id))}
            onRemoveChild={(childId) => setSteps((current) => removeStep(current, childId))}
            onAddChild={() => setSteps((current) => current.map((item) => (
              item.id === step.id ? { ...item, children: [...(item.children || []), blankStep()] } : item
            )))}
            onUpload={uploadImage}
            onDeleteImage={deleteImage}
            canIndent={index > 0 && !(step.children || []).length}
            isFirst={index === 0}
            isLast={index === steps.length - 1}
          />
        ))}
      </ol>

      {editing && (
        <button
          type="button"
          className="button button-light no-print"
          onClick={() => setSteps((current) => [...current, blankStep()])}
        >
          <Plus size={16} /> {t('eProcess.procedures.addStep')}
        </button>
      )}

      {!editing && steps.length === 0 && <p className="muted">{t('eProcess.procedures.noSteps')}</p>}
    </div>
  );
}

function StepCard({
  procedureId,
  step,
  number,
  canEdit,
  busy,
  dragId,
  onDragId,
  onDrop,
  onChange,
  onChangeChild,
  onShift,
  onShiftChild,
  onIndent,
  onOutdent,
  onRemove,
  onRemoveChild,
  onAddChild,
  onUpload,
  onDeleteImage,
  canIndent,
  isFirst,
  isLast,
}) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const children = step.children || [];

  return (
    <li
      className={`procedure-step${canEdit ? ' is-editing' : ''}${dragId === step.id ? ' is-dragging' : ''}`}
      onDragOver={canEdit ? (event) => event.preventDefault() : undefined}
      onDrop={canEdit ? (event) => onDrop(event, null, Number(number) - 1) : undefined}
    >
      <div className="procedure-step-head">
        {canEdit && (
          <button
            type="button"
            className="procedure-grip no-print"
            draggable
            aria-label={t('eProcess.procedures.drag')}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', step.id);
              onDragId(step.id);
            }}
            onDragEnd={() => onDragId(null)}
          >
            <GripVertical size={16} />
          </button>
        )}
        <span className="procedure-number">{number}</span>
        {canEdit ? (
          <label className="procedure-field procedure-field-inline">
            <span>{t('eProcess.procedures.stepTitle')}</span>
            <input
              className="procedure-step-title-input"
              value={step.title}
              onChange={(e) => onChange({ title: e.target.value })}
              maxLength={180}
              placeholder={t('eProcess.procedures.stepTitlePlaceholder')}
            />
          </label>
        ) : (
          <strong>{step.title}</strong>
        )}
        {canEdit && (
          <div className="procedure-step-actions no-print">
            <button type="button" className="icon-button" title={t('eProcess.procedures.moveUp')} disabled={isFirst} onClick={() => onShift(-1)}><ChevronUp size={16} /></button>
            <button type="button" className="icon-button" title={t('eProcess.procedures.moveDown')} disabled={isLast} onClick={() => onShift(1)}><ChevronDown size={16} /></button>
            <button type="button" className="icon-button" title={t('eProcess.procedures.indent')} disabled={!canIndent} onClick={onIndent}><CornerDownRight size={16} /></button>
            <button type="button" className="icon-button danger" title={t('eProcess.procedures.deleteStep')} onClick={onRemove}><Trash2 size={16} /></button>
          </div>
        )}
      </div>
      {canEdit ? (
        <label className="procedure-field">
          <span>{t('eProcess.procedures.instructions')}</span>
          <textarea
            className="procedure-textarea"
            value={step.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={3}
            placeholder={t('eProcess.procedures.stepBody')}
          />
        </label>
      ) : (
        step.body ? <p className="procedure-body">{step.body}</p> : null
      )}
      <ImageCarousel procedureId={procedureId} images={step.images} canEdit={canEdit} onDelete={onDeleteImage} />
      {canEdit && (
        <div className="no-print">
          <input
            ref={fileRef}
            type="file"
            accept={PROCEDURE_FILE_ACCEPT}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onUpload(step.id, file);
            }}
          />
          <button type="button" className="button button-light small" disabled={busy} onClick={() => fileRef.current?.click()}>
            <FilePlus size={14} /> {t('eProcess.procedures.addImage')}
          </button>
        </div>
      )}

      {(children.length > 0 || canEdit) && (
        <ol
          className={`procedure-children${canEdit && dragId && dragId !== step.id ? ' is-drop-ready' : ''}`}
          onDragOver={canEdit ? (event) => event.preventDefault() : undefined}
          onDrop={canEdit ? (event) => onDrop(event, step.id, children.length) : undefined}
        >
          {children.map((child, childIndex) => (
            <li
              key={child.id}
              className={`procedure-step is-sub${canEdit ? ' is-editing' : ''}${dragId === child.id ? ' is-dragging' : ''}`}
              onDragOver={canEdit ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}
              onDrop={canEdit ? (event) => onDrop(event, step.id, childIndex) : undefined}
            >
              <div className="procedure-step-head">
                {canEdit && (
                  <button
                    type="button"
                    className="procedure-grip no-print"
                    draggable
                    aria-label={t('eProcess.procedures.drag')}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', child.id);
                      onDragId(child.id);
                    }}
                    onDragEnd={() => onDragId(null)}
                  >
                    <GripVertical size={16} />
                  </button>
                )}
                <span className="procedure-number">{number}.{childIndex + 1}</span>
                {canEdit ? (
                  <label className="procedure-field procedure-field-inline">
                    <span>{t('eProcess.procedures.subStepTitle')}</span>
                    <input
                      className="procedure-step-title-input"
                      value={child.title}
                      onChange={(e) => onChangeChild(child.id, { title: e.target.value })}
                      maxLength={180}
                      placeholder={t('eProcess.procedures.subStepPlaceholder')}
                    />
                  </label>
                ) : (
                  <strong>{child.title}</strong>
                )}
                {canEdit && (
                  <div className="procedure-step-actions no-print">
                    <button type="button" className="icon-button" title={t('eProcess.procedures.moveUp')} disabled={childIndex === 0} onClick={() => onShiftChild(child.id, -1)}><ChevronUp size={16} /></button>
                    <button type="button" className="icon-button" title={t('eProcess.procedures.moveDown')} disabled={childIndex === children.length - 1} onClick={() => onShiftChild(child.id, 1)}><ChevronDown size={16} /></button>
                    <button type="button" className="icon-button" title={t('eProcess.procedures.outdent')} onClick={() => onOutdent(child.id)}><CornerUpLeft size={16} /></button>
                    <button type="button" className="icon-button danger" title={t('eProcess.procedures.deleteSubStep')} onClick={() => onRemoveChild(child.id)}><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              {canEdit ? (
                <label className="procedure-field">
                  <span>{t('eProcess.procedures.instructions')}</span>
                  <textarea
                    className="procedure-textarea"
                    value={child.body}
                    onChange={(e) => onChangeChild(child.id, { body: e.target.value })}
                    rows={2}
                    placeholder={t('eProcess.procedures.subStepBody')}
                  />
                </label>
              ) : (
                child.body ? <p className="procedure-body">{child.body}</p> : null
              )}
              <ImageCarousel procedureId={procedureId} images={child.images} canEdit={canEdit} onDelete={onDeleteImage} />
              {canEdit && (
                <ChildImageButton busy={busy} onPick={(file) => onUpload(child.id, file)} />
              )}
            </li>
          ))}
        </ol>
      )}
      {canEdit && (
        <button type="button" className="button button-light small no-print" onClick={onAddChild}>
          <Plus size={14} /> {t('eProcess.procedures.addSubStep')}
        </button>
      )}
    </li>
  );
}

function ChildImageButton({ busy, onPick }) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  return (
    <div className="no-print">
      <input
        ref={fileRef}
        type="file"
        accept={PROCEDURE_FILE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
      <button type="button" className="button button-light small" disabled={busy} onClick={() => fileRef.current?.click()}>
        <FilePlus size={14} /> {t('eProcess.procedures.addImage')}
      </button>
    </div>
  );
}
