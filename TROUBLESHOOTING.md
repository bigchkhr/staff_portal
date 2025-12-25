# 登入問題排查指南

## 問題：使用 admin001 和 admin123 無法登入

### 檢查清單

#### 1. 確認資料庫已初始化
```bash
cd backend
npm run migrate    # 運行資料庫遷移
npm run seed        # 運行種子資料
```

#### 2. 確認後端服務器運行
```bash
cd backend
npm start
# 或
npm run dev
```
確認看到：`Server is running on port 8080`

#### 3. 確認前端服務器運行
```bash
cd frontend
npm start
```
確認看到前端應用運行在 `http://localhost:3000`

#### 4. 測試後端連接
在瀏覽器中訪問：
```
http://localhost:8080/api/health
```
應該看到：`{"status":"OK","message":"Leave Administration System API"}`

#### 5. 檢查後端日誌
當你嘗試登入時，後端控制台應該顯示：
```
Login attempt: { employee_number: 'admin001' }
Login successful for employee_number: admin001
```
或
```
Login attempt: { employee_number: 'admin001' }
User not found for employee_number: admin001
```

#### 6. 運行測試腳本
```bash
cd backend
node test-login.js
```
這會檢查：
- 資料庫中是否有用戶
- 密碼是否正確
- 不同大小寫的員工編號是否能找到用戶

### 可能的問題和解決方案

#### 問題 1: 資料庫中沒有用戶
**解決方案：**
```bash
cd backend
npm run seed
```

#### 問題 2: 密碼錯誤
**確認密碼：**
- 系統管理員密碼：`admin123`
- 一般員工密碼：`user123`

#### 問題 3: 員工編號大小寫問題
**現在已支援：**
- `ADMIN001`（大寫）
- `admin001`（小寫）
- `Admin001`（混合）

#### 問題 4: 前端無法連接到後端
**檢查：**
1. `frontend/package.json` 中 `proxy` 是否為 `"http://localhost:8080"`
2. 後端服務器是否運行在 8080
3. 瀏覽器開發者工具的 Network 標籤，查看請求是否發送到正確的地址

#### 問題 5: CORS 問題
如果看到 CORS 錯誤，確認 `backend/server.js` 中有：
```javascript
app.use(cors());
```

### 正確的登入資訊

#### 系統管理員
- **員工編號**: `ADMIN001` 或 `admin001`（已支援大小寫不敏感）
- **密碼**: `admin123`

#### 一般員工
- **員工編號**: `EMP001` 或 `emp001`（已支援大小寫不敏感）
- **密碼**: `user123`

### 如何查看錯誤詳情

1. **後端控制台**：查看登入嘗試的日誌
2. **瀏覽器控制台**：查看前端錯誤訊息
3. **瀏覽器 Network 標籤**：查看 API 請求的響應

### 測試 API 是否正常

使用 curl 或 Postman 測試：
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_number":"admin001","password":"admin123"}'
```

應該返回：
```json
{
  "message": "登入成功",
  "token": "...",
  "user": {...}
}
```

