exports.up = function(knex) {
  return knex.schema.createTable('stores', function(table) {
    table.increments('id').primary();
    table.string('store_code', 50).notNullable().unique();
    table.string('store_short_name_', 100);
    table.text('address_en');
    table.text('address_chi');
    table.string('tel', 50);
    table.string('email', 255);
    table.date('open_date');
    table.date('close_date');
    table.string('district', 100);
    table.boolean('is_closed').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('stores');
};
