const knex = require('../config/database');

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftTime(query) {
  query.where(function hasShiftTime() {
    this.whereNotNull('schedules.start_time').orWhere(function endTime() {
      this.whereNotNull('schedules.end_time').where('schedules.end_time', '!=', '');
    });
  });
}

function countMode(mode) {
  const value = String(mode || '').trim().toUpperCase();
  if (value === 'FT' || value === 'PT') return value;
  return null;
}

/**
 * Same FT/PT split as the schedule summary: a person counts only when that day has a shift time.
 * Home store is schedules.store_id. A loaned store counts as well, once per person per store.
 * Stores that do not exist are omitted so the caller can tell "no store" from "zero people".
 */
async function getScheduleHeadcount({ date, store_codes: storeCodes }) {
  const day = String(date || '').trim();
  if (!YMD_RE.test(day)) {
    const error = new Error('date must be YYYY-MM-DD');
    error.status = 400;
    throw error;
  }
  const codes = [...new Set((storeCodes || []).map((code) => String(code || '').trim()).filter(Boolean))];
  if (!codes.length) return { date: day, stores: [] };
  if (codes.length > 500) {
    const error = new Error('store_codes cannot exceed 500');
    error.status = 400;
    throw error;
  }

  const knownRows = await knex('stores').whereIn('store_code', codes).select('id', 'store_code');
  if (!knownRows.length) return { date: day, stores: [] };
  const codeByStoreId = new Map(knownRows.map((row) => [Number(row.id), String(row.store_code)]));
  const storeIds = [...codeByStoreId.keys()];

  const homeRows = await knex('schedules')
    .leftJoin('users', 'schedules.user_id', 'users.id')
    .leftJoin('positions', 'users.position_id', 'positions.id')
    .where('schedules.schedule_date', day)
    .whereIn('schedules.store_id', storeIds)
    .modify(shiftTime)
    .select('schedules.user_id', 'schedules.store_id', 'positions.employment_mode');

  const loanRows = await knex('schedule_duty_assignments')
    .join('schedules', 'schedule_duty_assignments.schedule_id', 'schedules.id')
    .leftJoin('users', 'schedules.user_id', 'users.id')
    .leftJoin('positions', 'users.position_id', 'positions.id')
    .where('schedules.schedule_date', day)
    .whereIn('schedule_duty_assignments.loan_store_id', storeIds)
    .modify(shiftTime)
    .select(
      'schedules.user_id',
      'schedule_duty_assignments.loan_store_id as store_id',
      'positions.employment_mode'
    );

  const seen = new Set();
  const counts = new Map(knownRows.map((row) => [String(row.store_code), { store_code: String(row.store_code), ft: 0, pt: 0 }]));
  for (const row of [...homeRows, ...loanRows]) {
    const code = codeByStoreId.get(Number(row.store_id));
    const mode = countMode(row.employment_mode);
    const userId = Number(row.user_id);
    if (!code || !mode || !userId) continue;
    const key = `${code}:${userId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.get(code)[mode === 'FT' ? 'ft' : 'pt'] += 1;
  }

  return { date: day, stores: [...counts.values()] };
}

module.exports = {
  getScheduleHeadcount
};
