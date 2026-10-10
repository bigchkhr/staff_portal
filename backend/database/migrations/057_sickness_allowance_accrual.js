exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('leave_balance_transactions', 'accrual_key');
  if (!hasColumn) {
    await knex.schema.alterTable('leave_balance_transactions', function (table) {
      table.string('accrual_key', 40).nullable();
      table.unique(['user_id', 'leave_type_id', 'accrual_key'], {
        indexName: 'leave_balance_tx_accrual_key_unique'
      });
    });
  }

  await knex('leave_types')
    .where(function () {
      this.where('code', 'SAL').orWhere(function () {
        this.where('name_zh', 'like', '%病假%').andWhere('name_zh', 'like', '%疾病津貼%');
      });
    })
    .update({ requires_balance: true });
};

exports.down = async function (knex) {
  await knex('leave_types')
    .where(function () {
      this.where('code', 'SAL').orWhere(function () {
        this.where('name_zh', 'like', '%病假%').andWhere('name_zh', 'like', '%疾病津貼%');
      });
    })
    .update({ requires_balance: false });

  const hasColumn = await knex.schema.hasColumn('leave_balance_transactions', 'accrual_key');
  if (hasColumn) {
    await knex.schema.alterTable('leave_balance_transactions', function (table) {
      table.dropUnique(['user_id', 'leave_type_id', 'accrual_key'], 'leave_balance_tx_accrual_key_unique');
      table.dropColumn('accrual_key');
    });
  }
};
