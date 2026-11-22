import { useEffect, useMemo, useState } from 'react';
import { ep, useEp } from '../useEp';
import { ChevronLeft, ChevronRight, Download, X } from '../icons';
import { api } from '../api';

function mimeOf(file) {
  return String(file?.mime_type || '').toLowerCase();
}

export function isPreviewImage(file) {
  return mimeOf(file).startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(file?.file_name || ''));
}

export function isPreviewPdf(file) {
  return mimeOf(file) === 'application/pdf' || String(file?.file_name || '').toLowerCase().endsWith('.pdf');
}

export function canPreviewAttachment(file) {
  return isPreviewImage(file) || isPreviewPdf(file);
}

function preferredMime(file, headerType = '') {
  const header = String(headerType || '').split(';')[0].trim().toLowerCase();
  if (header && header !== 'application/json' && header !== 'application/octet-stream') {
    return header;
  }
  if (isPreviewPdf(file)) return 'application/pdf';
  if (isPreviewImage(file)) {
    const name = String(file?.file_name || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.bmp')) return 'image/bmp';
    return mimeOf(file).startsWith('image/') ? mimeOf(file) : 'image/jpeg';
  }
  return header || mimeOf(file) || 'application/octet-stream';
}

/**
 * Modal for e-process attachments / procedure files.
 * Images carousel across the provided list; PDF previews one file via blob URL.
 */
export default function AttachmentPreviewModal({
  open,
  onClose,
  files = [],
  initialIndex = 0,
  fetchBlob,
  onDownload,
  title,
}) {
  const t = useEp();
  const heading = title || t('form.preview');
  const list = useMemo(() => (Array.isArray(files) ? files.filter(Boolean) : []), [files]);
  const [index, setIndex] = useState(0);
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(list.length - 1, 0)));
  }, [open, initialIndex, list]);

  const active = list[Math.min(Math.max(index, 0), Math.max(list.length - 1, 0))] || null;
  const activeId = active?.id;
  const showImage = isPreviewImage(active);
  const showPdf = isPreviewPdf(active);
  const canCarousel = list.length > 1;

  useEffect(() => {
    if (!open || !activeId || !fetchBlob || !active) {
      setBlobUrl('');
      setError('');
      return undefined;
    }

    let objectUrl = '';
    let cancelled = false;
    setLoading(true);
    setError('');
    setBlobUrl('');

    fetchBlob(active)
      .then(async (raw) => {
        if (cancelled) return;
        if (!(raw instanceof Blob)) throw new Error(ep('form.previewUnavailable'));

        // API errors often arrive as JSON blobs when responseType is blob.
        const headerGuess = String(raw.type || '').toLowerCase();
        if (headerGuess.includes('json') || headerGuess.includes('text/html')) {
          let message = ep('form.previewUnavailable');
          try {
            const parsed = JSON.parse(await raw.text());
            message = parsed.message || parsed.error || message;
          } catch {
            /* keep default */
          }
          throw new Error(message);
        }

        const type = preferredMime(active, raw.type);
        const blob = raw.type === type ? raw : new Blob([raw], { type });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(async (err) => {
        if (cancelled) return;
        let message = err?.message || ep('form.previewUnavailable');
        const data = err?.response?.data;
        if (data instanceof Blob) {
          try {
            const parsed = JSON.parse(await data.text());
            if (parsed?.message || parsed?.error) message = parsed.message || parsed.error;
          } catch {
            /* keep default */
          }
        } else if (data?.message || data?.error) {
          message = data.message || data.error;
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, activeId, fetchBlob, active]);

  if (!open || !active) return null;

  return (
    <div className="modal-backdrop attachment-preview-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card modal-card-wide attachment-preview-card"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <strong>{active.file_name || heading}</strong>
            {canCarousel ? (
              <span className="muted"> {index + 1} / {list.length}</span>
            ) : null}
          </div>
          <div className="toolbar-actions">
            {canCarousel ? (
              <>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('common.previous')}
                  disabled={index === 0 || loading}
                  onClick={() => setIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('common.next')}
                  disabled={index >= list.length - 1 || loading}
                  onClick={() => setIndex((i) => Math.min(list.length - 1, i + 1))}
                >
                  <ChevronRight size={18} />
                </button>
              </>
            ) : null}
            {onDownload ? (
              <button type="button" className="button button-light small" onClick={() => onDownload(active)}>
                <Download size={15} /> {t('common.download')}
              </button>
            ) : null}
            <button type="button" className="icon-button" aria-label={t('common.close')} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="attachment-preview-body">
          {loading ? <p className="muted">{t('common.loading')}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {!loading && !error && blobUrl && showImage ? (
            <div className="attachment-preview-frame">
              <img src={blobUrl} alt={active.file_name || t('common.attachment')} />
            </div>
          ) : null}
          {!loading && !error && blobUrl && showPdf ? (
            <embed
              className="attachment-preview-pdf"
              type="application/pdf"
              src={`${blobUrl}#toolbar=1&navpanes=0`}
              title={active.file_name || t('common.pdf')}
            />
          ) : null}
          {!loading && !error && blobUrl && !showImage && !showPdf ? (
            <p className="muted">{t('form.previewUnavailable')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export async function fetchApiBlob(url) {
  const res = await api.get(url, { responseType: 'blob' });
  return res.data;
}
