/**
 * E-Process date helpers — display / compare in app timezone (UTC+8 / Asia/Hong_Kong).
 */

const APP_TZ = 'UTC+8';
const APP_IANA = 'Asia/Hong_Kong';

function todayHktDateString(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function normalizeDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return String(value.toISOString()).slice(0, 10);
  }
  const s = String(value).trim();
  if (s === '') return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.toISOString()).slice(0, 10);
}

const OPEN_TASK_STATUSES = new Set(['blocked', 'pending', 'in_progress']);

/** Open task with end_date in the past → overdue. Empty end_date = never overdue. */
function isTaskOverdue(task, now = new Date()) {
  if (!task || !OPEN_TASK_STATUSES.has(task.status)) return false;
  const end = normalizeDateOnly(task.end_date);
  if (!end) return false;
  return end < todayHktDateString(now);
}

/** Run is overdue if any open task is overdue. */
function isRunOverdue(run, tasks = [], now = new Date()) {
  if (!run || run.status !== 'active') return false;
  if (typeof run.is_overdue === 'boolean' && !tasks.length) return run.is_overdue;
  return tasks.some((t) => isTaskOverdue(t, now));
}

function formatDateTimeHkt(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function withTaskTimeFields(task) {
  const end_date = normalizeDateOnly(task.end_date);
  return {
    ...task,
    end_date,
    is_overdue: isTaskOverdue({ ...task, end_date }),
    completed_at_hkt: formatDateTimeHkt(task.completed_at),
  };
}

function withRunScheduleFields(run, tasks = []) {
  const enrichedTasks = tasks.map(withTaskTimeFields);
  return {
    ...run,
    is_overdue: isRunOverdue(run, enrichedTasks),
    completed_at_hkt: formatDateTimeHkt(run.completed_at),
    tasks: enrichedTasks.length ? enrichedTasks : undefined,
  };
}

module.exports = {
  APP_TZ,
  APP_IANA,
  todayHktDateString,
  normalizeDateOnly,
  isTaskOverdue,
  isRunOverdue,
  formatDateTimeHkt,
  withRunScheduleFields,
  withTaskTimeFields,
  OPEN_TASK_STATUSES,
};
