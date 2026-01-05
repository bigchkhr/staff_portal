exports.up = function(knex) {
  return knex.schema.createTable('schedules', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.date('schedule_date').notNullable(); // 排班日期
    table.time('start_time').nullable(); // 開始時間
    table.time('end_time').nullable(); // 結束時間
    table.integer('leave_type_id').unsigned().nullable()
      .references('id').inTable('leave_types').onDelete('SET NULL'); // 假期類別
    table.boolean('is_morning_leave').defaultTo(false); // 是否上午假
    table.boolean('is_afternoon_leave').defaultTo(false); // 是否下午假
    table.integer('created_by_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.integer('updated_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
    table.index('department_group_id');
    table.index('schedule_date');
    table.index(['user_id', 'schedule_date']); // 複合索引，確保同一用戶同一日期只有一條記錄
    table.index('created_by_id');
    
    // 唯一約束：同一用戶同一日期只能有一條排班記錄
    table.unique(['user_id', 'schedule_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('schedules');
};
