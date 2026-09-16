const { toHKCalendarDate, eachHKCalendarDate } = require('./hkDate');

const ENTITLEMENT_WAITING_MONTHS = 3;

/**
 * 以 0.25 / 0.75 為中位數，捨入至 0.5 單位（含整數）。
 * - 小數 ≤ 0.25 → round down 至整數（例：12.23 → 12）
 * - 小數 > 0.25 且 ≤ 0.75 → 靠近 0.5 檔（例：33.33 → 33.5）
 * - 小數 > 0.75 → round up 至下一整數（例：12.76 → 13）
 * 等於中位數時向下。
 */
function roundToHalfDay(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const scaled = Math.round(n * 10000);
  const whole = Math.floor(scaled / 10000);
  const fracScaled = scaled - whole * 10000;

  if (fracScaled <= 2500) return whole;
  if (fracScaled <= 7500) return whole + 0.5;
  return whole + 1;
}

/** 離職按比例：只保留兩位小數，不捨入至 0.5 單位 */
function roundToTwoDecimals(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

function anniversaryOnYear(hireDateStr, year) {
  const parts = String(hireDateStr).split('-').map(Number);
  if (parts.length < 3 || parts.some((x) => Number.isNaN(x))) return null;
  const [, month, day] = parts;
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/** 入職日加 N 個月（月底日會 clamp） */
function addCalendarMonths(dateStr, months) {
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length < 3 || parts.some((x) => Number.isNaN(x))) return null;
  const [y, m, d] = parts;
  const total = y * 12 + (m - 1) + months;
  const newY = Math.floor(total / 12);
  const newM = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(newY, newM, 0)).getUTCDate();
  const safeDay = Math.min(d, lastDay);
  return `${newY}-${String(newM).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

/** 截至 asOfDate（含）已做滿的完整年數 */
function completedYearsAsOf(hireDateStr, asOfDateStr) {
  const hire = toHKCalendarDate(hireDateStr);
  const asOf = toHKCalendarDate(asOfDateStr);
  if (!hire || !asOf || asOf < hire) return 0;

  const hireYear = parseInt(hire.slice(0, 4), 10);
  const asOfYear = parseInt(asOf.slice(0, 4), 10);
  let years = asOfYear - hireYear;
  const anniversary = anniversaryOnYear(hire, asOfYear);
  if (anniversary && asOf < anniversary) {
    years -= 1;
  }
  return Math.max(0, years);
}

function daysInCalendarYear(year) {
  return eachHKCalendarDate(`${year}-01-01`, `${year}-12-31`).length;
}

function maxDate(a, b) {
  return a >= b ? a : b;
}

function minDate(a, b) {
  return a <= b ? a : b;
}

/**
 * 計算指定曆年之年假試算結果。
 * - 入職日起滿 3 個月才 entitle（以該年在職結束日是否已達資格日判斷）
 * - 年資以該年 1 月 1 日為準：entitlement = min(base + completedYears, cap)
 * - 再按該年實際在職日數（入職／離職）比例
 * - 該年有離職日：保留兩位小數，不 round 至 0.5；否則 roundToHalfDay
 */
function calculateAnnualLeaveForYear(user, year) {
  const y = parseInt(year, 10);
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const hireDate = toHKCalendarDate(user.hire_date);
  const terminationDate = toHKCalendarDate(user.termination_date);
  const base = user.al_base_days != null ? parseFloat(user.al_base_days) : null;
  const cap = user.al_cap_days != null ? parseFloat(user.al_cap_days) : null;

  const warnings = [];
  const result = {
    user_id: user.id,
    employee_number: user.employee_number,
    display_name: user.display_name || user.name_zh || '',
    hire_date: hireDate,
    termination_date: terminationDate,
    al_base_days: base,
    al_cap_days: cap,
    entitlement_date: null,
    completed_years: null,
    full_entitlement: null,
    work_start: null,
    work_end: null,
    days_worked: 0,
    days_in_year: daysInCalendarYear(y),
    pro_rata_factor: 0,
    raw_days: 0,
    calculated_days: 0,
    warnings,
    selectable: false
  };

  if (!hireDate) {
    warnings.push('missing_hire_date');
    return result;
  }
  if (base == null || !Number.isFinite(base) || base < 0) {
    warnings.push('missing_al_base');
    return result;
  }
  if (cap == null || !Number.isFinite(cap) || cap < 0) {
    warnings.push('missing_al_cap');
    return result;
  }
  if (cap < base) {
    warnings.push('cap_below_base');
  }

  if (hireDate > yearEnd) {
    warnings.push('hired_after_year');
    return result;
  }
  if (terminationDate && terminationDate < yearStart) {
    warnings.push('terminated_before_year');
    return result;
  }

  const entitlementDate = addCalendarMonths(hireDate, ENTITLEMENT_WAITING_MONTHS);
  result.entitlement_date = entitlementDate;

  const workStart = maxDate(hireDate, yearStart);
  const workEnd = terminationDate ? minDate(terminationDate, yearEnd) : yearEnd;

  if (workEnd < workStart) {
    warnings.push('no_service_in_year');
    return result;
  }

  // 入職滿 3 個月才 entitle：該年在職結束日仍未達資格日 → 0
  if (!entitlementDate || workEnd < entitlementDate) {
    warnings.push('not_yet_entitled_3m');
    result.work_start = workStart;
    result.work_end = workEnd;
    result.days_worked = eachHKCalendarDate(workStart, workEnd).length;
    return result;
  }

  const completedYears = completedYearsAsOf(hireDate, yearStart);
  const fullEntitlement = Math.min(base + completedYears, cap);

  const daysWorked = eachHKCalendarDate(workStart, workEnd).length;
  const daysInYear = result.days_in_year;
  const factor = daysInYear > 0 ? daysWorked / daysInYear : 0;
  const rawDays = fullEntitlement * factor;
  const terminatedInYear =
    !!terminationDate && terminationDate >= yearStart && terminationDate <= yearEnd;
  const calculatedDays = terminatedInYear
    ? roundToTwoDecimals(rawDays)
    : roundToHalfDay(rawDays);

  if (terminatedInYear) {
    warnings.push('adjusted_for_termination');
  }
  if (hireDate > yearStart && hireDate <= yearEnd) {
    warnings.push('pro_rata_new_joiner');
  }
  if (entitlementDate > yearStart && entitlementDate <= yearEnd) {
    warnings.push('entitled_after_3m');
  }

  result.completed_years = completedYears;
  result.full_entitlement = fullEntitlement;
  result.work_start = workStart;
  result.work_end = workEnd;
  result.days_worked = daysWorked;
  result.pro_rata_factor = Math.round(factor * 10000) / 10000;
  result.raw_days = Math.round(rawDays * 10000) / 10000;
  result.calculated_days = calculatedDays;
  result.selectable = calculatedDays > 0;

  if (calculatedDays <= 0) {
    warnings.push('zero_after_rounding');
  }

  return result;
}

module.exports = {
  roundToHalfDay,
  roundToTwoDecimals,
  completedYearsAsOf,
  calculateAnnualLeaveForYear,
  anniversaryOnYear,
  addCalendarMonths,
  ENTITLEMENT_WAITING_MONTHS
};
