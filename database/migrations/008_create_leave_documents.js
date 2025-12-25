exports.up = function(knex) {
  return knex.schema.createTable('leave_documents', function(table) {
    table.increments('id').primary();
    table.integer('leave_application_id').unsigned().notNullable().references('id').inTable('leave_applications').onDelete('CASCADE');
    table.string('file_name').notNullable();
    table.string('file_path').notNullable();
    table.string('file_type').nullable();
    table.integer('file_size').nullable();
    table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('leave_documents');
};

