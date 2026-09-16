const knex = require('../config/database');
const LeaveType = require('../database/models/LeaveType');
const LeaveBalanceTransaction = require('../database/models/LeaveBalanceTransaction');
const { toHKCalendarDate } = require('../utils/hkDate');
const { calculateAnnualLeaveForYear } = require('../utils/annualLeave');

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

async function findAnnualLeaveType() {
  return (
    (await LeaveType.findByCode('AL')) ||
    (await knex('leave_types').where('name_zh', 'like', '%年假%').first())
  );
}

async function applyYearEntitlement(user, year, leaveType, actorUserId) {
  const calc = calculateAnnualLeaveForYear(user, year);
  const blocking = ['missing_hire_date', 'missing_al_base', 'missing_al_cap'];
  if (calc.warnings.some((w) => blocking.includes(w))) {
    return {
      year,
      calculated_days: calc.calculated_days,
      raw_days: calc.raw_days,
      full_entitlement: calc.full_entitlement,
      current_total: null,
      adjustment: 0,
      warnings: calc.warnings,
      work_start: calc.work_start,
      work_end: calc.work_end,
      applied: false,
      skipped_reason: calc.warnings.find((w) => blocking.includes(w)),
      transaction: null
    };
  }

  const target = round2(calc.calculated_days || 0);
  const currentTotal = round2(
    await LeaveBalanceTransaction.getTotalBalance(user.id, leaveType.id, year)
  );
  const diff = round2(target - currentTotal);
  const terminationDate = toHKCalendarDate(user.termination_date);

  const existingTx = await knex('leave_balance_transactions')
    .where({
      user_id: user.id,
      leave_type_id: leaveType.id,
      year
    })
    .whereNotNull('created_by_id')
    .orderBy('created_at', 'desc')
    .first();

  const startDate =
    calc.work_start ||
    toHKCalendarDate(existingTx?.start_date) ||
    `${year}-01-01`;
  const endDate =
    calc.work_end ||
    toHKCalendarDate(existingTx?.end_date) ||
    `${year}-12-31`;

  if (calc.work_end) {
    await knex('leave_balance_transactions')
      .where({
        user_id: user.id,
        leave_type_id: leaveType.id,
        year
      })
      .whereNotNull('created_by_id')
      .where('end_date', '>', calc.work_end)
      .update({ end_date: calc.work_end });
  }

  const result = {
    year,
    calculated_days: target,
    raw_days: calc.raw_days,
    full_entitlement: calc.full_entitlement,
    current_total: currentTotal,
    adjustment: diff,
    warnings: calc.warnings,
    work_start: startDate,
    work_end: endDate,
    applied: false,
    transaction: null
  };

  if (Math.abs(diff) < 0.001) {
    return result;
  }

  const remarks = terminationDate
    ? `${year}年度年假按離職日 ${terminationDate} 自動計算（${Number(target).toFixed(2)} 日，兩位小數不捨入至 0.5）`
    : `${year}年度年假自動計算（${target}）`;

  const transaction = await LeaveBalanceTransaction.create({
    user_id: user.id,
    leave_type_id: leaveType.id,
    year,
    amount: diff,
    start_date: startDate,
    end_date: endDate,
    remarks,
    created_by_id: actorUserId
  });

  result.applied = true;
  result.transaction = transaction;
  result.current_total = round2(currentTotal + diff);
  return result;
}

/**
 * 有離職日時，將年假餘額調至與試算相同（離職年保留兩位小數，不捨入至 0.5）。
 * year 有值時只處理該年（且須 ≥ 離職年）；否則處理離職年及之後已有額度的年份。
 */
async function syncAnnualLeaveForTermination(user, actorUserId, options = {}) {
  const terminationDate = toHKCalendarDate(user.termination_date);
  if (!terminationDate) {
    return { skipped: true, reason: 'no_termination_date', years: [] };
  }

  const leaveType = await findAnnualLeaveType();
  if (!leaveType) {
    return { skipped: true, reason: 'no_leave_type', years: [] };
  }

  const termYear = parseInt(terminationDate.slice(0, 4), 10);
  const years = new Set();

  if (options.year) {
    const y = parseInt(options.year, 10);
    if (Number.isFinite(y) && y >= termYear) {
      years.add(y);
    }
  } else {
    years.add(termYear);
    const existing = await knex('leave_balance_transactions')
      .where({
        user_id: user.id,
        leave_type_id: leaveType.id
      })
      .whereNotNull('created_by_id')
      .where('year', '>=', termYear)
      .distinct('year');
    existing.forEach((row) => years.add(parseInt(row.year, 10)));
  }

  const yearResults = [];
  for (const year of [...years].sort()) {
    yearResults.push(await applyYearEntitlement(user, year, leaveType, actorUserId));
  }

  return {
    skipped: false,
    termination_date: terminationDate,
    leave_type: {
      id: leaveType.id,
      code: leaveType.code,
      name_zh: leaveType.name_zh
    },
    years: yearResults
  };
}

module.exports = {
  findAnnualLeaveType,
  syncAnnualLeaveForTermination
};
