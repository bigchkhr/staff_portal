/**
 * Parse HH:mm / HH:mm:ss / extended hour (e.g. 26:00) to minutes from midnight.
 */
export function parseTimeToMinutes(timeVal) {
  if (timeVal == null || timeVal === '') return null;
  const parts = String(timeVal).trim().split(':');
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Roster length in minutes (handles next-day end e.g. 22:00–06:00, and extended end e.g. 26:00).
 */
export function getRosterDurationMinutes(startTime, endTime) {
  const sm = parseTimeToMinutes(startTime);
  const em = parseTimeToMinutes(endTime);
  if (sm == null || em == null) return null;
  let endM = em;
  if (em < 24 * 60 && em <= sm) {
    endM = em + 24 * 60;
  }
  const diff = endM - sm;
  if (diff <= 0) return null;
  return diff;
}
