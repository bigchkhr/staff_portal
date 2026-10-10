const { toHKCalendarDate, addHKCalendarDays } = require('./hkDate');

const MAX_SICKNESS_DAYS = 120;
const SAL_OPEN_END = '9999-12-31';
const FIRST_YEAR_MONTHS = 12;
const FIRST_YEAR_RATE = 2;
const LATER_RATE = 4;

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function isSicknessAllowance(leaveType) {
  if (!leaveType) return false;
  if (String(leaveType.code || '').toUpperCase() === 'SAL') return true;
  const zh = leaveType.name_zh || '';
  return zh.includes('病假') && zh.includes('疾病津貼');
}

function accrualKey(endDate) {
  return `sal:${endDate}`;
}

function parseAccrualEnd(key) {
  if (!key || typeof key !== 'string') return null;
  const match = key.match(/^sal:(\d{4}-\d{2}-\d{2})$/);
  return match ? match[1] : null;
}

function addCalendarMonths(dateStr, months) {
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null;
  const monthIndex = parts[1] - 1 + months;
  const year = parts[0] + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(parts[2], lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 由入職日起每一個完整僱傭月份的結束日（周年日前一日）。
 * 首 12 個月每日數 2，其後 4。未完成的月份不計。
 */
function completedEmploymentMonths(hireDate, cutoffDate) {
  const hire = toHKCalendarDate(hireDate);
  const cutoff = toHKCalendarDate(cutoffDate);
  if (!hire || !cutoff || hire > cutoff) return [];

  const months = [];
  for (let index = 1; index <= 2400; index += 1) {
    const anniversary = addCalendarMonths(hire, index);
    const endDate = anniversary ? addHKCalendarDays(anniversary, -1) : null;
    if (!endDate || endDate > cutoff) break;
    if (months.length && endDate <= months[months.length - 1].end_date) break;
    months.push({
      index,
      end_date: endDate,
      rate: index <= FIRST_YEAR_MONTHS ? FIRST_YEAR_RATE : LATER_RATE
    });
  }
  return months;
}

function laterDate(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * 按時間重播發放與已批核病假，決定今次要寫入的月份。
 * 未用餘額任何時間不超過 120。已發放月份不會再發。
 */
function planSicknessAllowance({
  hireDate,
  terminationDate,
  asOf,
  existingGrants = [],
  manualAdjustments = [],
  applications = [],
  mode = 'backfill'
}) {
  const warnings = [];
  const hire = toHKCalendarDate(hireDate);
  const asOfDate = toHKCalendarDate(asOf);
  const termination = toHKCalendarDate(terminationDate);

  const empty = {
    warnings,
    grants: [],
    completed_months: 0,
    ungranted_months: 0,
    current_balance: 0,
    days_to_grant: 0,
    catchup_days: 0,
    projected_balance: 0,
    grants_count: 0,
    latest_rate: null,
    first_grant_date: null,
    last_grant_date: null,
    selectable: false
  };

  if (!hire) {
    warnings.push('missing_hire_date');
    return empty;
  }
  if (!asOfDate) {
    warnings.push('invalid_as_of');
    return empty;
  }
  if (termination && termination < hire) {
    warnings.push('terminated_before_hire');
    return empty;
  }

  const cutoff = termination && termination < asOfDate ? termination : asOfDate;
  if (hire > cutoff) {
    warnings.push('hired_after_as_of');
    return empty;
  }

  const storedByKey = {};
  let existingSum = 0;
  let latestGrantedEnd = null;
  existingGrants.forEach((grant) => {
    const amount = round2(grant.amount);
    existingSum += amount;
    if (grant.accrual_key) {
      storedByKey[grant.accrual_key] = amount;
      latestGrantedEnd = laterDate(latestGrantedEnd, parseAccrualEnd(grant.accrual_key));
    }
  });

  const manuals = manualAdjustments.map((item) => ({
    date: toHKCalendarDate(item.date) || hire,
    amount: round2(item.amount)
  }));
  existingSum += manuals.reduce((sum, item) => sum + item.amount, 0);

  let netTaken = 0;
  const takes = applications.map((item) => {
    const days = round2(Math.abs(item.days));
    const reversal = !!item.reversal;
    netTaken += reversal ? -days : days;
    return {
      date: toHKCalendarDate(item.date) || asOfDate,
      days,
      reversal
    };
  });

  const currentBalance = round2(existingSum - netTaken);
  const simUntil = laterDate(cutoff, latestGrantedEnd);
  const months = completedEmploymentMonths(hire, simUntil);

  const events = [];
  months.forEach((month) => {
    const key = accrualKey(month.end_date);
    events.push({
      date: month.end_date,
      sort: 0,
      type: 'month',
      month,
      key,
      already: Object.prototype.hasOwnProperty.call(storedByKey, key),
      stored: storedByKey[key] || 0
    });
  });
  manuals.forEach((item) => {
    events.push({ date: item.date, sort: 1, type: 'manual', amount: item.amount });
  });
  takes.forEach((item) => {
    events.push({
      date: item.date,
      sort: item.reversal ? 2 : 3,
      type: item.reversal ? 'restore' : 'take',
      amount: item.days
    });
  });
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.sort - b.sort));

  let balance = 0;
  const dueGrants = [];
  events.forEach((event) => {
    if (event.type === 'month') {
      if (event.already) {
        balance = round2(balance + event.stored);
        return;
      }
      if (event.month.end_date > cutoff) return;
      const room = Math.max(0, round2(MAX_SICKNESS_DAYS - balance));
      const amount = round2(Math.min(event.month.rate, room));
      balance = round2(balance + amount);
      dueGrants.push({
        accrual_key: event.key,
        end_date: event.month.end_date,
        index: event.month.index,
        rate: event.month.rate,
        amount,
        year: parseInt(event.month.end_date.slice(0, 4), 10)
      });
      return;
    }
    if (event.type === 'manual' || event.type === 'restore') {
      balance = round2(balance + event.amount);
      return;
    }
    if (event.type === 'take') {
      balance = round2(balance - event.amount);
    }
  });

  const catchupDays = round2(dueGrants.reduce((sum, grant) => sum + grant.amount, 0));
  let grants = dueGrants;
  if (mode === 'monthly' && dueGrants.length > 1) {
    warnings.push('needs_backfill');
    grants = [];
  }
  if (grants.length > 0 && grants.every((grant) => grant.amount === 0)) {
    warnings.push('at_cap');
  }

  const daysToGrant = round2(grants.reduce((sum, grant) => sum + grant.amount, 0));
  const completedCount = months.filter((month) => month.end_date <= cutoff).length;

  return {
    warnings,
    grants,
    completed_months: completedCount,
    ungranted_months: dueGrants.length,
    current_balance: currentBalance,
    days_to_grant: daysToGrant,
    catchup_days: catchupDays,
    projected_balance: round2(currentBalance + daysToGrant),
    grants_count: grants.length,
    latest_rate: grants.length ? grants[grants.length - 1].rate : null,
    first_grant_date: grants.length ? grants[0].end_date : null,
    last_grant_date: grants.length ? grants[grants.length - 1].end_date : null,
    selectable: grants.length > 0 && !warnings.includes('needs_backfill')
  };
}

module.exports = {
  MAX_SICKNESS_DAYS,
  SAL_OPEN_END,
  isSicknessAllowance,
  accrualKey,
  addCalendarMonths,
  completedEmploymentMonths,
  planSicknessAllowance
};
