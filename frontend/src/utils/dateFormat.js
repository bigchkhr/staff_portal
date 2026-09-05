import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

export const HK_TZ = 'Asia/Hong_Kong';

/**
 * 將任意日期值正規化為香港（UTC+8）日曆的 YYYY-MM-DD。
 * 純日期字串（無時間）視為香港日曆日，不作時區換算。
 * Date / ISO datetime / dayjs 則先當成時間點，再轉成 UTC+8 日曆日。
 */
export const toHKCalendarDate = (val) => {
  if (val == null || val === '') return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = dayjs(trimmed);
    if (!d.isValid()) return null;
    return d.tz(HK_TZ).format('YYYY-MM-DD');
  }

  if (dayjs.isDayjs(val)) {
    if (!val.isValid()) return null;
    return val.tz(HK_TZ).format('YYYY-MM-DD');
  }

  const d = dayjs(val);
  if (!d.isValid()) return null;
  return d.tz(HK_TZ).format('YYYY-MM-DD');
};

export const toHKDayjs = (val) => {
  const dateStr = toHKCalendarDate(val);
  if (!dateStr) return null;
  const d = dayjs.tz(dateStr, 'YYYY-MM-DD', HK_TZ);
  return d.isValid() ? d.startOf('day') : null;
};

export const todayHK = () => toHKCalendarDate(new Date());

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm 格式（UTC+8）
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  const d = dayjs(date);
  if (!d.isValid()) return '-';
  return d.tz(HK_TZ).format('YYYY-MM-DD HH:mm');
};

/**
 * 將日期以 UTC+8 顯示為 YYYY-MM-DD
 */
export const formatDateUTC8 = (date) => {
  return toHKCalendarDate(date) || '-';
};

/**
 * 格式化日期為 YYYY-MM-DD 格式（UTC+8 日曆）
 */
export const formatDate = (date) => {
  return toHKCalendarDate(date) || '-';
};
