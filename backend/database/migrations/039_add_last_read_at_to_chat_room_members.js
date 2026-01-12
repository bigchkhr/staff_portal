exports.up = function(knex) {
  return knex.schema.table('chat_room_members', function(table) {
    table.timestamp('last_read_at').nullable(); // 用戶最後讀取此聊天室的時間
    table.index('last_read_at');
  });
};

exports.down = function(knex) {
  return knex.schema.table('chat_room_members', function(table) {
    table.dropColumn('last_read_at');
  });
};

