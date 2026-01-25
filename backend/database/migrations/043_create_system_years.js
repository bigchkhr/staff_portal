exports.up = function(knex) {
  return knex.schema.createTable('system_years', function(table) {
    table.increments('id').primary();
    table.integer('year').notNullable().unique();
    table.boolean('is_active').defaultTo(true);
    table.integer('display_order').defaultTo(0);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('system_years');
};
