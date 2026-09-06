const knex = require('../config/database');
const monthlyAttendanceSummaryController = require('../controllers/monthlyAttendanceSummary.controller');
const LeaveApplication = require('../database/models/LeaveApplication');
const PublicHoliday = require('../database/models/PublicHoliday');

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PERIOD_DAYS = 45;
const MAX_PERIODS = 4;
const LATE_THRESHOLD_MINUTES = 10;

// Same eligibility rules as MonthlyAttendanceSummary 勤工獎
const DISQUALIFIED_LEAVE_NAMES_ZH = new Set([
  '無薪事假',
  '無薪病假',
  '病假 (疾病津貼)',
  '全薪病假',
  '工傷病假',
  '產假',
  '侍產假',
  '恩恤假'
]);
const DISQUALIFIED_LEAVE_CODES = new Set([
  'NPL',
  'NPSL',
  'SAL',
  'FPSL',
  'IL',
  'MTL',
  'PTL',
  'CPL'
]);
const DISQUALIFIED_LEAVE_NAMES_EN = new Set([
  'No Pay Personal Leave',
  'No Pay Sick Leave',
  'Sick Leave (Sickness Allowance)',
  'Full Paid Sick Leave',
  'Work Injury Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Compassionate Leave'
]);

function normalizeEmployeeNumber(value) {
  return String(value || '').trim();
}

function employeeNumberKey(value) {
  return normalizeEmployeeNumber(value).toLowerCase();
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

function hoursFromMinutes(minutes) {
  const n = Math.round((Number(minutes) || 0) / 60 * 100) / 100;
  return n;
}

function normalizePeriods(rawPeriods) {
  if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
    const err = new Error('periods is required');
    err.status = 400;
    throw err;
  }
  if (rawPeriods.length > MAX_PERIODS) {
    const err = new Error(`最多 ${MAX_PERIODS} 段日期`);
    err.status = 400;
    throw err;
  }

  return rawPeriods.map((period, idx) => {
    const start_date = String(period?.start_date || '').slice(0, 10);
    const end_date = String(period?.end_date || '').slice(0, 10);
    if (!YMD_RE.test(start_date) || !YMD_RE.test(end_date)) {
      const err = new Error(`periods[${idx}] 日期格式須為 YYYY-MM-DD`);
      err.status = 400;
      throw err;
    }
    if (start_date > end_date) {
      const err = new Error(`periods[${idx}] 開始日期不能晚於結束日期`);
      err.status = 400;
      throw err;
    }
    const dayCount = Math.round((parseYmdToUtcMs(end_date) - parseYmdToUtcMs(start_date)) / 86400000) + 1;
    if (dayCount > MAX_PERIOD_DAYS) {
      const err = new Error(`periods[${idx}] 日期區間最多 ${MAX_PERIOD_DAYS} 天`);
      err.status = 400;
      throw err;
    }
    return {
      key: period?.key ? String(period.key) : `period_${idx + 1}`,
      start_date,
      end_date
    };
  });
}

async function loadUsersByEmployeeNumbers(employeeNumbers) {
  const unique = [...new Set(employeeNumbers.map(normalizeEmployeeNumber).filter(Boolean))];
  if (unique.length === 0) return [];

  const placeholders = unique.map(() => '?').join(', ');
  return knex('users')
    .leftJoin('positions', 'users.position_id', 'positions.id')
    .whereRaw(
      `LOWER(TRIM(users.employee_number)) IN (${placeholders})`,
      unique.map((n) => n.toLowerCase())
    )
    .select(
      'users.id',
      'users.employee_number',
      'users.display_name',
      'users.name_zh',
      'positions.employment_mode as position_employment_mode'
    );
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
    is_approved_leave: false
  };
}

function disqualifiedLeaveLabel(scheduleData) {
  if (!scheduleData) return null;
  const code = String(scheduleData.leave_type_code || '').trim().toUpperCase();
  const zh = String(scheduleData.leave_type_name_zh || '').trim();
  const en = String(scheduleData.leave_type_name || '').trim();
  if (DISQUALIFIED_LEAVE_CODES.has(code) || DISQUALIFIED_LEAVE_NAMES_ZH.has(zh) || DISQUALIFIED_LEAVE_NAMES_EN.has(en)) {
    return zh || en || code;
  }
  return null;
}

