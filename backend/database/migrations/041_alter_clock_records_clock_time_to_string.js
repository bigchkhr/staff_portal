exports.up = function(knex) {
  // 將 clock_time 從 time 類型改為 varchar 類型，以支援 0-32 小時
  // 先將現有的 time 值轉換為字符串格式（HH:mm:ss）
  return knex.raw(`
    ALTER TABLE clock_records 
    ALTER COLUMN clock_time TYPE VARCHAR(10) 
    USING clock_time::text;
  `);
};

exports.down = function(knex) {
  // 還原為 time 類型（注意：這可能會導致超過 24 小時的數據丟失或錯誤）
  // 只轉換有效的時間格式（00:00:00 到 23:59:59）
  return knex.raw(`
    ALTER TABLE clock_records 
    ALTER COLUMN clock_time TYPE TIME 
    USING CASE 
      WHEN clock_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$' 
      THEN clock_time::TIME 
      ELSE '00:00:00'::TIME 
    END;
  `);
};

