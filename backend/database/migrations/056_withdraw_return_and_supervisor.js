const APPLICATION_TABLES = [
  'leave_applications',
  'extra_working_hours_applications',
  'outdoor_work_applications'
];

const STATUS_VALUES = ['pending', 'approved', 'rejected', 'cancelled', 'withdrawn'];
const STAGE_VALUES = ['applicant', 'checker', 'approver_1', 'approver_2', 'approver_3', 'completed'];

async function expandConstrainedValues(knex, table, column, values) {
  const { rows } = await knex.raw(
    `SELECT data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = ?
       AND column_name = ?`,
    [table, column]
  );

  if (!rows.length) {
    return;
  }

  if (rows[0].data_type === 'USER-DEFINED') {
    const typeName = rows[0].udt_name;
    for (const value of values) {
      await knex.raw(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`);
    }
    return;
  }

  const constraints = await knex.raw(
    `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = current_schema()
       AND rel.relname = ?
       AND con.contype = 'c'`,
    [table]
  );

  for (const constraint of constraints.rows) {
    const definition = constraint.def || '';
    if (definition.includes(`"${column}"`) || definition.includes(`(${column}`)) {
      await knex.raw(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${constraint.conname}"`);
    }
  }

  const list = values.map((value) => `'${value}'`).join(', ');
  await knex.raw(
    `ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_check" CHECK ("${column}" IN (${list}))`
  );
}

exports.up = async function up(knex) {
  const hasSupervisor = await knex.schema.hasColumn('department_groups', 'supervisor_id');
  if (!hasSupervisor) {
    await knex.schema.table('department_groups', (table) => {
      table.integer('supervisor_id').unsigned()
        .references('id').inTable('delegation_groups').onDelete('SET NULL');
    });
  }

  for (const table of APPLICATION_TABLES) {
    const exists = await knex.schema.hasTable(table);
    if (!exists) continue;
    await expandConstrainedValues(knex, table, 'status', STATUS_VALUES);
    await expandConstrainedValues(knex, table, 'current_approval_stage', STAGE_VALUES);
  }

  const hasActions = await knex.schema.hasTable('application_actions');
  if (!hasActions) {
    await knex.schema.createTable('application_actions', (table) => {
      table.increments('id').primary();
      table.string('application_type', 40).notNullable();
      table.integer('application_id').unsigned().notNullable();
      table.string('action', 20).notNullable();
      table.integer('actor_id').unsigned()
        .references('id').inTable('users').onDelete('SET NULL');
      table.string('from_stage', 30);
      table.string('to_stage', 30);
      table.text('reason');
      table.timestamps(true, true);
      table.index(['application_type', 'application_id']);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('application_actions');
  await knex.schema.table('department_groups', (table) => {
    table.dropColumn('supervisor_id');
  });
};
