exports.up = async function (knex) {
  await knex('schedule_duty_assignments').del();
  await knex.raw('ALTER TABLE schedule_duty_assignments DROP CONSTRAINT IF EXISTS schedule_duty_assignments_schedule_id_unique');
  const hasColumn = await knex.schema.hasColumn('schedule_duty_assignments', 'slot_hour');
  if (!hasColumn) {
    await knex.schema.alterTable('schedule_duty_assignments', (table) => {
      table.smallint('slot_hour').notNullable();
      table.unique(['schedule_id', 'slot_hour']);
      table.index('slot_hour');
    });
  }
};

exports.down = async function (knex) {
  await knex('schedule_duty_assignments').del();
  await knex.schema.alterTable('schedule_duty_assignments', (table) => {
    table.dropUnique(['schedule_id', 'slot_hour']);
    table.dropIndex('slot_hour');
    table.dropColumn('slot_hour');
    table.unique(['schedule_id']);
  });
};
