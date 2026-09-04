exports.up = async function(knex) {
  await knex.schema.table('department_groups', function(table) {
    table.boolean('require_checker_schedule_approval').defaultTo(false).notNullable();
  });

  await knex.schema.createTable('schedule_change_submissions', function(table) {
    table.increments('id').primary();
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.integer('submitted_by_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.string('status', 20).notNullable().defaultTo('draft');
    table.timestamp('submitted_at').nullable();
    table.integer('reviewed_by_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at').nullable();
    table.text('return_reason').nullable();
    table.timestamps(true, true);

    table.index('department_group_id');
    table.index('submitted_by_id');
    table.index('status');
    table.index(['department_group_id', 'status']);
  });

  await knex.schema.createTable('schedule_change_items', function(table) {
    table.increments('id').primary();
    table.integer('submission_id').unsigned().notNullable()
      .references('id').inTable('schedule_change_submissions').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.date('schedule_date').notNullable();
    table.string('action', 20).notNullable().defaultTo('upsert');
    table.integer('department_group_id').unsigned().nullable()
      .references('id').inTable('department_groups').onDelete('SET NULL');
    table.time('start_time').nullable();
    table.string('end_time', 10).nullable();
    table.integer('leave_type_id').unsigned().nullable()
      .references('id').inTable('leave_types').onDelete('SET NULL');
    table.string('leave_session', 2).nullable();
    table.integer('store_id').unsigned().nullable()
      .references('id').inTable('stores').onDelete('SET NULL');
    table.text('remarks').nullable();
    table.jsonb('before_payload').nullable();
    table.timestamps(true, true);

    table.index('submission_id');
    table.index(['user_id', 'schedule_date']);
    table.unique(['submission_id', 'user_id', 'schedule_date']);
  });

  await knex.schema.createTable('schedule_change_logs', function(table) {
    table.increments('id').primary();
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.integer('submission_id').unsigned().nullable()
      .references('id').inTable('schedule_change_submissions').onDelete('SET NULL');
    table.integer('user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.date('schedule_date').nullable();
    table.integer('actor_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.string('action', 30).notNullable();
    table.jsonb('before_payload').nullable();
    table.jsonb('after_payload').nullable();
    table.text('note').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index('department_group_id');
    table.index(['user_id', 'schedule_date']);
    table.index('actor_id');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('schedule_change_logs');
  await knex.schema.dropTableIfExists('schedule_change_items');
  await knex.schema.dropTableIfExists('schedule_change_submissions');
  await knex.schema.table('department_groups', function(table) {
    table.dropColumn('require_checker_schedule_approval');
  });
};
