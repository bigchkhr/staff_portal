exports.up = function (knex) {
  return knex.schema.alterTable('users', function (table) {
    table.integer('birthday_month').nullable();
    table.date('probation_end_date').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', function (table) {
    table.dropColumn('birthday_month');
    table.dropColumn('probation_end_date');
  });
};
