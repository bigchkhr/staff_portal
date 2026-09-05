const HK_OFFSET_MS = 8 * 60 * 60 * 1000;

function instantToHKCalendarDate(dateObj) {
  const utc8 = new Date(dateObj.getTime() + HK_OFFSET_MS);
  const year = utc8.getUTCFullYear();
  const month = String(utc8.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc8.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addHKCalendarDays(dateStr, days) {
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
}

function eachHKCalendarDate(start, end) {
  const dates = [];
  let current = toHKCalendarDate(start);
  const last = toHKCalendarDate(end);
  if (!current || !last) return dates;
  while (current <= last) {
    dates.push(current);
    current = addHKCalendarDays(current, 1);
    if (!current) break;
  }
  return dates;
}

/**
 * 將任意日期值正規化為香港（UTC+8）日曆的 YYYY-MM-DD。
 * 純日期字串（無時間）視為香港日曆日，不作時區換算。
 * Date / ISO datetime 則先當成時間點，再轉成 UTC+8 日曆日。
 */
function toHKCalendarDate(val) {
  if (val == null || val === '') return null;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const dateObj = new Date(trimmed);
    if (isNaN(dateObj.getTime())) return null;
    return instantToHKCalendarDate(dateObj);
  }

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return instantToHKCalendarDate(val);
  }

  return null;
}

function todayHK() {
  return instantToHKCalendarDate(new Date());
}

module.exports = {
  toHKCalendarDate,
  todayHK,
  addHKCalendarDays,
  eachHKCalendarDate
};
