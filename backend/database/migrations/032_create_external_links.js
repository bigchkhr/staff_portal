exports.up = function(knex) {
  return knex.schema.createTable('external_links', function(table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable(); // 連結名稱
    table.text('narrative').nullable(); // 描述/說明
    table.string('logo_url', 500).nullable(); // 外部 logo 連結
    table.string('url', 500).notNullable(); // 外部連結 URL
    table.integer('created_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 創建者
    table.integer('updated_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL'); // 最後更新者
    table.integer('display_order').defaultTo(0); // 顯示順序
    table.boolean('is_active').defaultTo(true); // 是否啟用
    table.timestamps(true, true);
    
    // 索引
    table.index('created_by_id');
    table.index('is_active');
    table.index('display_order');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('external_links');
};

