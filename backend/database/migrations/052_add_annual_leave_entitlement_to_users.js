exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 年假起步日數（每人可不同）；null = 未設定，批量試算會略過／警告
    table.decimal('al_base_days', 10, 2).nullable();
    // 年假封頂日數；null = 未設定
    table.decimal('al_cap_days', 10, 2).nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('al_base_days');
    table.dropColumn('al_cap_days');
  });
};
