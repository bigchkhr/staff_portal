exports.up = function(knex) {
  return knex.schema.createTable('chat_messages', function(table) {
    table.increments('id').primary();
    table.integer('chat_room_id').unsigned().notNullable()
      .references('id').inTable('chat_rooms').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.text('message').nullable(); // 文字訊息（可為空，如果有附件）
    table.string('file_name', 500).nullable(); // 附件檔案名稱
    table.string('file_path', 1000).nullable(); // 附件檔案路徑
    table.string('file_type', 100).nullable(); // 附件檔案類型（MIME type）
    table.bigInteger('file_size').nullable(); // 附件檔案大小（bytes）
    table.string('original_file_name', 500).nullable(); // 原始檔案名稱
    table.timestamps(true, true);
    
    // 索引
    table.index('chat_room_id');
    table.index('user_id');
    table.index('created_at');
    table.index(['chat_room_id', 'created_at']); // 複合索引，用於查詢聊天室訊息
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('chat_messages');
};

