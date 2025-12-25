exports.up = function(knex) {
  return knex.schema.createTable('leave_balance_transactions', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('leave_type_id').unsigned().notNullable()
      .references('id').inTable('leave_types').onDelete('CASCADE');
    table.integer('year').notNullable();
    table.decimal('amount', 10, 2).notNullable(); // 正數為增加，負數為減少
    table.date('start_date').nullable(); // 假期有效開始日期
    table.date('end_date').nullable(); // 假期有效結束日期
    table.text('remarks').nullable(); // 備註說明
    table.integer('created_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL'); // 記錄是誰添加的
    table.timestamps(true, true);
    
    table.index(['user_id', 'leave_type_id', 'year']);
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('leave_balance_transactions');
};

