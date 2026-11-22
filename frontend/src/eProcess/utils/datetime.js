/** Display helpers for E-Process — times in Asia/Hong_Kong (UTC+8). */
import { ep } from '../useEp';

const APP_IANA = 'Asia/Hong_Kong';
const OPEN_TASK_STATUSES = new Set(['blocked', 'pending', 'in_progress']);

export function formatDateTimeHkt(value) {
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

export function formatDateHkt(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayHktDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_IANA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function isTaskOverdue(task) {
  if (!task || !OPEN_TASK_STATUSES.has(task.status)) return false;
  if (typeof task.is_overdue === 'boolean') return task.is_overdue;
  if (!task.end_date) return false;
  return String(task.end_date).slice(0, 10) < todayHktDateString();
}

export function isRunOverdue(run, tasks = []) {
  if (!run || run.status !== 'active') return false;
  if (tasks.length) return tasks.some(isTaskOverdue);
  if (typeof run.is_overdue === 'boolean') return run.is_overdue;
  return false;
}

/** Name (employee number). Username is the Staff Portal employee number. */
export function personWithEmployeeNumber(name, employeeNumber) {
  const label = String(name || '').trim();
  const number = String(employeeNumber || '').trim();
  if (label && number && label !== number) return `${label} (${number})`;
  return label || number || ep('common.user');
}

/** Assignee: name (employee number). */
export function assigneeLabel(task) {
  if (!task?.assigned_to) {
    if (task?.assignee_is_work_group || task?.assignee_group_name) {
      return task.assignee_group_name || ep('step.workGroupMembers');
    }
    return ep('common.unassigned');
  }
  return personWithEmployeeNumber(task.assigned_to_name, task.assigned_to_username);
}

/** Who finished the step: name (employee number). */
export function completedByLabel(task) {
  if (!task?.completed_by) return '';
  return personWithEmployeeNumber(task.completed_by_name, task.completed_by_username);
}

export function defaultEndDatePlusDays(days = 7) {
  const today = todayHktDateString();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
