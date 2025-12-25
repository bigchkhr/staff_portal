// 此 migration 已被廢棄，leave_balances 表不再使用
// 現在使用 leave_balance_transactions 表來管理假期餘額
exports.up = function(knex) {
  // 空操作，不再創建 leave_balances 表
  return Promise.resolve();
};

exports.down = function(knex) {
  // 空操作
  return Promise.resolve();
};
