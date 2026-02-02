exports.up = function(knex) {
  return knex.schema.table('department_groups', function(table) {
    // Checker 可編輯範圍（UTC+8 日期，僅日期部分；null 表示不限制）
    table.date('checker_editable_start_date').nullable();
    table.date('checker_editable_end_date').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('department_groups', function(table) {
    table.dropColumn('checker_editable_start_date');
    table.dropColumn('checker_editable_end_date');
  });
};
