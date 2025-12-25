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
import ChangePassword from './pages/ChangePassword';
import HRDocumentUpload from './pages/HRDocumentUpload';
import EmployeeDocuments from './pages/EmployeeDocuments';
import FormLibrary from './pages/FormLibrary';
import DepartmentGroupBalances from './pages/DepartmentGroupBalances';

// 設定後端 API 地址
axios.defaults.baseURL = 'http://localhost:8080';

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
            <Route path="/leave/apply" element={<PrivateRoute><LeaveApplication /></PrivateRoute>} />
            <Route path="/leave/history" element={<PrivateRoute><LeaveHistory /></PrivateRoute>} />
            <Route path="/leave/balance" element={<PrivateRoute><LeaveBalance /></PrivateRoute>} />
            <Route path="/approval/list" element={<PrivateRoute><ApprovalList /></PrivateRoute>} />
            <Route path="/approval/history" element={<PrivateRoute><ApprovalHistory /></PrivateRoute>} />
            <Route path="/approval/:id" element={<PrivateRoute><ApprovalDetail /></PrivateRoute>} />
            <Route path="/admin/paper-flow" element={<PrivateRoute><AdminPaperFlow /></PrivateRoute>} />
            <Route path="/admin/users" element={<PrivateRoute><AdminUsers /></PrivateRoute>} />
            <Route path="/admin/leave-types" element={<PrivateRoute><AdminLeaveTypes /></PrivateRoute>} />
            <Route path="/admin/balances" element={<PrivateRoute><AdminBalances /></PrivateRoute>} />
            <Route path="/admin/departments" element={<PrivateRoute><AdminDepartments /></PrivateRoute>} />
            <Route path="/admin/positions" element={<PrivateRoute><AdminPositions /></PrivateRoute>} />
            <Route path="/admin/groups" element={<PrivateRoute><AdminGroups /></PrivateRoute>} />
            <Route path="/documents/upload" element={<PrivateRoute><HRDocumentUpload /></PrivateRoute>} />
            <Route path="/documents/my" element={<PrivateRoute><EmployeeDocuments /></PrivateRoute>} />
            <Route path="/form-library" element={<PrivateRoute><FormLibrary /></PrivateRoute>} />
            <Route path="/department-group-balances" element={<PrivateRoute><DepartmentGroupBalances /></PrivateRoute>} />
            <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

