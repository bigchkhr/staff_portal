import { useState } from 'react';
import { Square } from '../icons';
import { useEp } from '../useEp';

export default function EndFlowDialog({ busy, onClose, onConfirm }) {
  const t = useEp();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) {
      setError(t('endFlow.reasonRequired'));
      return;
    }
    if (text.length > 5000) {
      setError(t('endFlow.reasonTooLong'));
      return;
    }
    onConfirm(text);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="end-flow-title">
        <h2 id="end-flow-title">{t('endFlow.title')}</h2>
        <p className="muted">{t('endFlow.hint')}</p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            {t('common.reason')}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('endFlow.placeholder')}
              rows={4}
              autoFocus
              disabled={busy}
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <div className="task-actions">
            <button type="button" className="button button-light" disabled={busy} onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="button button-danger" disabled={busy || !reason.trim()}>
              <Square size={16} /> {t('endFlow.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