function clampYmd(value, min, max) {
  const s = monthlyAttendanceSummaryController.toDateString(value) || String(value || '').slice(0, 10);
  if (!YMD_RE.test(s)) return null;
  if (s < min) return min;
  if (s > max) return max;
  return s;
}

const ADW_LEAVE_KIND_BY_CODE = {
  AL: 'annual_leave',
  SAL: 'sickness_allowance',
  MTL: 'maternity_leave',
  PTL: 'paternity_leave',
  IL: 'work_injury'
};
const ADW_LEAVE_KIND_BY_ZH = {
  年假: 'annual_leave',
  '病假 (疾病津貼)': 'sickness_allowance',
  產假: 'maternity_leave',
  侍產假: 'paternity_leave',
  工傷病假: 'work_injury'
};

const NO_PAY_LEAVE_CODES = new Set(['NPL', 'NPSL']);
const NO_PAY_LEAVE_NAMES_ZH = new Set(['無薪事假', '無薪病假']);
const NO_PAY_LEAVE_NAMES_EN = new Set(['No Pay Personal Leave', 'No Pay Sick Leave']);

function adwKindFromLeave(source) {
  if (!source) return null;
  const code = String(source.leave_type_code || '').trim().toUpperCase();
  if (ADW_LEAVE_KIND_BY_CODE[code]) return ADW_LEAVE_KIND_BY_CODE[code];
  const zh = String(source.leave_type_name_zh || '').trim();
  return ADW_LEAVE_KIND_BY_ZH[zh] || null;
}

function sessionToDays(session) {
  if (session === 'AM' || session === 'PM') return 0.5;
  return 1;
}

function isNoPayLeave(source) {
  if (!source) return false;
  const code = String(source.leave_type_code || '').trim().toUpperCase();
  if (NO_PAY_LEAVE_CODES.has(code)) return true;
  const zh = String(source.leave_type_name_zh || '').trim();
  if (NO_PAY_LEAVE_NAMES_ZH.has(zh)) return true;
  const en = String(source.leave_type_name || '').trim();
  return NO_PAY_LEAVE_NAMES_EN.has(en);
}

function leaveDaysOnDate(dateStr, schedule, leave) {
  if (leave) return sessionToDays(LeaveApplication.getSessionForDate(leave, dateStr));
  if (schedule && schedule.leave_session) return sessionToDays(schedule.leave_session);
  return 1;
}

function computePeriodNoPayLeaveDays(dates, schedulesByDate, userId, leaveByUserDate) {
  let days = 0;
  const types = [];
  for (const dateStr of dates) {
    const leave = leaveByUserDate.get(`${userId}_${dateStr}`);
    const schedule = schedulesByDate.get(dateStr);
    const source = leave || schedule;
    if (!isNoPayLeave(source)) continue;
    days = Math.round((days + leaveDaysOnDate(dateStr, schedule, leave)) * 100) / 100;
    const label = source.leave_type_name_zh || source.leave_type_name || source.leave_type_code;
    if (label && !types.includes(label)) types.push(label);
  }
  return { days, types };
}

function computePeriodAdwEntitlements(dates, schedulesByDate, holidaysByDate, userId, leaveByUserDate) {
  const daysByKind = new Map();
  const add = (kind, days, label) => {
    if (!kind || !(days > 0)) return;
    const prev = daysByKind.get(kind) || { kind, days: 0, label, details: [] };
    prev.days = Math.round((prev.days + days) * 100) / 100;
    if (label && !prev.details.includes(label)) prev.details.push(label);
    daysByKind.set(kind, prev);
  };

  for (const dateStr of dates) {
    const holiday = holidaysByDate.get(dateStr);
    if (holiday) {
      add('statutory_holiday', 1, holiday.name_zh || holiday.name || '法定假期');
      continue;
    }
    const leave = leaveByUserDate.get(`${userId}_${dateStr}`);
    const schedule = schedulesByDate.get(dateStr);
    const source = leave || schedule;
    const kind = adwKindFromLeave(source);
    if (!kind) continue;
    let days = 1;
    if (leave) {
      days = sessionToDays(LeaveApplication.getSessionForDate(leave, dateStr));
    } else if (schedule && schedule.leave_session) {
      days = sessionToDays(schedule.leave_session);
    }
    add(kind, days, source.leave_type_name_zh || source.leave_type_name || kind);
  }

  return [...daysByKind.values()].filter((row) => row.days > 0);
}

