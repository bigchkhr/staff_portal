exports.up = function(knex) {
  return knex.schema.createTable('attendances', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.date('attendance_date').notNullable(); // 考勤日期
    table.time('clock_in_time').nullable(); // 上班打卡時間
    table.time('clock_out_time').nullable(); // 下班打卡時間
    table.time('time_off_start').nullable(); // Time off 開始時間（半小時至一小時）
    table.time('time_off_end').nullable(); // Time off 結束時間
    table.string('status', 20).nullable(); // 考勤狀態：'on_time'（準時）, 'late'（遲到）, 'absent'（缺席）
    table.integer('late_minutes').nullable(); // 遲到分鐘數
    table.text('remarks').nullable(); // 備註
    table.integer('created_by_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.integer('updated_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
    table.index('department_group_id');
    table.index('attendance_date');
    table.index(['user_id', 'attendance_date']); // 複合索引
    table.index('status');
    table.index('created_by_id');
    
    // 唯一約束：同一用戶同一日期只能有一條考勤記錄
    table.unique(['user_id', 'attendance_date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('attendances');
};
