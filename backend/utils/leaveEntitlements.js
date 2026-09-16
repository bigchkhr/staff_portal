const { toHKCalendarDate, eachHKCalendarDate } = require('./hkDate');
const { roundToHalfDay, completedYearsAsOf } = require('./annualLeave');

const PAID_SICK_FULL_DAYS = 6;

function parseBirthdayMonth(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

function monthStart(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function lastDayOfMonth(year, month) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

function hasPassedProbation(user, asOfDate) {
  const p = toHKCalendarDate(user.probation_end_date);
  const asOf = toHKCalendarDate(asOfDate);
  if (!p || !asOf) return false;
  return p <= asOf;
}

function baseResult(user) {
  return {
    user_id: user.id,
    employee_number: user.employee_number,
    display_name: user.display_name || user.name_zh || '',
    hire_date: toHKCalendarDate(user.hire_date),
    termination_date: toHKCalendarDate(user.termination_date),
    probation_end_date: toHKCalendarDate(user.probation_end_date),
    birthday_month: parseBirthdayMonth(user.birthday_month),
    calculated_days: 0,
    raw_days: 0,
    full_entitlement: 0,
    start_date: null,
    end_date: null,
    warnings: [],
    selectable: false
  };
}

/**
 * 已過試用期：生日月份當月可放 1 日生日假（有效期為該月 1 日至月底）。
 */
function calculateBirthdayLeaveForYear(user, year) {
  const y = parseInt(year, 10);
  const result = baseResult(user);
  const warnings = result.warnings;
  const month = result.birthday_month;

  if (!month) {
    warnings.push('missing_birthday_month');
    return result;
  }

  const start = monthStart(y, month);
  const end = lastDayOfMonth(y, month);
  result.start_date = start;
  result.end_date = end;

  if (!result.probation_end_date) {
    warnings.push('missing_probation_end');
    return result;
  }
  if (!hasPassedProbation(user, end)) {
    warnings.push('still_on_probation');
    return result;
  }
  if (!result.hire_date) {
    warnings.push('missing_hire_date');
    return result;
  }
  if (result.hire_date > end) {
    warnings.push('hired_after_period');
    return result;
  }
  if (result.termination_date && result.termination_date < start) {
    warnings.push('terminated_before_period');
    return result;
  }

  result.full_entitlement = 1;
  result.raw_days = 1;
  result.calculated_days = 1;
  result.selectable = true;
  return result;
}

/**
 * 已過試用期：當年 6 日有薪病假；入職不足一年則按在職日數比例，再以年假 roundToHalfDay。
 */
function calculatePaidSickLeaveForYear(user, year) {
  const y = parseInt(year, 10);
  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const result = {
    ...baseResult(user),
    days_worked: 0,
    days_in_year: eachHKCalendarDate(yearStart, yearEnd).length,
    completed_years: null,
    pro_rata_factor: 0,
    work_start: null,
    work_end: null
  };
  const warnings = result.warnings;
  const hireDate = result.hire_date;
  const terminationDate = result.termination_date;

  if (!hireDate) {
    warnings.push('missing_hire_date');
    return result;
  }
  if (!result.probation_end_date) {
    warnings.push('missing_probation_end');
    return result;
  }
  if (hireDate > yearEnd) {
    warnings.push('hired_after_year');
    return result;
  }
  if (terminationDate && terminationDate < yearStart) {
    warnings.push('terminated_before_year');
    return result;
  }

  const workStart = hireDate > yearStart ? hireDate : yearStart;
  const workEnd = terminationDate && terminationDate < yearEnd ? terminationDate : yearEnd;
  result.work_start = workStart;
  result.work_end = workEnd;
  result.start_date = yearStart;
  result.end_date = workEnd;

  if (workEnd < workStart) {
    warnings.push('no_service_in_year');
    return result;
  }
  if (!hasPassedProbation(user, workEnd)) {
    warnings.push('still_on_probation');
    return result;
  }

  const daysWorked = eachHKCalendarDate(workStart, workEnd).length;
  result.days_worked = daysWorked;
  const completedYears = completedYearsAsOf(hireDate, workEnd);
  result.completed_years = completedYears;
  result.full_entitlement = PAID_SICK_FULL_DAYS;

  let rawDays = PAID_SICK_FULL_DAYS;
  if (completedYears < 1) {
    const factor = result.days_in_year > 0 ? daysWorked / result.days_in_year : 0;
    rawDays = PAID_SICK_FULL_DAYS * factor;
    result.pro_rata_factor = Math.round(factor * 10000) / 10000;
    warnings.push('pro_rata_less_than_one_year');
  }

  result.raw_days = Math.round(rawDays * 10000) / 10000;
  result.calculated_days = roundToHalfDay(rawDays);
  result.selectable = result.calculated_days > 0;
  if (result.calculated_days <= 0) {
    warnings.push('zero_after_rounding');
  }
  return result;
}

module.exports = {
  PAID_SICK_FULL_DAYS,
  parseBirthdayMonth,
  calculateBirthdayLeaveForYear,
  calculatePaidSickLeaveForYear
};
