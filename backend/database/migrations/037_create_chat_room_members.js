exports.up = function(knex) {
  return knex.schema.createTable('chat_room_members', function(table) {
    table.increments('id').primary();
    table.integer('chat_room_id').unsigned().notNullable()
      .references('id').inTable('chat_rooms').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.boolean('is_admin').defaultTo(false); // 是否為管理員（HR Group 成員）
    table.timestamps(true, true);
    
    // 唯一約束：同一用戶不能重複加入同一個聊天室
    table.unique(['chat_room_id', 'user_id']);
    
    // 索引
    table.index('chat_room_id');
    table.index('user_id');
    table.index('is_admin');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('chat_room_members');
};