function normalizeClockRecord(row) {
  const dateStr = monthlyAttendanceSummaryController.toDateString(row.attendance_date);
  return {
    ...row,
    attendance_date: dateStr,
    clock_time: monthlyAttendanceSummaryController.formatTimeValue(row.clock_time) || row.clock_time
  };
}

async function computePeriodMinutes(user, clocksByDate, schedulesByDate, dates) {
  const mode = (user.position_employment_mode || '').toString().trim().toUpperCase() === 'PT' ? 'PT' : 'FT';
  let minutes = 0;
  let lateMinutes = 0;
  const disqualifiedLeaves = [];

  for (const dateStr of dates) {
    const clockRecords = clocksByDate.get(dateStr) || [];
    const scheduleData = schedulesByDate.get(dateStr) || null;
    const leaveLabel = disqualifiedLeaveLabel(scheduleData);
    if (leaveLabel && !disqualifiedLeaves.includes(leaveLabel)) {
      disqualifiedLeaves.push(leaveLabel);
    }

    const validRecords = monthlyAttendanceSummaryController.getValidClockRecords(clockRecords);
    if (!scheduleData && validRecords.length === 0) continue;

    const calculated = await monthlyAttendanceSummaryController.calculateDailyAttendance(
      { attendance_date: dateStr, clock_records: clockRecords },
      scheduleData || {},
      mode,
      { skipStoreLookup: true }
    );
    const approved = parseFloat(calculated.approved_overtime_minutes);
    if (Number.isFinite(approved) && approved > 0) {
      minutes += approved;
    }
    const late = parseFloat(calculated.late_minutes);
    if (Number.isFinite(late) && late > 0) {
      lateMinutes += late;
    }
  }

  const lateOverThreshold = lateMinutes >= LATE_THRESHOLD_MINUTES;
  return {
    mode,
    minutes,
    late_minutes: lateMinutes,
    late_over_threshold: lateOverThreshold,
    disqualified_leave_types: disqualifiedLeaves,
    attendance_bonus_eligible: !lateOverThreshold && disqualifiedLeaves.length === 0
  };
}

