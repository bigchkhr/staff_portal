exports.up = function(knex) {
  return knex.schema.createTable('positions', function(table) {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('name_zh').notNullable();
    table.text('description').nullable();
    table.string('employment_mode').defaultTo('FT'); // FT (Full-Time) or PT (Part-Time)
    table.string('stream').defaultTo('Head Office'); // Head Office or Store
    table.integer('display_order').defaultTo(0); // 用於排序顯示順序
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('positions');
};
