import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Search, X } from '../icons';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { isRunOverdue } from '../utils/datetime';

const PAGE_SIZE = 20;

export default function RunsPage() {
  const { t } = useTranslation();
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  async function load(nextPage = page, nextQuery = appliedQuery) {
    setLoading(true);
    setError('');
    try {
      const params = { page: nextPage, limit: PAGE_SIZE };
      if (nextQuery) params.q = nextQuery;
      const { data } = await api.get('/runs', { params });
      setRuns(data.runs || []);
      setPagination(data.pagination || { page: nextPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.runs.loadFailed'));
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page, appliedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedQuery]);

  function submitSearch(event) {
    event?.preventDefault();
    setPage(1);
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setPage(1);
    setAppliedQuery('');
  }

  function copyReference(event, runId) {
    event.preventDefault();
    event.stopPropagation();
    if (!runId) return;
    navigator.clipboard.writeText(runId).then(() => {
      setCopiedId(runId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === runId ? '' : current));
      }, 1600);
    }).catch(() => {});
  }

  function startRename(event, run) {
    event.preventDefault();
    event.stopPropagation();
    setEditingId(run.id);
    setDraftName(run.name || '');
    setError('');
  }

  function cancelRename(event) {
    event?.preventDefault();
    event?.stopPropagation();
    setEditingId(null);
    setDraftName('');
  }

  async function saveRename(event, runId) {
    event.preventDefault();
    event.stopPropagation();
    const name = draftName.trim();
    if (!name) {
      setError(t('eProcess.runs.nameRequired'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.patch(`/runs/${runId}`, { name });
      setRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, name: data.run.name } : r)));
      setEditingId(null);
      setDraftName('');
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.runs.renameFailed'));
    } finally {
      setBusy(false);
    }
  }

  const total = pagination.total || 0;
  const totalPages = Math.max(1, pagination.totalPages || Math.ceil(total / PAGE_SIZE) || 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('eProcessNav.runs')}</h1>
          <p>{t('eProcess.runs.hint')}</p>
        </div>
      </header>

      <form className={`search-bar ${query ? 'has-value' : ''}`} onSubmit={submitSearch}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('eProcess.runs.searchPlaceholder')}
          aria-label={t('eProcess.runs.searchLabel')}
        />
        {query ? (
          <button type="button" className="search-bar-clear" title={t('eProcess.common.clear')} onClick={clearSearch}>
            <X size={14} />
          </button>
        ) : null}
        <button type="submit" className="button button-primary search-bar-submit">{t('eProcess.common.search')}</button>
      </form>

      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        {loading ? (
          <div className="skeleton-block" style={{ minHeight: 160 }} />
        ) : runs.length === 0 ? (
          <div className="empty-state">
            {appliedQuery ? t('eProcess.runs.noMatch', { query: appliedQuery }) : t('eProcess.runs.empty')}
          </div>
        ) : (
          <div className="table-list">
            {runs.map((run) => {
              const totalTasks = Number(run.total_tasks || 0);
              const completed = Number(run.completed_tasks || 0);
              const progress = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
              const editing = editingId === run.id;
              const overdue = isRunOverdue(run);
              const subtitle = [run.group_name, run.workflow_name].filter(Boolean).join(' · ');

              if (editing) {
                return (
                  <div className="run-row run-row-editing" key={run.id}>
                    <div className="run-copy">
                      <input
                        className="run-rename-input"
                        value={draftName}
                        maxLength={220}
                        autoFocus
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(e, run.id);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                      />
                      <span>{subtitle}</span>
                    </div>
                    <div className="toolbar-actions">
                      <button type="button" className="button button-primary small" disabled={busy} onClick={(e) => saveRename(e, run.id)}>
                        <Check size={15} /> {t('eProcess.common.save')}
                      </button>
                      <button type="button" className="button button-light small" disabled={busy} onClick={cancelRename}>
                        <X size={15} /> {t('eProcess.common.cancel')}
                      </button>
                    </div>
                    {overdue && <StatusBadge status="overdue" />}
                    <StatusBadge status={run.status} />
                  </div>
                );
              }

              return (
                <div className="run-row" key={run.id}>
                  <Link className="run-copy run-copy-link" to={`/e-process/runs/${run.id}`}>
                    <strong>{run.name}</strong>
                    <span>
                      {run.run_number ? `${run.run_number} · ` : ''}
                      {subtitle}
                    </span>
                  </Link>
                  <div className="progress-wrap">
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <span>{progress}%</span>
                  </div>
                  <div className="run-row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title={copiedId === run.id ? t('eProcess.common.copied') : t('eProcess.common.copyReference')}
                      onClick={(e) => copyReference(e, run.id)}
                    >
                      {copiedId === run.id ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      title={t('eProcess.common.renameRun')}
                      onClick={(e) => startRename(e, run)}
                    >
                      <Pencil size={16} />
                    </button>
                    {overdue && <StatusBadge status="overdue" />}
                    <StatusBadge status={run.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && total > 0 && (
          <div className="pager">
            <span className="muted">
              {t('eProcess.common.rangeOf', { start: rangeStart, end: rangeEnd, total })}
            </span>
            <div className="toolbar-actions">
              <button
                type="button"
                className="button button-light small"
                disabled={!canPrev || busy}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={15} /> {t('eProcess.common.prev')}
              </button>
              <span className="pager-page">{t('eProcess.common.pageOf', { page, pages: totalPages })}</span>
              <button
                type="button"
                className="button button-light small"
                disabled={!canNext || busy}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('eProcess.common.next')} <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
