const knex = require('../config/database');
const monthlyAttendanceSummaryController = require('../controllers/monthlyAttendanceSummary.controller');
const LeaveApplication = require('../database/models/LeaveApplication');
const PublicHoliday = require('../database/models/PublicHoliday');
const { countsAsWorkingDay } = require('../utils/workingDaysCount');

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

const BLANK_MONTH = {
  calendar_days: 0,
  working_days: 0,
  annual_leave: 0,
  labour_holiday: 0,
  sick_leave_full_pay: 0,
  sick_leave_deduction: 0,
  no_pay_leave: 0,
  maternity_leave: 0,
  paternity_leave: 0,
  other_leave_full_pay: 0,
  other_leave_deduction: 0
};

function normalizeEmployeeNumber(value) {
  return String(value || '').trim();
}

function parseYmdToUtcMs(value) {
  const [y, m, d] = String(value).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function listDatesInclusive(startDate, endDate) {
  const dates = [];
  const startMs = parseYmdToUtcMs(startDate);
  const endMs = parseYmdToUtcMs(endDate);
  for (let ms = startMs; ms <= endMs; ms += 86400000) {
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

function roundDays(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function sessionToDays(session) {
  if (session === 'AM' || session === 'PM') return 0.5;
  return 1;
}

function clampYmd(value, min, max) {
  const s = monthlyAttendanceSummaryController.toDateString(value) || String(value || '').slice(0, 10);
  if (!YMD_RE.test(s)) return null;
  if (s < min) return min;
  if (s > max) return max;
  return s;
}

function listYearMonths(startDate, endDate) {
  const months = [];
  let cursor = `${startDate.slice(0, 7)}-01`;
  const endKey = endDate.slice(0, 7);
  while (cursor.slice(0, 7) <= endKey) {
    months.push(cursor.slice(0, 7));
    const [year, month] = cursor.slice(0, 7).split('-').map(Number);
    cursor = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }
  return months;
}

function calendarDaysInMonth(yearMonth, periodStart, periodEnd) {
  const [year, month] = yearMonth.split('-').map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${yearMonth}-01`;
  const monthEnd = `${yearMonth}-${String(last).padStart(2, '0')}`;
  const start = monthStart < periodStart ? periodStart : monthStart;
  const end = monthEnd > periodEnd ? periodEnd : monthEnd;
  if (start > end) return 0;
  return Math.round((parseYmdToUtcMs(end) - parseYmdToUtcMs(start)) / 86400000) + 1;
}

function blankMonth(yearMonth, calendarDays) {
  return { year_month: yearMonth, ...BLANK_MONTH, calendar_days: calendarDays };
}

function leaveCode(source) {
  return String(source?.leave_type_code || '').trim().toUpperCase();
}

function leaveNameZh(source) {
  return String(source?.leave_type_name_zh || '').trim();
}

function classifyLeaveField(source) {
  if (!source) return null;
  const code = leaveCode(source);
  const zh = leaveNameZh(source);

  if (code === 'AL' || zh.includes('年假')) return 'annual_leave';
  if (code === 'SH' || zh.includes('法定假期')) return 'labour_holiday';
  if (code === 'FPSL' || zh === '全薪病假') return 'sick_leave_full_pay';
  if (code === 'SAL' || (zh.includes('病假') && zh.includes('疾病津貼'))) return 'sick_leave_deduction';
  if (code === 'NPL' || code === 'NPSL' || zh === '無薪事假' || zh === '無薪病假') return 'no_pay_leave';
  if (code === 'MTL' || zh.includes('產假')) return 'maternity_leave';
  if (code === 'PTL' || zh.includes('侍產假')) return 'paternity_leave';
  if (code === 'AR' || /^R\d+$/.test(code) || zh.includes('例假')) return null;
  if (code === 'ABS' || zh.includes('缺勤') || code === 'IL' || zh.includes('工傷')) return 'other_leave_deduction';
  return 'other_leave_full_pay';
}

function dayLeaveUnits(dateStr, schedule, leave) {
  if (leave) return sessionToDays(LeaveApplication.getSessionForDate(leave, dateStr));
  if (schedule && schedule.leave_session) return sessionToDays(schedule.leave_session);
  return 1;
}

function workingDayUnits(dateStr, schedule, leave, clocks) {
  return countsAsWorkingDay({
    dateStr,
    schedule,
    leave,
    clocks,
    getSessionForDate: LeaveApplication.getSessionForDate
  });
}

function schedulePayload(row) {
  return {
    id: row.id || null,
    store_id: row.store_id || null,
    start_time: monthlyAttendanceSummaryController.formatTimeValue(row.start_time),
    end_time: monthlyAttendanceSummaryController.formatTimeValue(row.end_time),
    leave_type_name_zh: row.leave_type_name_zh || null,
    leave_type_name: row.leave_type_name || null,
    leave_type_code: row.leave_type_code || null,
    leave_session: row.leave_session || null,
    counts_as_working_days: !!row.counts_as_working_days,
    is_approved_leave: false
  };
}

async function getLeaveDays({ employee_number, start_date, end_date }) {
  const employeeNumber = normalizeEmployeeNumber(employee_number);
  if (!employeeNumber) {
    const err = new Error('employee_number is required');
    err.status = 400;
    throw err;
  }

  const startDate = String(start_date || '').slice(0, 10);
  const endDate = String(end_date || '').slice(0, 10);
  if (!YMD_RE.test(startDate) || !YMD_RE.test(endDate)) {
    const err = new Error('start_date / end_date 格式須為 YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  if (startDate > endDate) {
    const err = new Error('開始日期不能晚於結束日期');
    err.status = 400;
    throw err;
  }
  const dayCount = Math.round((parseYmdToUtcMs(endDate) - parseYmdToUtcMs(startDate)) / 86400000) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    const err = new Error(`日期區間最多 ${MAX_RANGE_DAYS} 天`);
    err.status = 400;
    throw err;
  }

  const user = await knex('users')
    .whereRaw('LOWER(TRIM(users.employee_number)) = ?', [employeeNumber.toLowerCase()])
    .select('users.id', 'users.employee_number', 'users.display_name')
    .first();

  if (!user) {
    const err = new Error(`Staff Portal 找不到員工編號 ${employeeNumber}`);
    err.status = 404;
    throw err;
  }

  const months = listYearMonths(startDate, endDate).map((yearMonth) => (
    blankMonth(yearMonth, calendarDaysInMonth(yearMonth, startDate, endDate))
  ));
  const byMonth = new Map(months.map((row) => [row.year_month, row]));

  const scheduleRows = await knex('schedules')
    .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
    .where('schedules.user_id', user.id)
    .where('schedules.schedule_date', '>=', startDate)
    .where('schedules.schedule_date', '<=', endDate)
    .select(
      'schedules.id',
      'schedules.user_id',
      'schedules.schedule_date',
      'schedules.start_time',
      'schedules.end_time',
      'schedules.store_id',
      'schedules.leave_session',
      'leave_types.name as leave_type_name',
      'leave_types.name_zh as leave_type_name_zh',
      'leave_types.code as leave_type_code',
      'leave_types.counts_as_working_days as counts_as_working_days'
    );

  const schedulesByDate = new Map();
  for (const row of scheduleRows) {
    const dateStr = monthlyAttendanceSummaryController.toDateString(row.schedule_date);
    if (!dateStr) continue;
    schedulesByDate.set(dateStr, schedulePayload(row));
  }

  const leaveRows = await knex('leave_applications')
    .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
    .where('leave_applications.user_id', user.id)
    .where('leave_applications.status', 'approved')
    .where('leave_applications.start_date', '<=', endDate)
    .where('leave_applications.end_date', '>=', startDate)
    .where(function () {
      this.whereNull('leave_applications.is_cancellation_request').orWhere('leave_applications.is_cancellation_request', false);
    })
    .where(function () {
      this.whereNull('leave_applications.is_reversed').orWhere('leave_applications.is_reversed', false);
    })
    .where(function () {
      this.whereNull('leave_applications.is_reversal_transaction').orWhere('leave_applications.is_reversal_transaction', false);
    })
    .select(
      'leave_applications.user_id',
      'leave_applications.start_date',
      'leave_applications.end_date',
      'leave_applications.start_session',
      'leave_applications.end_session',
      'leave_types.name as leave_type_name',
      'leave_types.name_zh as leave_type_name_zh',
      'leave_types.code as leave_type_code',
      'leave_types.counts_as_working_days as counts_as_working_days'
    );

  const leaveByDate = new Map();
  for (const leave of leaveRows) {
    const start = clampYmd(leave.start_date, startDate, endDate);
    const end = clampYmd(leave.end_date, startDate, endDate);
    if (!start || !end || start > end) continue;
    for (const dateStr of listDatesInclusive(start, end)) {
      if (leaveByDate.has(dateStr)) continue;
      leaveByDate.set(dateStr, leave);
      const existing = schedulesByDate.get(dateStr) || {};
      schedulesByDate.set(dateStr, {
        ...existing,
        leave_type_name_zh: leave.leave_type_name_zh || existing.leave_type_name_zh || null,
        leave_type_name: leave.leave_type_name || existing.leave_type_name || null,
        leave_type_code: leave.leave_type_code || existing.leave_type_code || null,
        counts_as_working_days: leave.counts_as_working_days != null
          ? !!leave.counts_as_working_days
          : !!existing.counts_as_working_days,
        is_approved_leave: true
      });
    }
  }

  const holidayRows = await PublicHoliday.getHolidaysInRange(startDate, endDate);
  const holidaysByDate = new Map();
  for (const holiday of holidayRows || []) {
    const dateStr = monthlyAttendanceSummaryController.toDateString(holiday.date);
    if (dateStr) holidaysByDate.set(dateStr, holiday);
  }

  const clocksByDate = new Map();
  const clockRows = await knex('clock_records')
    .whereRaw('LOWER(TRIM(employee_number)) = ?', [employeeNumber.toLowerCase()])
    .where('attendance_date', '>=', startDate)
    .where('attendance_date', '<=', endDate)
    .select('attendance_date', 'clock_time');
  for (const row of clockRows) {
    const dateStr = monthlyAttendanceSummaryController.toDateString(row.attendance_date);
    if (!dateStr) continue;
    if (!clocksByDate.has(dateStr)) clocksByDate.set(dateStr, []);
    clocksByDate.get(dateStr).push(row);
  }

  for (const dateStr of listDatesInclusive(startDate, endDate)) {
    const month = byMonth.get(dateStr.slice(0, 7));
    if (!month) continue;
    const holiday = holidaysByDate.get(dateStr);
    const schedule = schedulesByDate.get(dateStr) || null;
    const leave = leaveByDate.get(dateStr) || null;
    const clocks = clocksByDate.get(dateStr) || [];
    const source = leave || schedule;

    month.working_days = roundDays(month.working_days + workingDayUnits(dateStr, schedule, leave, clocks));

    if (holiday) {
      month.labour_holiday = roundDays(month.labour_holiday + 1);
      continue;
    }

    const field = classifyLeaveField(source);
    if (!field) continue;
    const units = dayLeaveUnits(dateStr, schedule, leave);
    month[field] = roundDays((month[field] || 0) + units);
  }

  return {
    employee_number: user.employee_number,
    display_name: user.display_name || null,
    start_date: startDate,
    end_date: endDate,
    months
  };
}

module.exports = {
  getLeaveDays
};
