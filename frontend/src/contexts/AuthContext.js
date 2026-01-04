import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (employee_number, password) => {
    try {
      console.log('Frontend: Attempting login with employee_number:', employee_number);
      const response = await axios.post('/api/auth/login', { employee_number, password });
      console.log('Frontend: Login response received:', response.data);
      const { token, user } = response.data;
      
      if (!token) {
        console.error('Frontend: No token in response');
        return {
          success: false,
          message: '登入失敗：未收到認證令牌'
        };
      }
      
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      console.log('Frontend: Login successful');
      return { success: true };
    } catch (error) {
      console.error('Frontend: Login error:', error);
      console.error('Frontend: Error response:', error.response?.data);
      console.error('Frontend: Error status:', error.response?.status);
      
      // 優先顯示後端返回的錯誤訊息
      let errorMessage = '登入失敗，請檢查員工編號和密碼';
      
      if (error.response?.status === 429) {
        // Rate limit 錯誤
        errorMessage = error.response?.data?.message || '登入嘗試次數過多，請 15 分鐘後再試';
      } else if (error.response?.data?.message) {
        // 其他後端錯誤訊息
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put('/api/auth/change-password', { currentPassword, newPassword });
      // 重新獲取用戶信息以更新force_password_change狀態
      await fetchCurrentUser();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || '更改密碼失敗'
      };
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    changePassword,
    isDeactivated: !!user?.deactivated,
    isSystemAdmin: user?.is_system_admin,
    isDeptHead: user?.is_dept_head,
    forcePasswordChange: !!user?.force_password_change
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

