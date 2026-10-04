exports.up = function (knex) {
  return knex.schema.alterTable('leave_types', function (table) {
    table.boolean('counts_as_working_days').notNullable().defaultTo(false);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('leave_types', function (table) {
    table.dropColumn('counts_as_working_days');
  });
};
