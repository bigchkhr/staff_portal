exports.up = function(knex) {
  return knex.schema.table('schedules', function(table) {
    table.integer('store_id').unsigned().nullable()
      .references('id').inTable('stores').onDelete('SET NULL');
    table.index('store_id');
  });
};

exports.down = function(knex) {
  return knex.schema.table('schedules', function(table) {
    table.dropIndex('store_id');
    table.dropColumn('store_id');
  });
};
