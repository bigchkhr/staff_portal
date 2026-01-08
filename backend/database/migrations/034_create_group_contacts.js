exports.up = function(knex) {
  return knex.schema.createTable('group_contacts', function(table) {
    table.increments('id').primary();
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.string('name', 100).notNullable();
    table.string('name_zh', 100);
    table.string('phone', 50);
    table.string('email', 255);
    table.string('address', 500);
    table.string('position', 100);
    table.text('notes');
    table.timestamps(true, true);
    
    // 索引
    table.index('department_group_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('group_contacts');
};

