exports.up = function(knex) {
  return knex.raw(`
    -- 為現有的 leave_balance_transactions 記錄設定預設有效日期
    -- 如果 start_date 和 end_date 為 null，則設定為該年度的完整期間
    UPDATE leave_balance_transactions 
    SET 
      start_date = CASE 
        WHEN start_date IS NULL THEN CONCAT(year, '-01-01')::date 
        ELSE start_date 
      END,
      end_date = CASE 
        WHEN end_date IS NULL THEN CONCAT(year, '-12-31')::date 
        ELSE end_date 
      END
    WHERE start_date IS NULL OR end_date IS NULL;
  `);
};

exports.down = function(knex) {
  // 不需要回復操作，因為我們只是填入預設值
  return Promise.resolve();
};
