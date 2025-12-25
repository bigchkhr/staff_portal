exports.up = function(knex) {
  return knex.schema.createTable('leave_applications', function(table) {
    table.increments('id').primary();
    table.string('transaction_id').notNullable().unique();
    table.integer('applicant_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('applied_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('leave_type_id').unsigned().notNullable().references('id').inTable('leave_types').onDelete('CASCADE');
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.decimal('days', 10, 2).notNullable();
    table.text('reason').nullable();
    table.string('status').notNullable().defaultTo('pending');
    table.integer('checker_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_1_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_2_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('approver_3_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('checker_comment').nullable();
    table.text('approver_1_comment').nullable();
    table.text('approver_2_comment').nullable();
    table.text('approver_3_comment').nullable();
    table.timestamp('checked_at').nullable();
    table.timestamp('approved_1_at').nullable();
    table.timestamp('approved_2_at').nullable();
    table.timestamp('approved_3_at').nullable();
    table.timestamp('rejected_at').nullable();
    table.integer('rejected_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.text('rejection_reason').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('leave_applications');
};

