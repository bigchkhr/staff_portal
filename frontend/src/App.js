import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import axios from 'axios';
import './i18n/config';
import './utils/axiosConfig';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeaveApplication from './pages/LeaveApplication';
import LeaveHistory from './pages/LeaveHistory';
import LeaveBalance from './pages/LeaveBalance';
import ExtraWorkingHoursApplication from './pages/ExtraWorkingHoursApplication';
import ExtraWorkingHoursHistory from './pages/ExtraWorkingHoursHistory';
import OutdoorWorkApplication from './pages/OutdoorWorkApplication';
import OutdoorWorkHistory from './pages/OutdoorWorkHistory';
import ApprovalList from './pages/ApprovalList';
import ApprovalDetail from './pages/ApprovalDetail';
import ApprovalHistory from './pages/ApprovalHistory';
import AdminUsers from './pages/AdminUsers';
import AdminLeaveTypes from './pages/AdminLeaveTypes';
import AdminBalances from './pages/AdminBalances';
import AdminDepartments from './pages/AdminDepartments';
import AdminPositions from './pages/AdminPositions';
import AdminGroups from './pages/AdminGroups';
import AdminPaperFlow from './pages/AdminPaperFlow';
import AdminExtraWorkingHoursPaperFlow from './pages/AdminExtraWorkingHoursPaperFlow';
import AdminOutdoorWorkPaperFlow from './pages/AdminOutdoorWorkPaperFlow';
import ChangePassword from './pages/ChangePassword';
import HRDocumentUpload from './pages/HRDocumentUpload';
import EmployeeDocuments from './pages/EmployeeDocuments';
import FormLibrary from './pages/FormLibrary';
import DepartmentGroupBalances from './pages/DepartmentGroupBalances';
import MyApplications from './pages/MyApplications';
import MyApprovals from './pages/MyApprovals';
import SystemMaintenance from './pages/SystemMaintenance';
import ManualApproval from './pages/ManualApproval';
import PublicHolidayManagement from './pages/PublicHolidayManagement';
import ExternalLinks from './pages/ExternalLinks';
import Tools from './pages/Tools';
import GroupContacts from './pages/GroupContacts';
import Schedule from './pages/Schedule';
import GroupLeaveCalendar from './pages/GroupLeaveCalendar';
import Attendance from './pages/Attendance';
import ShiftManagement from './pages/ShiftManagement';
import MyRoster from './pages/MyRoster';
import MyAttendance from './pages/MyAttendance';

// 設定後端 API 地址
// axios.defaults.baseURL = 'http://3.1.139.29:1689';
// axios.defaults.baseURL = 'http://localhost:1689';
axios.defaults.baseURL = 'http://172.31.132.13:1689';
// axios.defaults.baseURL = 'http://192.168.3.4:1689';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/my-applications" element={<PrivateRoute><MyApplications /></PrivateRoute>} />
            <Route path="/my-approvals" element={<PrivateRoute><MyApprovals /></PrivateRoute>} />
            <Route path="/system-maintenance" element={<PrivateRoute><SystemMaintenance /></PrivateRoute>} />
            <Route path="/manual-approval" element={<PrivateRoute><ManualApproval /></PrivateRoute>} />
            <Route path="/admin/public-holidays" element={<PrivateRoute><PublicHolidayManagement /></PrivateRoute>} />
            <Route path="/leave/apply" element={<PrivateRoute><LeaveApplication /></PrivateRoute>} />
            <Route path="/leave/history" element={<PrivateRoute><LeaveHistory /></PrivateRoute>} />
            <Route path="/leave/balance" element={<PrivateRoute><LeaveBalance /></PrivateRoute>} />
            <Route path="/extra-working-hours/apply" element={<PrivateRoute><ExtraWorkingHoursApplication /></PrivateRoute>} />
            <Route path="/extra-working-hours/history" element={<PrivateRoute><ExtraWorkingHoursHistory /></PrivateRoute>} />
            <Route path="/outdoor-work/apply" element={<PrivateRoute><OutdoorWorkApplication /></PrivateRoute>} />
            <Route path="/outdoor-work/history" element={<PrivateRoute><OutdoorWorkHistory /></PrivateRoute>} />
            <Route path="/approval/list" element={<PrivateRoute><ApprovalList /></PrivateRoute>} />
            <Route path="/approval/history" element={<PrivateRoute><ApprovalHistory /></PrivateRoute>} />
            <Route path="/approval/:id" element={<PrivateRoute><ApprovalDetail /></PrivateRoute>} />
            <Route path="/admin/paper-flow" element={<PrivateRoute><AdminPaperFlow /></PrivateRoute>} />
            <Route path="/admin/extra-working-hours-paper-flow" element={<PrivateRoute><AdminExtraWorkingHoursPaperFlow /></PrivateRoute>} />
            <Route path="/admin/outdoor-work-paper-flow" element={<PrivateRoute><AdminOutdoorWorkPaperFlow /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute><AdminUsers /></PrivateRoute>} />
            <Route path="/admin/leave-types" element={<PrivateRoute><AdminLeaveTypes /></PrivateRoute>} />
            <Route path="/admin/balances" element={<PrivateRoute><AdminBalances /></PrivateRoute>} />
            <Route path="/admin/departments" element={<PrivateRoute><AdminDepartments /></PrivateRoute>} />
            <Route path="/admin/positions" element={<PrivateRoute><AdminPositions /></PrivateRoute>} />
            <Route path="/admin/groups" element={<PrivateRoute><AdminGroups /></PrivateRoute>} />
            <Route path="/documents/upload" element={<PrivateRoute><HRDocumentUpload /></PrivateRoute>} />
            <Route path="/documents/my" element={<PrivateRoute><EmployeeDocuments /></PrivateRoute>} />
            <Route path="/tools" element={<PrivateRoute><Tools /></PrivateRoute>} />
            <Route path="/group-contacts" element={<PrivateRoute><GroupContacts /></PrivateRoute>} />
            <Route path="/form-library" element={<PrivateRoute><FormLibrary /></PrivateRoute>} />
            <Route path="/external-links" element={<PrivateRoute><ExternalLinks /></PrivateRoute>} />
            <Route path="/department-group-balances" element={<PrivateRoute><DepartmentGroupBalances /></PrivateRoute>} />
            <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
            <Route path="/schedule" element={<PrivateRoute><Schedule /></PrivateRoute>} />
            <Route path="/group-leave-calendar" element={<PrivateRoute><GroupLeaveCalendar /></PrivateRoute>} />
            <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
            <Route path="/shift-management" element={<PrivateRoute><ShiftManagement /></PrivateRoute>} />
            <Route path="/my-roster" element={<PrivateRoute><MyRoster /></PrivateRoute>} />
            <Route path="/my-attendance" element={<PrivateRoute><MyAttendance /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

