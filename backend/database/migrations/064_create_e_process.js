/**
 * E-Process tables.
 * Workflows and procedures belong to e_process_work_groups.
 * Department groups and delegation groups are the audience and assignee pools.
 */
exports.up = async function up(knex) {
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS e_process_workflow_number_seq START 1');
  await knex.raw('CREATE SEQUENCE IF NOT EXISTS e_process_run_number_seq START 1');

  await knex.schema.createTable('department_group_assignable_groups', (table) => {
    table.increments('id').primary();
    table.integer('source_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.integer('target_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['source_group_id', 'target_group_id']);
    table.index(['target_group_id']);
  });

  await knex.schema.createTable('e_process_work_groups', (table) => {
    table.uuid('id').primary();
    table.string('name', 180).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.boolean('closed').notNullable().defaultTo(false);
    table.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('RESTRICT');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('e_process_work_group_members', (table) => {
    table.increments('id').primary();
    table.uuid('work_group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['work_group_id', 'user_id']);
    table.index(['user_id']);
  });

  await knex.schema.createTable('e_process_work_group_assignable_groups', (table) => {
    table.increments('id').primary();
    table.uuid('work_group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.integer('department_group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['work_group_id', 'department_group_id']);
  });

  await knex.schema.createTable('e_process_work_group_delegation_groups', (table) => {
    table.increments('id').primary();
    table.uuid('work_group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.integer('delegation_group_id').unsigned().notNullable()
      .references('id').inTable('delegation_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['work_group_id', 'delegation_group_id']);
    table.index(['delegation_group_id']);
  });

  await knex.schema.createTable('e_process_work_group_assignable_delegations', (table) => {
    table.increments('id').primary();
    table.uuid('work_group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.integer('delegation_group_id').unsigned().notNullable()
      .references('id').inTable('delegation_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['work_group_id', 'delegation_group_id']);
  });

  await knex.schema.createTable('workflows', (table) => {
    table.uuid('id').primary();
    table.uuid('group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.string('workflow_number', 32).notNullable().unique();
    table.string('name', 180).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.enu('status', ['draft', 'published'], { useNative: true, enumName: 'workflow_status' })
      .notNullable().defaultTo('draft');
    table.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.enu('audience', ['everyone', 'user_groups'], { useNative: true, enumName: 'workflow_audience' })
      .notNullable().defaultTo('user_groups');
    table.timestamps(true, true);
    table.index(['group_id', 'status']);
    table.index(['created_by']);
  });

  await knex.schema.createTable('workflow_audience_groups', (table) => {
    table.increments('id').primary();
    table.uuid('workflow_id').notNullable()
      .references('id').inTable('workflows').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['workflow_id', 'group_id']);
    table.index(['group_id']);
  });

  await knex.schema.createTable('workflow_audience_delegations', (table) => {
    table.increments('id').primary();
    table.uuid('workflow_id').notNullable()
      .references('id').inTable('workflows').onDelete('CASCADE');
    table.integer('delegation_group_id').unsigned().notNullable()
      .references('id').inTable('delegation_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['workflow_id', 'delegation_group_id']);
    table.index(['delegation_group_id']);
  });

  await knex.schema.createTable('workflow_participants', (table) => {
    table.increments('id').primary();
    table.uuid('workflow_id').notNullable()
      .references('id').inTable('workflows').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['workflow_id', 'user_id']);
    table.index(['user_id']);
  });

  await knex.schema.createTable('workflow_steps', (table) => {
    table.uuid('id').primary();
    table.uuid('workflow_id').notNullable().references('id').inTable('workflows').onDelete('CASCADE');
    table.integer('position').notNullable();
    table.string('title', 180).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.enu('type', ['task', 'form', 'approval', 'acknowledgement', 'checklist', 'communication'], {
      useNative: true,
      enumName: 'workflow_step_type',
    }).notNullable().defaultTo('task');
    table.boolean('required').notNullable().defaultTo(true);
    table.boolean('allow_skip').notNullable().defaultTo(false);
    table.boolean('allow_review').notNullable().defaultTo(true);
    table.boolean('allow_delete').notNullable().defaultTo(false);
    table.jsonb('form_schema').notNullable().defaultTo('[]');
    table.jsonb('condition').nullable();
    table.enu('assignee_mode', ['unassigned', 'run_starter', 'user', 'group', 'work_group'], {
      useNative: true,
      enumName: 'workflow_step_assignee_mode',
    }).notNullable().defaultTo('unassigned');
    table.integer('assignee_user_id').unsigned().nullable()
      .references('id').inTable('users').onDelete('SET NULL');
    table.integer('assignee_group_id').unsigned().nullable()
      .references('id').inTable('department_groups').onDelete('SET NULL');
    table.integer('assignee_delegation_group_id').nullable()
      .references('id').inTable('delegation_groups').onDelete('SET NULL');
    table.timestamps(true, true);
    table.unique(['workflow_id', 'position']);
  });

  await knex.schema.createTable('workflow_runs', (table) => {
    table.uuid('id').primary();
    table.uuid('workflow_id').notNullable().references('id').inTable('workflows').onDelete('CASCADE');
    table.string('run_number', 32).notNullable().unique();
    table.string('name', 220).notNullable();
    table.enu('status', ['active', 'completed', 'cancelled'], {
      useNative: true,
      enumName: 'workflow_run_status',
    }).notNullable().defaultTo('active');
    table.integer('started_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('completed_at').nullable();
    table.text('cancel_reason').nullable();
    table.timestamps(true, true);
    table.index(['started_by', 'status']);
  });

  await knex.schema.createTable('workflow_run_participants', (table) => {
    table.increments('id').primary();
    table.uuid('run_id').notNullable().references('id').inTable('workflow_runs').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('added_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.unique(['run_id', 'user_id']);
    table.index(['user_id']);
  });

  await knex.schema.createTable('task_runs', (table) => {
    table.uuid('id').primary();
    table.uuid('run_id').notNullable().references('id').inTable('workflow_runs').onDelete('CASCADE');
    table.uuid('step_id').nullable().references('id').inTable('workflow_steps').onDelete('SET NULL');
    table.integer('position').notNullable();
    table.string('title', 180).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.enu('type', ['task', 'form', 'approval', 'acknowledgement', 'checklist', 'communication', 'attachment'], {
      useNative: true,
      enumName: 'task_run_step_type',
    }).notNullable();
    table.boolean('required').notNullable().defaultTo(true);
    table.boolean('allow_skip').notNullable().defaultTo(false);
    table.boolean('allow_review').notNullable().defaultTo(true);
    table.boolean('allow_delete').notNullable().defaultTo(false);
    table.jsonb('form_schema').notNullable().defaultTo('[]');
    table.jsonb('condition').nullable();
    table.enu('status', ['blocked', 'pending', 'in_progress', 'completed', 'rejected', 'skipped'], {
      useNative: true,
      enumName: 'task_run_status',
    }).notNullable().defaultTo('blocked');
    table.integer('assigned_to').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('assigned_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.integer('assignee_group_id').unsigned().nullable()
      .references('id').inTable('department_groups').onDelete('SET NULL');
    table.integer('assignee_delegation_group_id').nullable()
      .references('id').inTable('delegation_groups').onDelete('SET NULL');
    table.boolean('assignee_is_work_group').notNullable().defaultTo(false);
    table.enu('assignment_status', ['pending', 'accepted', 'rejected'], {
      useNative: true,
      enumName: 'e_process_assignment_status',
    }).nullable();
    table.timestamp('assignee_responded_at').nullable();
    table.jsonb('form_data').notNullable().defaultTo('{}');
    table.text('note').notNullable().defaultTo('');
    table.date('end_date').nullable();
    table.timestamp('completed_at').nullable();
    table.integer('completed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.unique(['run_id', 'step_id']);
    table.index(['assigned_to', 'assignment_status']);
    table.index(['end_date', 'status']);
  });

  await knex.schema.createTable('e_process_task_attachments', (table) => {
    table.uuid('id').primary();
    table.uuid('task_run_id').notNullable().references('id').inTable('task_runs').onDelete('CASCADE');
    table.string('file_name', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.integer('file_size').unsigned().notNullable().defaultTo(0);
    table.string('mime_type', 120).notNullable().defaultTo('application/octet-stream');
    table.string('form_field_key', 120).notNullable();
    table.integer('uploaded_by_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.index(['task_run_id']);
  });

  await knex.schema.createTable('e_process_stage_returns', (table) => {
    table.uuid('id').primary();
    table.uuid('run_id').notNullable().references('id').inTable('workflow_runs').onDelete('CASCADE');
    table.uuid('from_task_id').notNullable().references('id').inTable('task_runs').onDelete('CASCADE');
    table.uuid('to_task_id').notNullable().references('id').inTable('task_runs').onDelete('CASCADE');
    table.text('reason').notNullable();
    table.integer('returned_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
    table.index(['run_id']);
  });

  await knex.schema.createTable('e_process_procedures', (table) => {
    table.uuid('id').primary();
    table.uuid('group_id').notNullable()
      .references('id').inTable('e_process_work_groups').onDelete('CASCADE');
    table.string('name', 180).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.enu('status', ['draft', 'published'], { useNative: true, enumName: 'e_process_procedure_status' })
      .notNullable().defaultTo('draft');
    table.enu('audience', ['everyone', 'user_groups'], { useNative: true, enumName: 'e_process_procedure_audience' })
      .notNullable().defaultTo('user_groups');
    table.integer('created_by').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.index(['group_id', 'status']);
  });

  await knex.schema.createTable('e_process_procedure_audience_groups', (table) => {
    table.increments('id').primary();
    table.uuid('procedure_id').notNullable()
      .references('id').inTable('e_process_procedures').onDelete('CASCADE');
    table.integer('group_id').unsigned().notNullable()
      .references('id').inTable('department_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['procedure_id', 'group_id']);
    table.index(['group_id']);
  });

  await knex.schema.createTable('e_process_procedure_audience_delegations', (table) => {
    table.increments('id').primary();
    table.uuid('procedure_id').notNullable()
      .references('id').inTable('e_process_procedures').onDelete('CASCADE');
    table.integer('delegation_group_id').unsigned().notNullable()
      .references('id').inTable('delegation_groups').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['procedure_id', 'delegation_group_id']);
    table.index(['delegation_group_id']);
  });

  await knex.schema.createTable('e_process_procedure_steps', (table) => {
    table.uuid('id').primary();
    table.uuid('procedure_id').notNullable()
      .references('id').inTable('e_process_procedures').onDelete('CASCADE');
    table.uuid('parent_id').nullable();
    table.integer('position').notNullable().defaultTo(0);
    table.string('title', 180).notNullable();
    table.text('body').notNullable().defaultTo('');
    table.timestamps(true, true);
    table.index(['procedure_id', 'parent_id', 'position']);
  });

  await knex.schema.alterTable('e_process_procedure_steps', (table) => {
    table.foreign('parent_id').references('id').inTable('e_process_procedure_steps').onDelete('CASCADE');
  });

  await knex.schema.createTable('e_process_procedure_images', (table) => {
    table.uuid('id').primary();
    table.uuid('step_id').notNullable()
      .references('id').inTable('e_process_procedure_steps').onDelete('CASCADE');
    table.string('file_name', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.integer('file_size').unsigned().notNullable().defaultTo(0);
    table.string('mime_type', 120).notNullable().defaultTo('application/octet-stream');
    table.integer('position').notNullable().defaultTo(0);
    table.integer('uploaded_by_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.index(['step_id', 'position']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('e_process_procedure_images');
  await knex.schema.dropTableIfExists('e_process_procedure_steps');
  await knex.schema.dropTableIfExists('e_process_procedure_audience_delegations');
  await knex.schema.dropTableIfExists('e_process_procedure_audience_groups');
  await knex.schema.dropTableIfExists('e_process_procedures');
  await knex.schema.dropTableIfExists('e_process_stage_returns');
  await knex.schema.dropTableIfExists('e_process_task_attachments');
  await knex.schema.dropTableIfExists('task_runs');
  await knex.schema.dropTableIfExists('workflow_run_participants');
  await knex.schema.dropTableIfExists('workflow_runs');
  await knex.schema.dropTableIfExists('workflow_steps');
  await knex.schema.dropTableIfExists('workflow_participants');
  await knex.schema.dropTableIfExists('workflow_audience_delegations');
  await knex.schema.dropTableIfExists('workflow_audience_groups');
  await knex.schema.dropTableIfExists('workflows');
  await knex.schema.dropTableIfExists('e_process_work_group_assignable_delegations');
  await knex.schema.dropTableIfExists('e_process_work_group_delegation_groups');
  await knex.schema.dropTableIfExists('e_process_work_group_assignable_groups');
  await knex.schema.dropTableIfExists('e_process_work_group_members');
  await knex.schema.dropTableIfExists('e_process_work_groups');
  await knex.schema.dropTableIfExists('department_group_assignable_groups');

  await knex.raw('DROP TYPE IF EXISTS e_process_assignment_status');
  await knex.raw('DROP TYPE IF EXISTS task_run_status');
  await knex.raw('DROP TYPE IF EXISTS task_run_step_type');
  await knex.raw('DROP TYPE IF EXISTS workflow_run_status');
  await knex.raw('DROP TYPE IF EXISTS workflow_step_assignee_mode');
  await knex.raw('DROP TYPE IF EXISTS workflow_step_type');
  await knex.raw('DROP TYPE IF EXISTS workflow_audience');
  await knex.raw('DROP TYPE IF EXISTS workflow_status');
  await knex.raw('DROP TYPE IF EXISTS e_process_procedure_audience');
  await knex.raw('DROP TYPE IF EXISTS e_process_procedure_status');
  await knex.raw('DROP SEQUENCE IF EXISTS e_process_run_number_seq');
  await knex.raw('DROP SEQUENCE IF EXISTS e_process_workflow_number_seq');
};
