exports.up = function(knex) {
  return knex.schema.table('department_groups', function(table) {
    table.boolean('allow_checker_edit').defaultTo(true).notNullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('department_groups', function(table) {
    table.dropColumn('allow_checker_edit');
  });
};
