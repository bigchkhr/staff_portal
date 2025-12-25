exports.up = function(knex) {
  return knex.schema.createTable('positions', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('name_zh').notNullable();
    table.text('description').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('positions');
};
