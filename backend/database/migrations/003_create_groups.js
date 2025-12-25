exports.up = function(knex) {
  return knex.schema
    // 建立授權群組表 (Delegation Groups)
    .createTable('delegation_groups', function(table) {
      table.increments('id').primary();
      table.string('name', 100).unique();
      table.string('name_zh', 100);
      table.text('description');
      table.specificType('user_ids', 'integer[]').defaultTo('{}');
      table.timestamps(true, true);
    })
    // 建立部門群組表 (Department Groups)
    .createTable('department_groups', function(table) {
      table.increments('id').primary();
      table.string('name', 100).unique();
      table.string('name_zh', 100);
      table.text('description');
      table.specificType('user_ids', 'integer[]').defaultTo('{}');
      table.integer('checker_id').unsigned().references('id').inTable('delegation_groups').onDelete('SET NULL');
      table.integer('approver_1_id').unsigned().references('id').inTable('delegation_groups').onDelete('SET NULL');
      table.integer('approver_2_id').unsigned().references('id').inTable('delegation_groups').onDelete('SET NULL');
      table.integer('approver_3_id').unsigned().references('id').inTable('delegation_groups').onDelete('SET NULL');
      table.timestamps(true, true);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('department_groups')
    .dropTableIfExists('delegation_groups');
};
