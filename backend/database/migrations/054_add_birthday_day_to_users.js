exports.up = function (knex) {
  return knex.schema.alterTable('users', function (table) {
    table.integer('birthday_day').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', function (table) {
    table.dropColumn('birthday_day');
  });
};
