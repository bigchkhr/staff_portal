# 快速修復指南

## 問題：500 錯誤

前端顯示 `Request failed with status code 500`，這表示後端服務器發生了錯誤。

## 立即檢查步驟

### 1. 查看後端控制台的錯誤訊息

**最關鍵的一步！** 後端控制台會顯示完整的錯誤堆疊。

請查看後端服務器控制台，找到類似這樣的錯誤訊息：
```
❌ Login error: ...
Error stack: ...
```

**請複製完整的錯誤訊息。**

### 2. 確認 .env 文件已正確加載

啟動後端服務器時，現在應該看到：
```
=== Environment Variables Check ===
PORT: 8080
JWT_SECRET: ✅ SET (56 chars)
...
```

如果看到 `JWT_SECRET: ❌ NOT SET`，請：
1. 確認 `backend/.env` 文件存在
2. 重啟後端服務器

### 3. 檢查後端服務器啟動日誌

當你啟動後端服務器時，應該看到：
```
=== Environment Variables Check ===
...
Server is running on port 8080
```

### 4. 最常見的問題

#### A. JWT_SECRET 未正確加載

**症狀：** 後端控制台顯示 "JWT_SECRET is not set"

**解決方案：**
1. 確認 `backend/.env` 文件存在
2. 確認文件內容正確（沒有額外空格）
3. **完全關閉並重新啟動後端服務器**
4. 確認啟動日誌顯示 `JWT_SECRET: ✅ SET`

#### B. 資料庫連接問題

**症狀：** 後端控制台顯示資料庫相關錯誤

**解決方案：**
1. 確認 PostgreSQL 正在運行
2. 檢查 `backend/.env` 中的資料庫配置
3. 確認資料庫 `leave_admin` 已創建

#### C. 用戶數據問題

**症狀：** 找不到用戶或密碼錯誤

**解決方案：**
```bash
cd backend
npm run seed
```

## 請提供

**後端控制台的完整錯誤訊息**（包括堆疊追蹤）

這是診斷 500 錯誤的最重要信息！

