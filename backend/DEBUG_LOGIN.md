# 登入問題診斷指南

## 當前狀態

.env 文件已創建，但登入仍然失敗。

## 診斷步驟

### 1. 測試環境變數

```bash
cd backend
node test-env.js
```

這會檢查：
- JWT_SECRET 是否正確加載
- Token 是否能成功生成

### 2. 檢查後端服務器啟動日誌

當你啟動後端服務器時，應該看到：
```
Server is running on port 8080
```

如果看到錯誤，請記錄下來。

### 3. 查看登入時的完整日誌

當你嘗試登入時，後端控制台應該顯示：

```
=== LOGIN REQUEST ===
Request body: { employee_number: 'admin001', password: 'admin123' }
Employee number: admin001
Password provided: Yes
Searching for user with employee_number: admin001
Query result: User found
Found user details:
- Employee number: ADMIN001
- Name: 系統管理員
- Is active: true
- Has password_hash: true
Comparing password...
Password match result: true
✅ Login successful for employee_number: admin001
Generating JWT token for user ID: 1
JWT_SECRET exists: true
Token generated successfully
```

請告訴我看到的是什麼訊息。

### 4. 檢查瀏覽器 Network 標籤

1. 打開瀏覽器開發者工具（F12）
2. 切換到 Network 標籤
3. 嘗試登入
4. 找到 `login` 請求
5. 查看：
   - Request Payload（發送的數據）
   - Response（後端返回的數據）
   - Status Code（狀態碼）

### 5. 可能的問題

#### 問題 A: JWT_SECRET 未加載

**症狀：** 看到 "secretOrPrivateKey must have a value"

**解決方案：**
```bash
cd backend
# 確認 .env 文件存在
ls .env

# 確認內容
cat .env

# 重啟服務器
npm start
```

#### 問題 B: 前端請求未到達後端

**症狀：** 後端控制台沒有顯示任何日誌

**檢查：**
- `frontend/package.json` 中 `proxy` 是否為 `"http://localhost:8080"`
- 後端是否運行在 8080 端口
- 瀏覽器 Network 標籤中請求的 URL

#### 問題 C: CORS 問題

**症狀：** 瀏覽器控制台顯示 CORS 錯誤

**解決方案：** 確認 `backend/server.js` 中有 `app.use(cors());`

#### 問題 D: 資料庫問題

**症狀：** 看到 "User not found"

**解決方案：**
```bash
cd backend
npm run migrate
npm run seed
```

## 請提供以下資訊

1. **`node test-env.js` 的輸出**
2. **後端服務器啟動時的訊息**
3. **嘗試登入時後端控制台的完整日誌**
4. **瀏覽器 Network 標籤中 `/api/auth/login` 請求的詳細信息**
   - Request Payload
   - Response
   - Status Code

這些資訊將幫助我們準確定位問題。

