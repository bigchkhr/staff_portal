exports.up = async function (knex) {
  await knex.schema.createTable('shift_duty_roles', function (table) {
    table.increments('id').primary();
    table.string('code', 20).nullable();
    table.string('name', 100).notNullable();
    table.string('name_zh', 100).notNullable();
    table.text('description').nullable();
    table.integer('display_order').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique('code');
    table.index('is_active');
    table.index('display_order');
  });

  await knex.schema.createTable('schedule_duty_assignments', function (table) {
    table.increments('id').primary();
    table.integer('schedule_id').unsigned().notNullable()
      .references('id').inTable('schedules').onDelete('CASCADE');
    table.integer('duty_role_id').unsigned().notNullable()
      .references('id').inTable('shift_duty_roles').onDelete('RESTRICT');
    table.integer('assigned_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.unique('schedule_id');
    table.index('duty_role_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('schedule_duty_assignments');
  await knex.schema.dropTableIfExists('shift_duty_roles');
};
