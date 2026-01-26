exports.up = function(knex) {
  return knex.schema.createTable('outdoor_work_documents', function(table) {
    table.increments('id').primary();
    table.integer('outdoor_work_application_id').unsigned().notNullable().references('id').inTable('outdoor_work_applications').onDelete('CASCADE');
    table.string('file_name').notNullable();
    table.string('file_path').notNullable();
    table.string('file_type').nullable();
    table.integer('file_size').nullable();
    table.integer('uploaded_by_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('outdoor_work_documents');
};

