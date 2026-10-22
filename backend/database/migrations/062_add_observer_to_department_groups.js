exports.up = async function up(knex) {
  const hasObserver = await knex.schema.hasColumn('department_groups', 'observer_id');
  if (!hasObserver) {
    await knex.schema.table('department_groups', (table) => {
      table.integer('observer_id').unsigned()
        .references('id').inTable('delegation_groups').onDelete('SET NULL');
    });
  }
};

exports.down = async function down(knex) {
  const hasObserver = await knex.schema.hasColumn('department_groups', 'observer_id');
  if (hasObserver) {
    await knex.schema.table('department_groups', (table) => {
      table.dropColumn('observer_id');
    });
  }
};
