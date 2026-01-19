exports.up = function(knex) {
  return knex.schema.createTable('monthly_attendance_summaries', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('year').notNullable(); // 年份，如 2024
    table.integer('month').notNullable(); // 月份，1-12
    // 每天的數據，用JSONB儲存array of objects
    // 每個object包含：date, late_minutes, break_duration, total_work_hours, overtime_hours, early_leave, is_late, is_absent, attendance_data
    table.specificType('daily_data', 'jsonb').defaultTo('[]');
    table.integer('created_by_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
    table.index(['user_id', 'year', 'month']);
    table.unique(['user_id', 'year', 'month']); // 每個員工每個月只能有一個記錄
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('monthly_attendance_summaries');
};
