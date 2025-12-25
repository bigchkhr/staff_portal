exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('employee_number').notNullable().unique();
    table.string('surname').notNullable();
    table.string('given_name').notNullable();
    table.string('alias').nullable();
    table.string('name_zh').notNullable();
    table.string('email').notNullable().unique();
    table.string('password_hash').notNullable();
    table.integer('department_id').unsigned().references('id').inTable('departments').onDelete('SET NULL');
    table.integer('position_id').unsigned().references('id').inTable('positions').onDelete('SET NULL');
    table.integer('group_id').unsigned().references('id').inTable('groups').onDelete('SET NULL');
    table.boolean('is_system_admin').defaultTo(false);
    table.boolean('is_dept_head').defaultTo(false);
    table.boolean('is_active').defaultTo(true);
    table.integer('checker_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_1_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_2_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_3_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};

