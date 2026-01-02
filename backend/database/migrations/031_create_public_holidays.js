exports.up = function(knex) {
  return knex.schema.createTable('public_holidays', function(table) {
    table.increments('id').primary();
    table.date('date').notNullable(); // 法定假期日期
    table.string('name', 255).notNullable(); // 英文名稱
    table.string('name_zh', 255).notNullable(); // 中文名稱
    table.integer('year').notNullable(); // 年份（用於快速查詢和索引）
    table.timestamps(true, true);
    
    // 索引
    table.index('date');
    table.index('year');
    // 確保同一日期不會重複
    table.unique('date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('public_holidays');
};

