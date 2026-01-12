exports.up = function(knex) {
  return knex.schema.createTable('chat_rooms', function(table) {
    table.increments('id').primary();
    table.string('name', 255).notNullable(); // 聊天室名稱
    table.text('description').nullable(); // 聊天室描述
    table.integer('created_by_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    
    // 索引
    table.index('created_by_id');
    table.index('created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('chat_rooms');
};

