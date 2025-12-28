exports.up = function(knex) {
  return knex.schema
    // 建立公告表
    .createTable('announcements', function(table) {
      table.increments('id').primary();
      table.string('title', 255).notNullable(); // 公告標題
      table.text('content').notNullable(); // 公告內容
      table.integer('created_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 創建者
      table.boolean('is_pinned').defaultTo(false); // 是否置頂
      table.timestamps(true, true);
      
      // 索引
      table.index('created_by_id');
      table.index('is_pinned');
      table.index('created_at');
    })
    // 建立公告附件表
    .createTable('announcement_attachments', function(table) {
      table.increments('id').primary();
      table.integer('announcement_id').unsigned().notNullable().references('id').inTable('announcements').onDelete('CASCADE'); // 所屬公告
      table.string('file_name').notNullable(); // 文件名
      table.string('file_path').notNullable(); // 文件路徑
      table.string('file_type').nullable(); // MIME type
      table.integer('file_size').nullable(); // 文件大小（bytes）
      table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 上傳者
      table.timestamps(true, true);
      
      // 索引
      table.index('announcement_id');
      table.index('uploaded_by_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('announcement_attachments')
    .dropTableIfExists('announcements');
};

