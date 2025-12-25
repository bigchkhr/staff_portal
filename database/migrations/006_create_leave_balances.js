exports.up = function(knex) {
  return knex.schema.createTable('leave_balances', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('leave_type_id').unsigned().notNullable().references('id').inTable('leave_types').onDelete('CASCADE');
    table.decimal('balance', 10, 2).defaultTo(0);
    table.decimal('taken', 10, 2).defaultTo(0);
    table.integer('year').notNullable();
    table.unique(['user_id', 'leave_type_id', 'year']);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('leave_balances');
};

