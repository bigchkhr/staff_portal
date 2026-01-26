exports.up = function(knex) {
  return knex.schema.alterTable('monthly_attendance_reports', function(table) {
    // 將 rest_days_days 重命名為 current_rest_days_days (本月例假)
    table.renameColumn('rest_days_days', 'current_rest_days_days');
    // 添加新欄位 accumulated_rest_days_days (累積例假)
    table.decimal('accumulated_rest_days_days', 5, 2).defaultTo(0);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('monthly_attendance_reports', function(table) {
    // 還原：將 current_rest_days_days 重命名回 rest_days_days
    table.renameColumn('current_rest_days_days', 'rest_days_days');
    // 刪除 accumulated_rest_days_days 欄位
    table.dropColumn('accumulated_rest_days_days');
  });
};

