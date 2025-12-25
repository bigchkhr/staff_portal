exports.up = function(knex) {
  return knex.schema.createTable('form_library', function(table) {
    table.increments('id').primary();
    table.string('display_name').notNullable(); // 顯示名稱（用戶輸入的）
    table.string('file_name').notNullable(); // 實際文件名
    table.string('file_path').notNullable(); // 文件路徑
    table.string('file_type').nullable(); // MIME type
    table.integer('file_size').nullable(); // bytes
    table.boolean('visible_to_users').defaultTo(true); // 是否對所有用戶可見
    table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('description').nullable(); // 文件描述（可選）
    table.timestamps(true, true);
    
    // 索引
    table.index('uploaded_by_id');
    table.index('visible_to_users');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('form_library');
};

