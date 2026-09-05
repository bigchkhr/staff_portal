/**
 * 假期時段計算工具函數
 * 根據申請假期頁面的邏輯，精確計算全天或半天假
 */

import { toHKCalendarDate } from './dateFormat';

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

  const startDateStr = toHKCalendarDate(leaveApplication.start_date);
  const endDateStr = toHKCalendarDate(leaveApplication.end_date);
  const startSession = leaveApplication.start_session;
  const endSession = leaveApplication.end_session;
  const normalizedTargetDate = toHKCalendarDate(targetDateStr);
  const normalizedStartDate = startDateStr;
  const normalizedEndDate = endDateStr;

  if (!normalizedStartDate || !normalizedEndDate || !normalizedTargetDate ||
      normalizedTargetDate < normalizedStartDate || normalizedTargetDate > normalizedEndDate) {
    return null;
  }

  // 單一申請（同一天）
  if (normalizedStartDate === normalizedEndDate) {
    if (startSession === 'AM' && endSession === 'AM') {
      return 'AM';
    }
    if (startSession === 'PM' && endSession === 'PM') {
      return 'PM';
    }
    return null;
  }

  // 跨日假期（一連串假期）
  if (normalizedTargetDate === normalizedStartDate) {
    if (startSession === 'PM') {
      return 'PM';
    }
    return null;
  }
  if (normalizedTargetDate === normalizedEndDate) {
    if (endSession === 'AM') {
      return 'AM';
    }
    return null;
  }
  return null;
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
  }
  if (session === 'PM') {
    return { isMorning: false, isAfternoon: true };
  }
  return { isMorning: true, isAfternoon: true };
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
  }
  if (session === 'PM') {
    return t('schedule.afternoonLeave');
  }
  return t('schedule.fullDayLeave');
};
