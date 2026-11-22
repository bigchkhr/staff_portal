import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ProceduresPage from './pages/ProceduresPage';
import ProcedureCreatePage from './pages/ProcedureCreatePage';
import ProcedureEditorPage from './pages/ProcedureEditorPage';
import WorkflowsPage from './pages/WorkflowsPage';
import WorkflowCreatePage from './pages/WorkflowCreatePage';
import WorkflowEditorPage from './pages/WorkflowEditorPage';
import RunsPage from './pages/RunsPage';
import RunDetailPage from './pages/RunDetailPage';
import MyAssignmentsPage from './pages/MyAssignmentsPage';
import './styles.css';

/**
 * Standalone E-Process shell (FlowPilot UI).
 * Mounted at /e-process/* outside BOSS Layout so target=_blank feels like a second system.
 */
export default function EProcessApp() {
  React.useEffect(() => {
    const previous = document.title;
    document.title = 'E-Process';
    return () => {
      document.title = previous || 'BOSS';
    };
  }, []);

  return (
    <div className="e-process-root">
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="assignments" element={<MyAssignmentsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/:id" element={<GroupDetailPage />} />
          <Route path="procedures" element={<ProceduresPage />} />
          <Route path="procedures/new" element={<ProcedureCreatePage />} />
          <Route path="procedures/:id" element={<ProcedureEditorPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/new" element={<WorkflowCreatePage />} />
          <Route path="workflows/:id" element={<WorkflowEditorPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="runs/:id" element={<RunDetailPage />} />
          <Route path="*" element={<Navigate to="/e-process" replace />} />
        </Route>
      </Routes>
    </div>
  );
}
