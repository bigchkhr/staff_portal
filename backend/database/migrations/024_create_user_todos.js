exports.up = function(knex) {
  return knex.schema.createTable('user_todos', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE'); // 所屬用戶
    table.string('title', 255).notNullable(); // 標題
    table.text('description').nullable(); // 描述
    table.string('status', 50).notNullable().defaultTo('pending'); // 狀態：pending, in_progress, completed
    table.date('due_date').nullable(); // 到期日期
    table.integer('priority', 1).defaultTo(1); // 優先級：1=低, 2=中, 3=高
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
    table.index('status');
    table.index('due_date');
  }).then(function() {
    // 使用raw SQL添加CHECK約束限制status和priority的值
    return knex.raw(`
      ALTER TABLE user_todos 
      ADD CONSTRAINT user_todos_status_check 
      CHECK (status IN ('pending', 'in_progress', 'completed'))
    `).then(function() {
      return knex.raw(`
        ALTER TABLE user_todos 
        ADD CONSTRAINT user_todos_priority_check 
        CHECK (priority IN (1, 2, 3))
      `);
    });
  });
};

exports.down = function(knex) {
  return knex.schema.raw('ALTER TABLE user_todos DROP CONSTRAINT IF EXISTS user_todos_priority_check')
    .then(function() {
      return knex.schema.raw('ALTER TABLE user_todos DROP CONSTRAINT IF EXISTS user_todos_status_check');
    })
    .then(function() {
      return knex.schema.dropTable('user_todos');
    });
};

