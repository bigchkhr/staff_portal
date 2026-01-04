exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.boolean('force_password_change').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('force_password_change');
  });
};
