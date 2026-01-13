/**
 * 假期時段計算工具函數
 * 根據申請假期頁面的邏輯，精確計算全天或半天假
 */

/**
 * 計算指定日期在假期申請中的時段（AM/PM/null）
 * 邏輯與後端 LeaveApplication.getSessionForDate 保持一致
 * 
 * @param {Object} leaveApplication - 假期申請對象
 * @param {string} targetDateStr - 目標日期字符串 (YYYY-MM-DD)
 * @returns {string|null} 'AM' | 'PM' | null (全天假)
 */
export const getSessionForDate = (leaveApplication, targetDateStr) => {
  if (!leaveApplication || !targetDateStr) {
    return null;
  }

  // 格式化日期字符串為 YYYY-MM-DD 格式
  const formatDate = (date) => {
    if (!date) return null;
    
    // 如果是 Date 對象
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // 如果是字符串
    if (typeof date === 'string') {
      // 移除時間部分，只保留日期部分
      let datePart = date.split('T')[0].split(' ')[0];
      // 確保格式是 YYYY-MM-DD
      if (datePart.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }
      // 如果是其他格式，嘗試解析
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    return null;
  };

  const startDateStr = formatDate(leaveApplication.start_date);
  const endDateStr = formatDate(leaveApplication.end_date);
  const startSession = leaveApplication.start_session;
  const endSession = leaveApplication.end_session;

  // 確保目標日期格式一致（移除可能的時間部分）
  let normalizedTargetDate = targetDateStr;
  if (typeof targetDateStr === 'string') {
    normalizedTargetDate = targetDateStr.split('T')[0].split(' ')[0];
    // 確保格式是 YYYY-MM-DD
    if (normalizedTargetDate.length > 10) {
      normalizedTargetDate = normalizedTargetDate.substring(0, 10);
    }
  }
  
  const normalizedStartDate = startDateStr;
  const normalizedEndDate = endDateStr;

  // 確保目標日期在假期範圍內
  if (!normalizedStartDate || !normalizedEndDate || normalizedTargetDate < normalizedStartDate || normalizedTargetDate > normalizedEndDate) {
    return null;
  }

  // 單一申請（同一天）
  if (normalizedStartDate === normalizedEndDate) {
    // 如果 start_session 和 end_session 都是 'AM'，顯示上午假
    if (startSession === 'AM' && endSession === 'AM') {
      return 'AM';
    }
    // 如果 start_session 和 end_session 都是 'PM'，顯示下午假
    if (startSession === 'PM' && endSession === 'PM') {
      return 'PM';
    }
    // 其他情況（null-null 或 AM-PM）：全天假，不顯示 session
    return null;
  }

  // 跨日假期（一連串假期）
  // 根據申請假期頁面的邏輯：
  // - 開始上午 + 結束下午 = 整數（第一天和最後一天都是全天假）
  // - 開始上午 + 結束上午 = 整數 - 0.5（第一天全天假，最後一天上午假）
  // - 開始下午 + 結束下午 = 整數 - 0.5（第一天下午假，最後一天全天假）
  // - 開始下午 + 結束上午 = 整數 - 1（第一天下午假，最後一天上午假）
  if (normalizedTargetDate === normalizedStartDate) {
    // 第一天：只有當 start_session 是 'PM' 時，顯示下午假；否則顯示全天假
    if (startSession === 'PM') {
      return 'PM';
    }
    // 如果 start_session 是 'AM' 或 null，顯示全天假
    return null;
  } else if (normalizedTargetDate === normalizedEndDate) {
    // 最後一天：只有當 end_session 是 'AM' 時，顯示上午假；否則顯示全天假
    if (endSession === 'AM') {
      return 'AM';
    }
    // 如果 end_session 是 'PM' 或 null，顯示全天假
    return null;
  } else {
    // 中間日期：全天假，不顯示 session
    return null;
  }
};

/**
 * 將 session 轉換為 is_morning_leave 和 is_afternoon_leave 標記
 * 用於兼容群組假期週曆的顯示邏輯
 * 
 * @param {string|null} session - 'AM' | 'PM' | null
 * @returns {Object} { isMorning: boolean, isAfternoon: boolean }
 */
export const sessionToFlags = (session) => {
  if (session === 'AM') {
    return { isMorning: true, isAfternoon: false };
  } else if (session === 'PM') {
    return { isMorning: false, isAfternoon: true };
  } else {
    // null 表示全天假
    return { isMorning: true, isAfternoon: true };
  }
};

/**
 * 獲取假期時段的顯示文字
 * 
 * @param {string|null} session - 'AM' | 'PM' | null
 * @param {Function} t - 翻譯函數
 * @returns {string} 顯示文字
 */
export const getSessionDisplayText = (session, t) => {
  if (session === 'AM') {
    return t('schedule.morningLeave');
  } else if (session === 'PM') {
    return t('schedule.afternoonLeave');
  } else {
    return t('schedule.fullDayLeave');
  }
};

