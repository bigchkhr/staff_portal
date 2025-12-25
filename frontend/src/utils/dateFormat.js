/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm 格式
 * @param {string|Date} date - ISO 日期字符串或 Date 對象
 * @returns {string} 格式化後的日期時間字符串，格式：YYYY-MM-DD HH:mm
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // 檢查日期是否有效
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    // 獲取本地時間的各個部分
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('日期格式化錯誤:', error);
    return '-';
  }
};

/**
 * 格式化日期為 YYYY-MM-DD 格式（不包含時間）
 * @param {string|Date} date - ISO 日期字符串或 Date 對象
 * @returns {string} 格式化後的日期字符串，格式：YYYY-MM-DD
 */
export const formatDate = (date) => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // 檢查日期是否有效
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('日期格式化錯誤:', error);
    return '-';
  }
};

