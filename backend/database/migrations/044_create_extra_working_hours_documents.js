exports.up = function(knex) {
  return knex.schema.createTable('extra_working_hours_documents', function(table) {
    table.increments('id').primary();
    table.integer('extra_working_hours_application_id').unsigned().notNullable().references('id').inTable('extra_working_hours_applications').onDelete('CASCADE');
    table.string('file_name').notNullable();
    table.string('file_path').notNullable();
    table.string('file_type').nullable();
    table.integer('file_size').nullable();
    table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('extra_working_hours_documents');
};

