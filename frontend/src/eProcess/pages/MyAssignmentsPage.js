import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, Inbox, Search, X } from '../icons';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { formatDateHkt, formatDateTimeHkt, personWithEmployeeNumber } from '../utils/datetime';
import { ep } from '../useEp';

function stepLabel(position, title, stepCount) {
  const name = title || ep('assignments.untitledStep');
  const index = Number(position);
  if (!Number.isFinite(index)) return name;
  const total = Number(stepCount);
  const place = total > 0 ? ep('assignments.stepOf', { place: index + 1, total }) : String(index + 1);
  return `${place}. ${name}`;
}

function statusWord(status) {
  return ep(`status.${status}`, { defaultValue: String(status || '').replace(/_/g, ' ') });
}

export default function MyAssignmentsPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  async function load({ q = appliedQuery, sortBy = sort, sortOrder = order } = {}) {
    setLoading(true);
    setError('');
    try {
      const params = { sort: sortBy, order: sortOrder };
      if (q) params.q = q;
      const { data } = await api.get('/runs/mine/assignments', { params });
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err.response?.data?.message || t('eProcess.assignments.loadFailed'));
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ q: appliedQuery, sortBy: sort, sortOrder: order });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedQuery, sort, order]);

  function submitSearch(event) {
    event?.preventDefault();
    setAppliedQuery(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setAppliedQuery('');
  }

  function toggleOrder() {
    setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  function toggleCard(taskId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {t('eProcessNav.assignments')}
            {!loading && tasks.length > 0 ? (
              <span className="page-count-badge" aria-label={t('eProcess.assignments.openCount', { count: tasks.length })}>
                {tasks.length > 99 ? '99+' : tasks.length}
              </span>
            ) : null}
          </h1>
          <p>{t('eProcess.assignments.hint')}</p>
        </div>
      </header>

      <form className={`search-bar ${query ? 'has-value' : ''}`} onSubmit={submitSearch}>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('eProcess.assignments.searchPlaceholder')}
          aria-label={t('eProcess.assignments.searchLabel')}
        />
        {query ? (
          <button type="button" className="search-bar-clear" title={t('eProcess.common.clear')} onClick={clearSearch}>
            <X size={14} />
          </button>
        ) : null}
        <button type="submit" className="button button-primary search-bar-submit">{t('eProcess.common.search')}</button>
      </form>

      <div className="assignments-toolbar">
        <label>
          {t('eProcess.assignments.orderBy')}
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('eProcess.assignments.sortField')}>
            <option value="date">{t('eProcess.assignments.date')}</option>
            <option value="status">{t('eProcess.assignments.status')}</option>
          </select>
        </label>
        <button
          type="button"
          className="button button-light small"
          onClick={toggleOrder}
          title={order === 'asc' ? t('eProcess.assignments.ascending') : t('eProcess.assignments.descending')}
        >
          {order === 'asc' ? <ArrowUpAZ size={15} /> : <ArrowDownAZ size={15} />}
          {order === 'asc' ? t('eProcess.assignments.asc') : t('eProcess.assignments.desc')}
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}
      <section className="panel">
        {loading ? (
          <div className="skeleton-block" style={{ minHeight: 160 }} />
        ) : tasks.length === 0 ? (
          <div className="empty-state">
            <Inbox size={28} />
            <p>
              {appliedQuery
                ? t('eProcess.assignments.noMatch', { query: appliedQuery })
                : t('eProcess.assignments.empty')}
            </p>
          </div>
        ) : (
          <div className="table-list">
            {tasks.map((task) => {
              const updated = task.updated_at_hkt || (task.updated_at ? formatDateTimeHkt(task.updated_at) : '');
              const fromName = task.assigned_by_name || task.assigned_by_username
                ? personWithEmployeeNumber(task.assigned_by_name, task.assigned_by_username)
                : '';
              const nowIsYours = !task.current_step_id
                || String(task.current_step_id) === String(task.task_id);
              const nowLabel = task.current_step_id
                ? stepLabel(task.current_step_position, task.current_step_title, task.step_count)
                : stepLabel(task.position, task.title, task.step_count);
              const nowAssignee = !nowIsYours && task.current_step_assigned_to
                && String(task.current_step_assigned_to) !== String(task.assigned_to)
                ? personWithEmployeeNumber(task.current_step_assigned_to_name, task.current_step_assigned_to_username)
                : '';
              const nowValue = [
                nowLabel,
                !nowIsYours && task.current_step_status && statusWord(task.current_step_status),
                nowAssignee,
              ].filter(Boolean).join(' · ');
              const runFacts = [
                task.run_number && [t('eProcess.assignments.runNo'), task.run_number],
                [t('eProcess.assignments.now'), nowValue],
                !nowIsYours && [t('eProcess.assignments.yourNext'), stepLabel(task.position, task.title, task.step_count)],
              ].filter(Boolean);
              const moreFacts = [
                task.group_name && [t('eProcess.common.group'), task.group_name],
                [t('eProcess.common.workflow'), task.workflow_number ? `${task.workflow_name} (${task.workflow_number})` : task.workflow_name],
                task.type && [nowIsYours ? t('eProcess.assignments.type') : t('eProcess.assignments.yourStepType'), t(`eProcess.types.${task.type}`, { defaultValue: task.type })],
                task.end_date && [nowIsYours ? t('eProcess.assignments.endDate') : t('eProcess.assignments.yourStepEnd'), formatDateHkt(task.end_date)],
                updated && [t('eProcess.assignments.updated'), updated],
                fromName && [t('eProcess.assignments.from'), fromName],
              ].filter(Boolean);
              const isOpen = expanded.has(task.task_id);

              return (
                <article
                  className={`table-row assignment-card${isOpen ? ' is-open' : ''}`}
                  key={task.task_id}
                  onClick={() => toggleCard(task.task_id)}
                >
                  <div className="assignment-card-main">
                    <strong>
                      {task.run_name}
                      <ChevronDown size={16} className="assignment-chevron" aria-hidden="true" />
                    </strong>
                    <dl className="assignment-facts">
                      {runFacts.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <Link
                    className="button button-primary small assignment-open"
                    to={`/e-process/runs/${task.run_id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('eProcess.common.open')}
                  </Link>
                  <div className="assignment-warnings">
                    {task.is_overdue && <StatusBadge status="overdue" />}
                    <StatusBadge status={task.assignment_status === 'pending' ? 'assignment_pending' : task.status} />
                  </div>
                  <div className={`assignment-card-more${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
                    <div className="assignment-card-more-inner">
                      <dl className="assignment-facts">
                        {moreFacts.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
