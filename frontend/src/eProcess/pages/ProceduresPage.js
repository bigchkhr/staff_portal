import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from '../icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';

const PAGE_SIZE = 10;

function apiMessage(err, fallback) {
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

export default function ProceduresPage() {
  const { t } = useTranslation();
  const [procedures, setProcedures] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [canCreate, setCanCreate] = useState(false);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function load(nextPage = page, nextQuery = appliedQuery, selectedGroupId = groupId) {
    setLoading(true);
    setMessage('');
    try {
      const params = { page: nextPage, limit: PAGE_SIZE };
      if (nextQuery) params.q = nextQuery;
      if (selectedGroupId) params.group_id = selectedGroupId;
      const { data } = await api.get('/procedures', { params });
      setProcedures(data.procedures || []);
      setCanCreate(Boolean(data.canCreate));
      setPagination(data.pagination || { page: nextPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (err) {
      setMessage(apiMessage(err, t('eProcess.procedures.loadFailed')));
      setProcedures([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get('/groups').then(({ data }) => {
      const list = (data.groups || []).filter((group) => group.kind !== 'user');
      setGroups(list);
      const fromQuery = searchParams.get('group');
      if (fromQuery && list.some((group) => group.id === fromQuery)) setGroupId(fromQuery);
    }).catch(() => setMessage(t('eProcess.common.failedLoadGroups')));
  }, [searchParams]);

  useEffect(() => {
    load(page, appliedQuery, groupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedQuery, groupId]);

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

  async function deleteProcedure(event, procedure) {
    event.stopPropagation();
    if (!window.confirm(t('eProcess.common.deleteNamed', { name: procedure.name }))) return;
    try {
      await api.delete(`/procedures/${procedure.id}`);
      const nextPage = procedures.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      await load(nextPage, appliedQuery, groupId);
    } catch (err) {
      setMessage(apiMessage(err, t('eProcess.procedures.deleteFailed')));
    }
  }

  const total = pagination.total || 0;
  const totalPages = Math.max(1, pagination.totalPages || 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('eProcessNav.procedures')}</h1>
          <p>{t('eProcess.procedures.hint')}</p>
        </div>
        <div className="toolbar-actions">
          <select
            value={groupId}
            onChange={(e) => {
              setPage(1);
              setGroupId(e.target.value);
            }}
            aria-label={t('eProcess.procedures.filter')}
          >
            <option value="">{t('eProcess.procedures.allRead')}</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          {canCreate && (
            <button
              className="button button-primary"
              onClick={() => navigate(`/e-process/procedures/new${groupId ? `?group=${encodeURIComponent(groupId)}` : ''}`)}
            >
              <Plus size={17} /> {t('eProcess.procedures.new')}
            </button>
          )}
        </div>
      </header>

      <form className={`search-bar ${query ? 'has-value' : ''}`} onSubmit={submitSearch}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('eProcess.procedures.searchPlaceholder')}
          aria-label={t('eProcess.procedures.searchLabel')}
        />
        {query ? (
          <button type="button" className="search-bar-clear" title={t('eProcess.common.clear')} onClick={clearSearch}>
            <X size={14} />
          </button>
        ) : null}
        <button type="submit" className="button button-primary search-bar-submit">{t('eProcess.common.search')}</button>
      </form>

      {message && <div className="alert error">{message}</div>}

      {loading ? (
        <div className="skeleton-block" />
      ) : procedures.length === 0 ? (
        <div className="empty-card">
          <BookOpen size={34} />
          <h2>{appliedQuery ? t('eProcess.procedures.noMatch', { query: appliedQuery }) : t('eProcess.procedures.emptyTitle')}</h2>
          <p>{t('eProcess.procedures.emptyHint')}</p>
        </div>
      ) : (
        <section className="panel">
          <div className="group-list">
            {procedures.map((procedure) => {
              const audience = procedure.audience === 'user_groups'
                ? (procedure.audience_groups || []).map((group) => group.name).join(', ') || t('eProcess.common.userGroups')
                : t('eProcess.common.everyone');
              return (
                <article
                  className="group-row"
                  key={procedure.id}
                  onClick={() => navigate(`/e-process/procedures/${procedure.id}`)}
                >
                  <div className="group-row-main">
                    <strong>{procedure.name}</strong>
                    <dl className="assignment-facts">
                      <div>
                        <dt>{t('eProcess.common.group')}</dt>
                        <dd>{procedure.group_name || '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('eProcess.common.steps')}</dt>
                        <dd>{procedure.step_count}</dd>
                      </div>
                      <div>
                        <dt>{t('eProcess.common.readers')}</dt>
                        <dd>{audience}</dd>
                      </div>
                      <div>
                        <dt>{t('eProcess.common.status')}</dt>
                        <dd><StatusBadge status={procedure.status} /></dd>
                      </div>
                    </dl>
                  </div>
                  {procedure.canDelete && (
                    <button
                      type="button"
                      className="button button-danger small"
                      onClick={(event) => deleteProcedure(event, procedure)}
                    >
                      <Trash2 size={15} /> {t('eProcess.common.delete')}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          {total > 0 && (
            <div className="pager">
              <span className="muted">{t('eProcess.common.rangeOf', { start: rangeStart, end: rangeEnd, total })}</span>
              <div className="toolbar-actions">
                <button type="button" className="button button-light small" disabled={!canPrev} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft size={15} /> {t('eProcess.common.prev')}
                </button>
                <span className="pager-page">{t('eProcess.common.pageOf', { page, pages: totalPages })}</span>
                <button type="button" className="button button-light small" disabled={!canNext} onClick={() => setPage((current) => current + 1)}>
                  {t('eProcess.common.next')} <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
