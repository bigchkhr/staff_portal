exports.up = function(knex) {
  return knex.schema.createTable('leave_types', function(table) {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.string('name_zh').notNullable();
    table.boolean('requires_balance').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('leave_types');
};

