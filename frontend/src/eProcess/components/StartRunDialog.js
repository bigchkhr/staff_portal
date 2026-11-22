import { useEffect, useState } from 'react';
import { Play } from '../icons';
import { useEp } from '../useEp';

function defaultRunTitle(workflowName, fallback) {
  const today = new Date().toISOString().slice(0, 10);
  return `${workflowName || fallback} · ${today}`;
}

export default function StartRunDialog({ workflow, busy, onClose, onConfirm }) {
  const t = useEp();
  const [title, setTitle] = useState(() => defaultRunTitle(workflow?.name, t('startRun.defaultWorkflow')));
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(defaultRunTitle(workflow?.name, t('startRun.defaultWorkflow')));
    setError('');
  }, [workflow?.id, workflow?.name, t]);

  if (!workflow) return null;

  function submit(event) {
    event.preventDefault();
    const name = title.trim();
    if (!name) {
      setError(t('startRun.titleRequired'));
      return;
    }
    if (name.length > 220) {
      setError(t('startRun.titleTooLong'));
      return;
    }
    onConfirm(name);
  }

  const number = workflow.workflow_number ? ` (${workflow.workflow_number})` : '';

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="start-run-title">
        <h2 id="start-run-title">{t('startRun.title')}</h2>
        <p className="muted">
          {t('startRun.hint', { number })}
          {(workflow.related_people || []).length > 0 ? t('startRun.related') : ''}
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            {t('startRun.titleLabel')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={220}
              autoFocus
              disabled={busy}
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="task-actions">
            <button type="button" className="button button-light" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="button button-primary" disabled={busy || !title.trim()}>
              <Play size={16} /> {t('startRun.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
