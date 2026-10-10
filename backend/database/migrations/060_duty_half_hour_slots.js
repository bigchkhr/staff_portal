exports.up = async function (knex) {
  const hasMinute = await knex.schema.hasColumn('schedule_duty_assignments', 'slot_start_minute');
  if (!hasMinute) {
    await knex.schema.alterTable('schedule_duty_assignments', (table) => {
      table.smallint('slot_start_minute').nullable();
    });
  }

  const existing = await knex('schedule_duty_assignments')
    .whereNotNull('slot_hour')
    .select('id', 'schedule_id', 'slot_hour', 'duty_role_id', 'assigned_by_id');

  for (const row of existing) {
    const start = Number(row.slot_hour) * 60;
    await knex('schedule_duty_assignments').where('id', row.id).update({ slot_start_minute: start });
  }

  await knex.raw('ALTER TABLE schedule_duty_assignments DROP CONSTRAINT IF EXISTS schedule_duty_assignments_schedule_id_slot_hour_unique');
  await knex.raw('ALTER TABLE schedule_duty_assignments ALTER COLUMN slot_hour DROP NOT NULL');
  await knex.raw('DROP INDEX IF EXISTS schedule_duty_assignments_slot_hour_index');

  const halves = existing.map((row) => ({
    schedule_id: row.schedule_id,
    slot_start_minute: Number(row.slot_hour) * 60 + 30,
    duty_role_id: row.duty_role_id,
    assigned_by_id: row.assigned_by_id
  }));
  if (halves.length > 0) {
    await knex('schedule_duty_assignments').insert(halves);
  }

  await knex.schema.alterTable('schedule_duty_assignments', (table) => {
    table.dropColumn('slot_hour');
  });
  await knex.raw('ALTER TABLE schedule_duty_assignments ALTER COLUMN slot_start_minute SET NOT NULL');
  await knex.schema.alterTable('schedule_duty_assignments', (table) => {
    table.unique(['schedule_id', 'slot_start_minute']);
    table.index('slot_start_minute');
  });
};

exports.down = async function (knex) {
  await knex('schedule_duty_assignments').del();
  await knex.schema.alterTable('schedule_duty_assignments', (table) => {
    table.dropUnique(['schedule_id', 'slot_start_minute']);
    table.dropIndex('slot_start_minute');
    table.dropColumn('slot_start_minute');
    table.smallint('slot_hour').notNullable();
    table.unique(['schedule_id', 'slot_hour']);
  });
};
