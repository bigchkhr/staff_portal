import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, CircleDot, PlaySquare, Workflow } from '../icons';
import { Link } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    api.get('/dashboard').then((response) => setData(response.data));
  }, []);

  if (!data) return <div className="page"><div className="skeleton-block" /></div>;

  const cards = [
    { key: 'workflows', value: data.workflowStats.total, icon: Workflow },
    { key: 'activeRuns', value: data.runStats.active, icon: PlaySquare },
    { key: 'pendingTasks', value: data.taskStats.pending, icon: CircleDot },
    { key: 'completedRuns', value: data.runStats.completed, icon: CheckCircle2 }
  ];

  return (
    <div className="page">
      <header className="page-header"><div><h1>{t('eProcessNav.dashboard')}</h1><p>{data.isSupervisor ? t('eProcess.dashboard.supervisor') : t('eProcess.dashboard.member')}</p></div></header>
      <section className="stats-grid">
        {cards.map(({ key, value, icon: Icon }) => <div className="stat-card" key={key}><Icon size={22} /><span>{t(`eProcess.dashboard.${key}`)}</span><strong>{value}</strong></div>)}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>{t('eProcess.dashboard.recent')}</h2><p>{t('eProcess.dashboard.recentHint')}</p></div><Link className="button button-light" to="/e-process/runs">{t('eProcess.dashboard.viewAll')}</Link></div>
        {data.recentRuns.length === 0 ? <div className="empty-state">{t('eProcess.dashboard.empty')}</div> : (
          <div className="table-list">
            {data.recentRuns.map((run) => {
              const isOpen = expanded.has(run.id);
              const moreFacts = [
                run.group_name && [t('eProcess.common.group'), run.group_name],
                [t('eProcess.common.workflow'), run.workflow_number ? `${run.workflow_name} (${run.workflow_number})` : run.workflow_name],
              ].filter(Boolean);
              return (
                <article
                  className={`table-row assignment-card${isOpen ? ' is-open' : ''}`}
                  key={run.id}
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(run.id)) next.delete(run.id);
                      else next.add(run.id);
                      return next;
                    });
                  }}
                >
                  <div className="assignment-card-main">
                    <strong>
                      {run.name}
                      <ChevronDown size={16} className="assignment-chevron" aria-hidden="true" />
                    </strong>
                    <dl className="assignment-facts">
                      {run.run_number && (
                        <div>
                          <dt>{t('eProcess.dashboard.runNo')}</dt>
                          <dd>{run.run_number}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <Link
                    className="button button-primary small assignment-open"
                    to={`/e-process/runs/${run.id}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {t('eProcess.dashboard.open')}
                  </Link>
                  <div className="assignment-warnings">
                    <StatusBadge status={run.status} />
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
