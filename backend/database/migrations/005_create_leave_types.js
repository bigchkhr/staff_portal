exports.up = function(knex) {
  return knex.schema.createTable('leave_types', function(table) {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.string('name').notNullable();
    table.string('name_zh').notNullable();
    table.boolean('requires_balance').defaultTo(true);
    table.boolean('is_active').defaultTo(true);
    table.boolean('allow_schedule_input').defaultTo(false);
    table.boolean('is_available_in_flow').defaultTo(true); // 是否在 e-flow 及 paper-flow 申請時被載入假期類型供選擇
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('leave_types');
};
