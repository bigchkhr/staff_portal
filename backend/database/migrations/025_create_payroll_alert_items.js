exports.up = function(knex) {
  return knex.schema.createTable('payroll_alert_items', function(table) {
    table.increments('id').primary();
    table.date('created_date').notNullable(); // 建立日期
    table.string('employee_number', 20).nullable(); // 有關員工編號
    table.string('employee_name', 100).nullable(); // 有關員工姓名
    table.date('start_date').nullable(); // 開始日期
    table.date('end_date').nullable(); // 結束日期
    table.text('details').nullable(); // 詳細資料
    table.string('progress', 50).notNullable().defaultTo('pending'); // 進度：pending, in_progress, completed, cancelled
    table.integer('created_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 建立者
    table.timestamps(true, true);
    
    // 索引
    table.index('employee_number');
    table.index('created_date');
    table.index('progress');
    table.index('created_by_id');
  }).then(function() {
    // 使用raw SQL添加CHECK約束限制progress的值
    return knex.raw(`
      ALTER TABLE payroll_alert_items 
      ADD CONSTRAINT payroll_alert_items_progress_check 
      CHECK (progress IN ('pending', 'in_progress', 'completed', 'cancelled'))
    `);
  });
};

exports.down = function(knex) {
  return knex.schema.raw('ALTER TABLE payroll_alert_items DROP CONSTRAINT IF EXISTS payroll_alert_items_progress_check')
    .then(function() {
      return knex.schema.dropTable('payroll_alert_items');
    });
};

