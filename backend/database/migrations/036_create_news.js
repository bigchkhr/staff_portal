exports.up = function(knex) {
  return knex.schema
    // 建立最新消息群組表（獨立於現有群組）
    .createTable('news_groups', function(table) {
      table.increments('id').primary();
      table.string('name', 100).notNullable(); // 群組名稱
      table.string('name_zh', 100); // 群組中文名稱
      table.text('description'); // 群組描述
      table.specificType('user_ids', 'integer[]').defaultTo('{}'); // 群組成員ID列表
      table.boolean('closed').defaultTo(false); // 是否關閉
      table.timestamps(true, true);
      
      // 索引
      table.index('closed');
      table.index('created_at');
    })
    // 建立最新消息表
    .createTable('news', function(table) {
      table.increments('id').primary();
      table.string('title', 255).notNullable(); // 消息標題
      table.text('content').notNullable(); // 消息內容
      table.integer('created_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 創建者
      table.boolean('is_pinned').defaultTo(false); // 是否置頂
      table.boolean('is_all_employees').defaultTo(false); // 是否發送給所有員工
      table.specificType('group_ids', 'integer[]').defaultTo('{}'); // 指定群組ID列表（當 is_all_employees 為 false 時使用）
      table.timestamps(true, true);
      
      // 索引
      table.index('created_by_id');
      table.index('is_pinned');
      table.index('is_all_employees');
      table.index('created_at');
    })
    // 建立最新消息附件表
    .createTable('news_attachments', function(table) {
      table.increments('id').primary();
      table.integer('news_id').unsigned().notNullable().references('id').inTable('news').onDelete('CASCADE'); // 所屬消息
      table.string('file_name').notNullable(); // 文件名
      table.string('file_path').notNullable(); // 文件路徑
      table.string('file_type').nullable(); // MIME type
      table.integer('file_size').nullable(); // 文件大小（bytes）
      table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 上傳者
      table.timestamps(true, true);
      
      // 索引
      table.index('news_id');
      table.index('uploaded_by_id');
    })
    // 建立最新消息群組管理員表（決定哪些人可以管理這些群組）
    .createTable('news_group_managers', function(table) {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 管理員用戶ID
      table.timestamps(true, true);
      
      // 索引
      table.index('user_id');
      table.unique('user_id'); // 每個用戶只能有一條管理員記錄
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('news_attachments')
    .dropTableIfExists('news_group_managers')
    .dropTableIfExists('news')
    .dropTableIfExists('news_groups');
};

