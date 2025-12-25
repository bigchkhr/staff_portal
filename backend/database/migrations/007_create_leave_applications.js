exports.up = function(knex) {
  return knex.schema.createTable('leave_applications', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.integer('leave_type_id').unsigned().notNullable()
      .references('id').inTable('leave_types').onDelete('RESTRICT');
    table.date('application_date'); // 申請日期，paper-flow 可留空
    table.date('start_date').notNullable();
    table.string('start_session'); // 'AM' or 'PM' for half-day, null for full day
    table.date('end_date').notNullable();
    table.string('end_session'); // 'AM' or 'PM' for half-day, null for full day
    table.integer('year').notNullable(); // 假期所屬年份，用於控制扣除所屬年份的quota
    table.decimal('total_days', 5, 2).notNullable();
    table.text('reason');
    // table.jsonb('document_urls').defaultTo('[]'); // 存儲上傳文件的路由陣列，格式：["/api/leaves/documents/1/download", "/api/leaves/documents/2/download"]
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
    
    // 取消假期相關欄位
    table.boolean('is_cancellation_request').defaultTo(false);
    table.integer('original_application_id').unsigned()
      .references('id').inTable('leave_applications').onDelete('SET NULL');
    table.integer('cancelled_by_id').unsigned()
      .references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('cancelled_at');
    table.text('cancellation_reason');

    // 銷假 / Reverse 相關欄位
    table.boolean('is_reversal_transaction').defaultTo(false);
    table.integer('reversal_of_application_id').unsigned()
      .references('id').inTable('leave_applications').onDelete('SET NULL');
    table.boolean('is_reversed').defaultTo(false);
    table.timestamp('reversal_completed_at');
    table.text('transaction_remark');
    
    table.timestamps(true, true);
    
    table.index('user_id');
    table.index('leave_type_id');
    table.index('status');
    table.index('start_date');
    table.index('end_date');
    table.index('current_approval_stage');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('leave_applications');
};
