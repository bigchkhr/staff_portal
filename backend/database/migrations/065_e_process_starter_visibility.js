exports.up = async function up(knex) {
  const hasStep = await knex.schema.hasColumn('workflow_steps', 'visible_to_starter');
  if (!hasStep) {
    await knex.schema.alterTable('workflow_steps', (table) => {
      table.boolean('visible_to_starter').notNullable().defaultTo(true);
    });
  }
  const hasTask = await knex.schema.hasColumn('task_runs', 'visible_to_starter');
  if (!hasTask) {
    await knex.schema.alterTable('task_runs', (table) => {
      table.boolean('visible_to_starter').notNullable().defaultTo(true);
    });
  }
};

exports.down = async function down(knex) {
  const hasTask = await knex.schema.hasColumn('task_runs', 'visible_to_starter');
  if (hasTask) {
    await knex.schema.alterTable('task_runs', (table) => {
      table.dropColumn('visible_to_starter');
    });
  }
  const hasStep = await knex.schema.hasColumn('workflow_steps', 'visible_to_starter');
  if (hasStep) {
    await knex.schema.alterTable('workflow_steps', (table) => {
      table.dropColumn('visible_to_starter');
    });
  }
};
