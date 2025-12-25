exports.up = function(knex) {
  return knex.schema.table('employee_documents', function(table) {
    table.boolean('is_encrypted').defaultTo(false); // 是否加密
    table.string('encryption_password', 255).nullable(); // 加密密碼（用戶自定義）
  });
};

exports.down = function(knex) {
  return knex.schema.table('employee_documents', function(table) {
    table.dropColumn('is_encrypted');
    table.dropColumn('encryption_password');
  });
};

