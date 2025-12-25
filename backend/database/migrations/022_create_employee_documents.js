exports.up = function(knex) {
  return knex.schema.createTable('employee_documents', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('file_name').notNullable();
    table.string('display_name').notNullable(); // 顯示名稱（用戶輸入的）
    table.string('category', 50).nullable(); // 文件類別：Salary Advice、IR56B、IR56F、IR56G、Others
    table.string('file_path').notNullable();
    table.string('file_type').nullable(); // MIME type
    table.integer('file_size').nullable(); // bytes
    table.boolean('visible_to_recipient').defaultTo(true); // 文件是否對接收員工可見
    table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
    table.index('uploaded_by_id');
    table.index('category');
  }).then(function() {
    // 使用raw SQL添加CHECK約束限制category的值
    return knex.raw(`
      ALTER TABLE employee_documents 
      ADD CONSTRAINT employee_documents_category_check 
      CHECK (category IS NULL OR category IN ('Salary Advice', 'IR56B', 'IR56F', 'IR56G', 'Others'))
    `);
  });
};

exports.down = function(knex) {
  return knex.schema.raw('ALTER TABLE employee_documents DROP CONSTRAINT IF EXISTS employee_documents_category_check')
    .then(function() {
      return knex.schema.dropTable('employee_documents');
    });
};

