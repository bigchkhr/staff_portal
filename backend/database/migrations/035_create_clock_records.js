exports.up = function(knex) {
  return knex.schema.createTable('clock_records', function(table) {
    table.increments('id').primary();
    // POS CSV 原始數據欄位（與CSV格式一致）
    // CSV 格式：欄A=數位(不參考), 欄B=分行代碼, 欄C=運行日期(不參考), 欄D=員工ID, 欄E=員工姓名, 欄F=TILL(不參考), 欄G=Clock in/Clock out, 欄H=日期, 欄I=時間
    table.string('employee_number', 50).notNullable(); // 欄D: 員工ID
    table.string('name', 255).notNullable(); // 欄E: 員工姓名
    table.string('branch_code', 50).notNullable(); // 欄B: 分行代碼
    table.date('attendance_date').notNullable(); // 欄H: 日期
    table.time('clock_time').notNullable(); // 欄I: 時間
    table.string('in_out', 10).notNullable(); // 欄G: Clock in/Clock out (如 IN1, OUT1, IN2, OUT2)
    
    // 處理狀態欄位
    table.boolean('is_valid').defaultTo(false); // 是否為有效打卡（由批核者決定）
    table.text('remarks').nullable(); // 備註
    
    // 審計欄位
    table.integer('created_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('updated_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    
    // 索引
    table.index('employee_number');
    table.index('branch_code');
    table.index('attendance_date');
    table.index('clock_time');
    table.index('is_valid');
    table.index(['employee_number', 'attendance_date']); // 複合索引，用於查詢某員工某天的所有打卡記錄
    table.index('created_by_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('clock_records');
};
