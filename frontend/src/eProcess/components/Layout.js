import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Inbox, LayoutDashboard, Menu, PlaySquare, Users, Workflow, X } from '../icons';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { api } from '../api';

const BASE = '/e-process';
const PENDING_POLL_MS = 45000;

function formatPendingBadge(count) {
  if (count > 99) return '99+';
  return String(count);
}

export default function Layout() {
  const { t } = useTranslation();
  const isCompact = useMediaQuery('(max-width: 900px)');
  const location = useLocation();
  const [navOpen, setNavOpen] = React.useState(false);
  const [pendingAssignmentCount, setPendingAssignmentCount] = React.useState(0);

  const items = [
    { to: BASE, end: true, icon: LayoutDashboard, label: t('eProcessNav.dashboard') },
    { to: `${BASE}/assignments`, icon: Inbox, label: t('eProcessNav.assignments'), badge: true },
    { to: `${BASE}/groups`, icon: Users, label: t('eProcessNav.groups') },
    { to: `${BASE}/procedures`, icon: BookOpen, label: t('eProcessNav.procedures') },
    { to: `${BASE}/workflows`, icon: Workflow, label: t('eProcessNav.workflows') },
    { to: `${BASE}/runs`, icon: PlaySquare, label: t('eProcessNav.runs') },
  ];

  React.useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isCompact) setNavOpen(false);
  }, [isCompact]);

  React.useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadPendingCount() {
      try {
        const { data } = await api.get('/runs/mine/assignments/pending-count');
        if (!cancelled) setPendingAssignmentCount(Number(data?.pendingCount || 0));
      } catch {
        if (!cancelled) setPendingAssignmentCount(0);
      }
    }

    loadPendingCount();
    const timer = window.setInterval(loadPendingCount, PENDING_POLL_MS);
    const onFocus = () => loadPendingCount();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [location.pathname]);

  const sectionTitle = items.find((item) => (
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  ))?.label || t('eProcessNav.dashboard');

  const links = (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} end={item.end}>
            <Icon size={18} />
            <span>{item.label}</span>
            {item.badge && pendingAssignmentCount > 0 && (
              <span
                className="nav-count-badge"
                aria-label={t('eProcessNav.pendingCount', { count: pendingAssignmentCount })}
              >
                {formatPendingBadge(pendingAssignmentCount)}
              </span>
            )}
          </NavLink>
        );
      })}
    </>
  );

  return (
    <div className={`app-shell${navOpen ? ' nav-open' : ''}${isCompact ? ' is-compact' : ''}`}>
      <header className="topbar">
        {isCompact && (
          <button
            type="button"
            className="icon-button mobile-menu-button"
            aria-label={navOpen ? t('eProcessNav.closeMenu') : t('eProcessNav.openMenu')}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((open) => !open)}
          >
            {navOpen ? <X size={22} /> : <Menu size={22} />}
            {!navOpen && pendingAssignmentCount > 0 && (
              <span className="nav-count-badge nav-count-badge-dot" aria-hidden="true">
                {formatPendingBadge(pendingAssignmentCount)}
              </span>
            )}
          </button>
        )}
        {isCompact && (
          <div className="brand">
            <span className="brand-label">{sectionTitle}</span>
          </div>
        )}
        {!isCompact && <nav>{links}</nav>}
      </header>
      {isCompact && navOpen && (
        <>
          <button
            type="button"
            className="nav-backdrop"
            aria-label={t('eProcessNav.closeMenu')}
            onClick={() => setNavOpen(false)}
          />
          <nav className="topnav-panel" onClick={(event) => { if (event.target.closest('a, button')) setNavOpen(false); }}>
            <button type="button" className="icon-button topnav-close" aria-label={t('eProcessNav.closeMenu')}>
              <X size={22} />
            </button>
            {links}
          </nav>
        </>
      )}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