async function getPayrollHours({ employee_numbers, periods: rawPeriods }) {
  const requestedNumbers = [...new Set((employee_numbers || []).map(normalizeEmployeeNumber).filter(Boolean))];
  if (requestedNumbers.length === 0) {
    const err = new Error('employee_numbers is required');
    err.status = 400;
    throw err;
  }

  const periods = normalizePeriods(rawPeriods);
  const users = await loadUsersByEmployeeNumbers(requestedNumbers);
  const usersByKey = new Map(users.map((u) => [employeeNumberKey(u.employee_number), u]));
  const missing_employee_numbers = requestedNumbers.filter((n) => !usersByKey.has(employeeNumberKey(n)));

  const rangeStart = periods.reduce((min, p) => (p.start_date < min ? p.start_date : min), periods[0].start_date);
  const rangeEnd = periods.reduce((max, p) => (p.end_date > max ? p.end_date : max), periods[0].end_date);

  const userIds = users.map((u) => u.id);
  const foundEmployeeNumbers = users.map((u) => u.employee_number).filter(Boolean);

  const clocksByEmpDate = new Map();
  if (foundEmployeeNumbers.length > 0) {
    const clockRows = await knex('clock_records')
      .whereIn('employee_number', foundEmployeeNumbers)
      .where('attendance_date', '>=', rangeStart)
      .where('attendance_date', '<=', rangeEnd)
      .orderBy('attendance_date', 'asc')
      .orderBy('clock_time', 'asc');

    for (const row of clockRows) {
      const rec = normalizeClockRecord(row);
      if (!rec.attendance_date || !rec.employee_number) continue;
      const key = `${employeeNumberKey(rec.employee_number)}__${rec.attendance_date}`;
      if (!clocksByEmpDate.has(key)) clocksByEmpDate.set(key, []);
      clocksByEmpDate.get(key).push(rec);
    }
  }

  const schedulesByUserDate = new Map();
  const leaveByUserDate = new Map();
  if (userIds.length > 0) {
    const scheduleRows = await knex('schedules')
      .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
      .whereIn('schedules.user_id', userIds)
      .where('schedules.schedule_date', '>=', rangeStart)
      .where('schedules.schedule_date', '<=', rangeEnd)
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
        'leave_types.code as leave_type_code'
      );

    for (const row of scheduleRows) {
      const dateStr = monthlyAttendanceSummaryController.toDateString(row.schedule_date);
      if (!row.user_id || !dateStr) continue;
      schedulesByUserDate.set(`${row.user_id}_${dateStr}`, schedulePayload(row));
    }

    const leaveRows = await knex('leave_applications')
      .leftJoin('leave_types', 'leave_applications.leave_type_id', 'leave_types.id')
      .whereIn('leave_applications.user_id', userIds)
      .where('leave_applications.status', 'approved')
      .where('leave_applications.start_date', '<=', rangeEnd)
      .where('leave_applications.end_date', '>=', rangeStart)
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
        'leave_types.code as leave_type_code'
      );

    for (const leave of leaveRows) {
      const start = clampYmd(leave.start_date, rangeStart, rangeEnd);
      const end = clampYmd(leave.end_date, rangeStart, rangeEnd);
      if (!leave.user_id || !start || !end || start > end) continue;
      for (const dateStr of listDatesInclusive(start, end)) {
        const key = `${leave.user_id}_${dateStr}`;
        const existing = schedulesByUserDate.get(key) || {};
        if (existing.is_approved_leave) continue;
        leaveByUserDate.set(key, leave);
        schedulesByUserDate.set(key, {
          ...existing,
          leave_type_name_zh: leave.leave_type_name_zh || existing.leave_type_name_zh || null,
          leave_type_name: leave.leave_type_name || existing.leave_type_name || null,
          leave_type_code: leave.leave_type_code || existing.leave_type_code || null,
          is_approved_leave: true
        });
      }
    }
  }

  const holidayRows = await PublicHoliday.getHolidaysInRange(rangeStart, rangeEnd);
  const holidaysByDate = new Map();
  for (const holiday of holidayRows || []) {
    const dateStr = monthlyAttendanceSummaryController.toDateString(holiday.date);
    if (dateStr) holidaysByDate.set(dateStr, holiday);
  }

  const employees = [];
  for (const requested of requestedNumbers) {
    const user = usersByKey.get(employeeNumberKey(requested));
    if (!user) continue;

    const periodResults = [];
    let employmentMode = 'FT';
    for (const period of periods) {
      const dates = listDatesInclusive(period.start_date, period.end_date);
      const clocksByDate = new Map();
      for (const dateStr of dates) {
        const rows = clocksByEmpDate.get(`${employeeNumberKey(user.employee_number)}__${dateStr}`) || [];
        if (rows.length) clocksByDate.set(dateStr, rows);
      }
      const schedulesByDate = new Map();
      for (const dateStr of dates) {
        const schedule = schedulesByUserDate.get(`${user.id}_${dateStr}`);
        if (schedule) schedulesByDate.set(dateStr, schedule);
      }

      const computed = await computePeriodMinutes(user, clocksByDate, schedulesByDate, dates);
      employmentMode = computed.mode;
      periodResults.push({
        key: period.key,
        start_date: period.start_date,
        end_date: period.end_date,
        minutes: computed.minutes,
        hours: hoursFromMinutes(computed.minutes),
        hours_type: computed.mode === 'PT' ? 'work' : 'overtime',
        late_minutes: computed.late_minutes,
        late_over_threshold: Boolean(computed.late_over_threshold),
        disqualified_leave_types: computed.disqualified_leave_types || [],
        attendance_bonus_eligible: computed.attendance_bonus_eligible !== false,
        adw_entitlements: computePeriodAdwEntitlements(
          dates,
          schedulesByDate,
          holidaysByDate,
          user.id,
          leaveByUserDate
        ),
        no_pay_leave: computePeriodNoPayLeaveDays(
          dates,
          schedulesByDate,
          user.id,
          leaveByUserDate
        )
      });
    }

    employees.push({
      employee_number: user.employee_number,
      display_name: user.display_name || user.name_zh || null,
      employment_mode: employmentMode,
      periods: periodResults
    });
  }

  return {
    periods,
    employees,
    missing_employee_numbers
  };
}

module.exports = {
  getPayrollHours
};
