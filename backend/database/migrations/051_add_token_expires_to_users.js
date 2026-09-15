exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // null = 使用系統預設 JWT_EXPIRES_IN（目前 1h）
    table.integer('token_expires_value').nullable();
    // m | h | d | mo | never；null = 使用系統預設
    table.string('token_expires_unit', 10).nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('token_expires_value');
    table.dropColumn('token_expires_unit');
  });
};
