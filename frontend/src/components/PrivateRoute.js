import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

const PrivateRoute = ({ children }) => {
  const { user, loading, forcePasswordChange } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>載入中...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 如果需要強制更改密碼，且不在更改密碼頁面，則重定向到更改密碼頁面
  if (forcePasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Layout>{children}</Layout>;
};

export default PrivateRoute;

