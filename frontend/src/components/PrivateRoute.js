import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from './Layout';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>載入中...</div>;
  }

  return user ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
};

export default PrivateRoute;

