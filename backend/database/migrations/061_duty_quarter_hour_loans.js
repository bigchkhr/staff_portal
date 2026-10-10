exports.up = async function (knex) {
  const hasLoan = await knex.schema.hasColumn('schedule_duty_assignments', 'loan_store_id');
  if (!hasLoan) {
    await knex.schema.alterTable('schedule_duty_assignments', (table) => {
      table.integer('loan_store_id').unsigned().nullable()
        .references('id').inTable('stores').onDelete('SET NULL');
    });
  }

  await knex.raw('ALTER TABLE schedule_duty_assignments ALTER COLUMN duty_role_id DROP NOT NULL');

  const existing = await knex('schedule_duty_assignments')
    .whereRaw('mod(slot_start_minute, 30) = 0')
    .select('schedule_id', 'slot_start_minute', 'duty_role_id', 'assigned_by_id', 'loan_store_id');
  const present = new Set(
    (await knex('schedule_duty_assignments').select('schedule_id', 'slot_start_minute'))
      .map((row) => `${row.schedule_id}:${row.slot_start_minute}`)
  );
  const quarters = [];
  existing.forEach((row) => {
    const nextMinute = Number(row.slot_start_minute) + 15;
    const key = `${row.schedule_id}:${nextMinute}`;
    if (present.has(key)) return;
    present.add(key);
    quarters.push({
      schedule_id: row.schedule_id,
      slot_start_minute: nextMinute,
      duty_role_id: row.duty_role_id,
      assigned_by_id: row.assigned_by_id,
      loan_store_id: row.loan_store_id || null
    });
  });
  if (quarters.length > 0) {
    await knex('schedule_duty_assignments').insert(quarters);
  }
};

exports.down = async function (knex) {
  await knex('schedule_duty_assignments').whereRaw('mod(slot_start_minute, 30) = 15').del();
  await knex.raw('ALTER TABLE schedule_duty_assignments ALTER COLUMN duty_role_id SET NOT NULL');
  const hasLoan = await knex.schema.hasColumn('schedule_duty_assignments', 'loan_store_id');
  if (hasLoan) {
    await knex.schema.alterTable('schedule_duty_assignments', (table) => {
      table.dropColumn('loan_store_id');
    });
  }
};
