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
    // 處理 Rate Limit 錯誤 (429)
    if (error.response?.status === 429) {
      const defaultMessage = '請求過於頻繁，請稍後再試';
      let errorMessage = defaultMessage;
      
      // 安全地讀取錯誤訊息
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data || defaultMessage;
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.message || error.response.data.error || defaultMessage;
        }
      }
      
      // 安全地設置錯誤訊息，避免修改只讀對象
      // 使用 try-catch 包裹，如果無法修改就不修改
      try {
        // 檢查 data 是否為對象且可寫
        if (error.response.data && typeof error.response.data === 'object') {
          // 嘗試使用 Object.assign（更安全）
          if (!error.response.data.message) {
            Object.assign(error.response.data, { message: errorMessage });
          }
        } else {
          // 如果 data 是字符串或不存在，創建新對象
          error.response.data = { message: errorMessage };
        }
      } catch (e) {
        // 如果無法修改，記錄警告但繼續處理
        // 後續代碼會從 error.response.data.message 讀取，如果沒有則使用默認值
        console.warn('Rate limit exceeded (response data may be read-only):', errorMessage);
      }
      
      console.warn('Rate limit exceeded:', errorMessage);
    }
    
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

