import axios from 'axios';

// 配置 axios 默認值
// baseURL 會在 App.js 中設定

// 設置請求攔截器（如果需要）
axios.interceptors.request.use(
  (config) => {
    // 從 localStorage 獲取 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 設置響應攔截器（處理錯誤）
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 如果 token 過期或無效，清除本地存儲
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      // 可以選擇重定向到登入頁面
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;

