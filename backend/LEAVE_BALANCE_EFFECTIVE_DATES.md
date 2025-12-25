# 假期餘額有效日期功能說明

## 概述
根據系統需求，假期餘額管理的有效日期（開始及結束）現在是必填項目，所有假期申請都必須參考相關的有效期。

## 主要變更

### 1. 資料庫變更
- **Migration 020**: 將 `leave_balance_transactions` 表的 `start_date` 和 `end_date` 欄位改為必填
- **Migration 021**: 為現有記錄設定預設有效日期（年度完整期間）

### 2. 模型增強

#### LeaveBalanceTransaction 模型
- 新增建立交易時的有效日期驗證
- 新增 `isDateWithinValidPeriod()` 方法：檢查指定日期是否在有效期內
- 新增 `getValidBalanceForPeriod()` 方法：取得適用於指定申請期間的有效餘額

#### LeaveBalance 模型
- 更新 `decrementBalance()` 和 `incrementBalance()` 方法，支援有效日期參數
- 加強餘額扣除時的有效期檢查

### 3. 申請流程增強

#### 假期申請驗證
- 申請時自動檢查申請日期是否在有效餘額期間內
- 如果申請期間超出有效期範圍，系統會拒絕申請並提示錯誤訊息

#### 餘額操作
- 扣除餘額時會檢查申請期間的有效餘額
- 退回餘額時會保留原申請的有效期資訊

## 使用說明

### 1. 建立假期餘額分配
```javascript
await LeaveBalanceTransaction.create({
  user_id: 1,
  leave_type_id: 1,
  year: 2024,
  amount: 14,
  start_date: '2024-01-01',  // 必填：有效開始日期
  end_date: '2024-12-31',    // 必填：有效結束日期
  remarks: '年度假期分配',
  created_by_id: adminUserId
});
```

### 2. 檢查有效期
```javascript
// 檢查特定日期是否在有效期內
const isValid = await LeaveBalanceTransaction.isDateWithinValidPeriod(
  userId, 
  leaveTypeId, 
  '2024-06-15'
);

// 取得申請期間的有效餘額
const validBalance = await LeaveBalanceTransaction.getValidBalanceForPeriod(
  userId,
  leaveTypeId,
  '2024-06-01',  // 申請開始日期
  '2024-06-05'   // 申請結束日期
);
```

### 3. 假期申請自動驗證
系統會自動在假期申請時：
1. 檢查總餘額是否足夠
2. 檢查申請期間是否在有效餘額範圍內
3. 如果有效餘額不足，會顯示明確的錯誤訊息

## 錯誤訊息
- `"有效開始日期和結束日期為必填項目"` - 建立交易時未提供有效日期
- `"有效日期格式不正確"` - 日期格式無效
- `"有效結束日期不能早於開始日期"` - 日期邏輯錯誤
- `"申請日期超出假期餘額有效期範圍，該期間可用餘額不足"` - 申請期間超出有效期

## 遷移注意事項

### 執行 Migration
1. 執行 migration 020 將有效日期改為必填
2. 執行 migration 021 為現有記錄設定預設有效日期
3. 建議在正式環境執行前先在測試環境驗證

### 現有資料處理
- 所有現有的餘額交易記錄會自動設定為該年度的完整期間（1月1日至12月31日）
- 如需調整特定記錄的有效期，可在 migration 執行後手動更新

### 系統管理
- HR 人員在分配假期餘額時，必須指定明確的有效期間
- 建議根據公司政策設定合適的有效期（如：當年度、跨年度等）

## API 變更
現有的 API 端點保持向後兼容，但建議在建立餘額交易時提供 `start_date` 和 `end_date` 參數。
