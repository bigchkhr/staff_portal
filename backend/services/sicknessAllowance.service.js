const knex = require('../config/database');
const LeaveType = require('../database/models/LeaveType');
const LeaveBalance = require('../database/models/LeaveBalance');
const { toHKCalendarDate, todayHK } = require('../utils/hkDate');
const {
  MAX_SICKNESS_DAYS,
  SAL_OPEN_END,
  isSicknessAllowance,
  planSicknessAllowance
} = require('../utils/sicknessAllowance');

async function resolveSicknessLeaveType() {
  return (
    (await LeaveType.findByCode('SAL')) ||
    (await knex('leave_types')
      .where('name_zh', 'like', '%病假%')
      .where('name_zh', 'like', '%疾病津貼%')
      .first())
  );
}

function groupByUser(rows, mapRow) {
  const grouped = {};
  rows.forEach((row) => {
    const userId = row.user_id;
    if (!grouped[userId]) grouped[userId] = [];
    grouped[userId].push(mapRow(row));
  });
  return grouped;
}

async function loadBundle(db, leaveTypeId) {
  const [users, transactions, applications] = await Promise.all([
    db('users')
      .select(
        'id',
        'employee_number',
        'display_name',
        'name_zh',
        'hire_date',
        'termination_date',
        'deactivated'
      )
      .where('deactivated', false)
      .orderBy('employee_number', 'asc'),
    db('leave_balance_transactions')
      .select('user_id', 'amount', 'accrual_key', 'start_date', 'created_at')
      .where({ leave_type_id: leaveTypeId })
      .whereNotNull('created_by_id'),
    db('leave_applications')
      .select('user_id', 'start_date', 'total_days', 'is_reversal_transaction', 'created_at')
      .where({ leave_type_id: leaveTypeId, status: 'approved' })
  ]);

  const grantsByUser = {};
  const manualsByUser = {};
  transactions.forEach((row) => {
    if (row.accrual_key) {
      if (!grantsByUser[row.user_id]) grantsByUser[row.user_id] = [];
      grantsByUser[row.user_id].push({
        accrual_key: row.accrual_key,
        amount: parseFloat(row.amount) || 0
      });
      return;
    }
    if (!manualsByUser[row.user_id]) manualsByUser[row.user_id] = [];
    manualsByUser[row.user_id].push({
      date: toHKCalendarDate(row.start_date) || toHKCalendarDate(row.created_at),
      amount: parseFloat(row.amount) || 0
    });
  });

  const applicationsByUser = groupByUser(applications, (row) => ({
    date: toHKCalendarDate(row.start_date) || toHKCalendarDate(row.created_at),
    days: parseFloat(row.total_days) || 0,
    reversal: !!row.is_reversal_transaction
  }));

  return { users, grantsByUser, manualsByUser, applicationsByUser };
}

function planUser(user, bundle, mode, asOf) {
  const plan = planSicknessAllowance({
    hireDate: user.hire_date,
    terminationDate: user.termination_date,
    asOf,
    existingGrants: bundle.grantsByUser[user.id] || [],
    manualAdjustments: bundle.manualsByUser[user.id] || [],
    applications: bundle.applicationsByUser[user.id] || [],
    mode
  });
  return {
    user_id: user.id,
    employee_number: user.employee_number,
    display_name: user.display_name || user.name_zh || '',
    hire_date: toHKCalendarDate(user.hire_date),
    termination_date: toHKCalendarDate(user.termination_date),
    ...plan,
    selected_default: plan.selectable
  };
}

async function previewSicknessAllowance({ mode = 'monthly', asOf } = {}) {
  const leaveType = await resolveSicknessLeaveType();
  if (!leaveType) {
    const error = new Error('找不到疾病津貼假假期類型（SAL）');
    error.status = 400;
    throw error;
  }
  const targetDate = toHKCalendarDate(asOf) || todayHK();
  const grantMode = mode === 'backfill' ? 'backfill' : 'monthly';
  const bundle = await loadBundle(knex, leaveType.id);
  const items = bundle.users.map((user) => {
    const planned = planUser(user, bundle, grantMode, targetDate);
    const { grants, ...preview } = planned;
    return preview;
  });

  return {
    mode: grantMode,
    as_of: targetDate,
    max_days: MAX_SICKNESS_DAYS,
    leave_type: {
      id: leaveType.id,
      code: leaveType.code,
      name: leaveType.name,
      name_zh: leaveType.name_zh
    },
    items
  };
}

function grantRemark(grant) {
  if (grant.amount > 0) {
    return `疾病津貼假：第 ${grant.index} 個完整月（${grant.end_date}）發放 ${grant.amount} 日`;
  }
  return `疾病津貼假：第 ${grant.index} 個完整月（${grant.end_date}）已達 ${MAX_SICKNESS_DAYS} 日上限，不加日數`;
}

