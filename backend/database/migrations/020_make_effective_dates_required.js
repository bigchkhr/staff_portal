exports.up = function(knex) {
  return knex.schema.alterTable('leave_balance_transactions', function(table) {
    // 修改 start_date 和 end_date 為必填欄位
    table.date('start_date').notNullable().alter();
    table.date('end_date').notNullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('leave_balance_transactions', function(table) {
    // 回復為可選欄位
    table.date('start_date').nullable().alter();
    table.date('end_date').nullable().alter();
  });
};
