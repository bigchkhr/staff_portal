exports.up = function(knex) {
  return knex.schema.createTable('extra_working_hours_applications', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.date('application_date'); // 申請日期，paper-flow 可留空
    table.date('start_date').notNullable();
    table.time('start_time').notNullable();
    table.date('end_date').notNullable();
    table.time('end_time').notNullable();
    table.decimal('total_hours', 8, 2).notNullable(); // 總時數
    table.text('reason'); // 額外工作原因
    table.text('description'); // 內容描述
    table.enum('status', ['pending', 'approved', 'rejected', 'cancelled']).defaultTo('pending');
    table.enum('current_approval_stage', ['checker', 'approver_1', 'approver_2', 'approver_3', 'completed'])
      .notNullable()
      .defaultTo('checker');
    table.enum('flow_type', ['e-flow', 'paper-flow']).defaultTo('e-flow');
    table.boolean('is_paper_flow').defaultTo(false); // 標記是否為 paper-flow 流程
    
    // 批核流程相關欄位
    table.integer('checker_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('checker_at');
    table.text('checker_remarks');
    
    table.integer('approver_1_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approver_1_at');
    table.text('approver_1_remarks');
    
    table.integer('approver_2_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approver_2_at');
    table.text('approver_2_remarks');
    
    table.integer('approver_3_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('approver_3_at');
    table.text('approver_3_remarks');
    
    table.integer('rejected_by_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('rejected_at');
    table.text('rejection_reason');
    
    table.timestamps(true, true);
    
    table.index('user_id');
    table.index('status');
    table.index('start_date');
    table.index('end_date');
    table.index('current_approval_stage');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('extra_working_hours_applications');
};

