exports.up = function(knex) {
  return knex.schema.createTable('group_permissions', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE');
    table.boolean('can_view').defaultTo(false);
    table.boolean('can_approve').defaultTo(false);
    table.unique(['user_id', 'group_id']);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('group_permissions');
};

