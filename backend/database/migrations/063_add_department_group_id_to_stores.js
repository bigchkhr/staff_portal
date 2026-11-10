exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('stores', 'department_group_id');
  if (hasColumn) return;

  await knex.schema.table('stores', (table) => {
    table.integer('department_group_id').unsigned().nullable()
      .references('id').inTable('department_groups').onDelete('SET NULL');
    table.index('department_group_id');
  });
};

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('stores', 'department_group_id');
  if (!hasColumn) return;

  await knex.schema.table('stores', (table) => {
    table.dropIndex('department_group_id');
    table.dropColumn('department_group_id');
  });
};
