/**
 * Same rule as Store Wage Cost Report:
 * leave day → leave type `counts_as_working_days`, or half-day leave with work
 * non-leave → clocked or rostered shift
 */
function hasWorkOnDay(schedule, clocks) {
  if (Array.isArray(clocks) && clocks.length > 0) return true;
  if (schedule && schedule.start_time && schedule.end_time) return true;
  return false;
}

function isLeaveDay(schedule, leave) {
  return Boolean(leave || (schedule && schedule.leave_type_code));
}

function leaveSession(dateStr, schedule, leave, getSessionForDate) {
  if (leave && typeof getSessionForDate === 'function') {
    return getSessionForDate(leave, dateStr) || null;
  }
  return (schedule && schedule.leave_session) || null;
}

function countsAsWorkingDay({ dateStr, schedule, leave, clocks, getSessionForDate }) {
  const isLeave = isLeaveDay(schedule, leave);
  const work = hasWorkOnDay(schedule, clocks);
  const flagged = Boolean(
    (schedule && schedule.counts_as_working_days) || (leave && leave.counts_as_working_days)
  );

  if (isLeave) {
    if (flagged) return 1;
    const session = leaveSession(dateStr, schedule, leave, getSessionForDate);
    const isFullDayLeave = !session;
    if (!isFullDayLeave && work) return 1;
    return 0;
  }

  return work ? 1 : 0;
}

function sumWorkingDays({ dates, schedulesByDate, leaveByDate, clocksByDate, getSessionForDate }) {
  let days = 0;
  for (const dateStr of dates || []) {
    days += countsAsWorkingDay({
      dateStr,
      schedule: schedulesByDate.get(dateStr) || null,
      leave: leaveByDate.get(dateStr) || null,
      clocks: clocksByDate.get(dateStr) || [],
      getSessionForDate
    });
  }
  return Math.round(days * 100) / 100;
}

module.exports = {
  hasWorkOnDay,
  isLeaveDay,
  countsAsWorkingDay,
  sumWorkingDays
};
