exports.up = function(knex) {
  return knex.schema.createTable('monthly_attendance_reports', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('year').notNullable(); // 年份，如 2024
    table.integer('month').notNullable(); // 月份，1-12
    
    // 假期統計（自動歸類）
    // 年假類
    table.decimal('annual_leave_days', 5, 2).defaultTo(0); // 年假
    table.decimal('birthday_leave_days', 5, 2).defaultTo(0); // 生日假
    table.decimal('compensatory_leave_days', 5, 2).defaultTo(0); // 補假
    
    // 病假類
    table.decimal('full_paid_sick_leave_days', 5, 2).defaultTo(0); // 全薪病假
    table.decimal('sick_leave_with_allowance_days', 5, 2).defaultTo(0); // 病假 (疾病津貼)
    table.decimal('no_pay_sick_leave_days', 5, 2).defaultTo(0); // 無薪病假
    table.decimal('work_injury_leave_days', 5, 2).defaultTo(0); // 工傷病假
    
    // 其他假期類
    table.decimal('marriage_leave_days', 5, 2).defaultTo(0); // 婚假
    table.decimal('maternity_leave_days', 5, 2).defaultTo(0); // 產假
    table.decimal('paternity_leave_days', 5, 2).defaultTo(0); // 侍產假
    table.decimal('jury_service_leave_days', 5, 2).defaultTo(0); // 陪審團假
    table.decimal('compassionate_leave_days', 5, 2).defaultTo(0); // 恩恤假
    table.decimal('no_pay_personal_leave_days', 5, 2).defaultTo(0); // 無薪事假
    table.decimal('special_leave_days', 5, 2).defaultTo(0); // 特別假期
    table.decimal('rest_days_days', 5, 2).defaultTo(0); // 例假
    table.decimal('statutory_holiday_days', 5, 2).defaultTo(0); // 法定假期
    table.decimal('absent_days', 5, 2).defaultTo(0); // 缺勤
    
    // 工作統計
    table.decimal('work_days', 5, 2).defaultTo(0); // 上班日數
    table.integer('late_count').defaultTo(0); // 遲到次數
    table.decimal('late_total_minutes', 10, 2).defaultTo(0); // 遲到總時數（分鐘）
    
    // FT 相關
    table.decimal('ft_overtime_hours', 10, 2).defaultTo(0); // FT 超時工作時數
    
    // PT 相關
    table.decimal('pt_work_hours', 10, 2).defaultTo(0); // PT 工作時數
    
    // 手動輸入的津貼（金額）
    table.decimal('store_manager_allowance', 10, 2).defaultTo(0); // Store Manager Allowance
    table.decimal('attendance_bonus', 10, 2).defaultTo(0); // Attendance Bonus
    table.decimal('location_allowance', 10, 2).defaultTo(0); // Location Allowance
    table.decimal('incentive', 10, 2).defaultTo(0); // Incentive
    table.decimal('special_allowance', 10, 2).defaultTo(0); // 特別津貼
    
    // 備註
    table.text('remarks');
    
    // 審計字段
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
  return knex.schema.dropTableIfExists('monthly_attendance_reports');
};