async function confirmSicknessAllowance({ mode = 'monthly', asOf, userIds, createdById }) {
  const leaveType = await resolveSicknessLeaveType();
  if (!leaveType) {
    const error = new Error('找不到疾病津貼假假期類型（SAL）');
    error.status = 400;
    throw error;
  }
  const ids = [...new Set((userIds || []).map((id) => parseInt(id, 10)).filter(Boolean))];
  if (ids.length === 0) {
    const error = new Error('請選擇至少一位員工');
    error.status = 400;
    throw error;
  }

  const targetDate = toHKCalendarDate(asOf) || todayHK();
  const grantMode = mode === 'backfill' ? 'backfill' : 'monthly';
  const created = [];
  const skipped = [];

  await knex.transaction(async (trx) => {
    const bundle = await loadBundle(trx, leaveType.id);
    const usersById = {};
    bundle.users.forEach((user) => {
      usersById[user.id] = user;
    });

    for (const userId of ids) {
      const user = usersById[userId];
      if (!user) {
        skipped.push({ user_id: userId, reason: 'user_not_found' });
        continue;
      }
      const plan = planUser(user, bundle, grantMode, targetDate);
      if (!plan.grants.length) {
        skipped.push({
          user_id: userId,
          reason: plan.warnings.includes('needs_backfill') ? 'needs_backfill' : 'nothing_to_grant'
        });
        continue;
      }

      for (const grant of plan.grants) {
        const inserted = await trx('leave_balance_transactions')
          .insert({
            user_id: userId,
            leave_type_id: leaveType.id,
            year: grant.year,
            amount: grant.amount,
            start_date: grant.end_date,
            end_date: SAL_OPEN_END,
            remarks: grantRemark(grant),
            created_by_id: createdById,
            accrual_key: grant.accrual_key
          })
          .onConflict(['user_id', 'leave_type_id', 'accrual_key'])
          .ignore()
          .returning('*');

        if (inserted && inserted.length > 0) {
          created.push(inserted[0]);
        } else {
          skipped.push({ user_id: userId, accrual_key: grant.accrual_key, reason: 'already_granted' });
        }
      }
    }
  });

  return {
    message: `已寫入 ${created.length} 筆疾病津貼假紀錄`,
    created_count: created.length,
    skipped_count: skipped.length,
    created,
    skipped
  };
}

async function grantSicknessAllowanceManual({ userId, amount, remarks, createdById, startDate, endDate }) {
  const leaveType = await resolveSicknessLeaveType();
  if (!leaveType) {
    return { ok: false, message: '找不到疾病津貼假假期類型（SAL）' };
  }
  const parsedUserId = parseInt(userId, 10);
  const requested = roundAmount(amount);
  if (!parsedUserId || !Number.isFinite(requested) || requested === 0) {
    return { ok: false, message: '請選擇員工並輸入非 0 的日數' };
  }

  const user = await knex('users').where({ id: parsedUserId }).first();
  if (!user) return { ok: false, message: '用戶不存在' };

  const balanceInfo = await LeaveBalance.findByUserAndType(
    parsedUserId,
    leaveType.id,
    new Date().getFullYear()
  );
  const current = parseFloat(balanceInfo.balance) || 0;
  let actual = requested;
  let capped = false;
  if (requested > 0) {
    const room = Math.max(0, roundAmount(MAX_SICKNESS_DAYS - current));
    actual = roundAmount(Math.min(requested, room));
    capped = actual < requested;
    if (actual <= 0) {
      return {
        ok: false,
        message: `疾病津貼假未用餘額已達 ${MAX_SICKNESS_DAYS} 日上限`,
        balance: current
      };
    }
  }

  const today = todayHK();
  const transactionStart = toHKCalendarDate(startDate) || today;
  const transactionEnd = toHKCalendarDate(endDate) || SAL_OPEN_END;
  if (transactionStart > transactionEnd) {
    return { ok: false, message: '有效開始日期不能晚於結束日期' };
  }

  const [transaction] = await knex('leave_balance_transactions')
    .insert({
      user_id: parsedUserId,
      leave_type_id: leaveType.id,
      year: parseInt(transactionStart.slice(0, 4), 10),
      amount: actual,
      start_date: transactionStart,
      end_date: transactionEnd,
      remarks: remarks || '人手發放疾病津貼假',
      created_by_id: createdById,
      accrual_key: null
    })
    .returning('*');

  const updated = await LeaveBalance.findByUserAndType(
    parsedUserId,
    leaveType.id,
    new Date().getFullYear()
  );

  return {
    ok: true,
    message: capped
      ? `已發放 ${actual} 日（申請 ${requested} 日，餘額不可超過 ${MAX_SICKNESS_DAYS} 日）`
      : `已人手發放 ${actual} 日`,
    granted_days: actual,
    requested_days: requested,
    capped,
    transaction,
    balance: updated
  };
}

function roundAmount(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = {
  resolveSicknessLeaveType,
  previewSicknessAllowance,
  confirmSicknessAllowance,
  grantSicknessAllowanceManual,
  isSicknessAllowance
};
