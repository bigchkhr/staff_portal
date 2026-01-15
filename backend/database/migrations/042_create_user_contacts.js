exports.up = function(knex) {
  return knex.schema.createTable('user_contacts', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('company_name', 200);
    table.string('department', 200);
    table.string('position', 100);
    table.specificType('emails', 'text[]').defaultTo('{}');
    table.specificType('phones', 'text[]').defaultTo('{}');
    table.timestamps(true, true);
    
    // 索引
    table.index('user_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_contacts');
};
