exports.up = function(knex) {
  return knex.schema.table('schedules', function(table) {
    table.text('remarks').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('schedules', function(table) {
    table.dropColumn('remarks');
  });
};
