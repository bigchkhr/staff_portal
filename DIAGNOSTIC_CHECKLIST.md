# 登入問題診斷清單

## ✅ 已完成的檢查

1. ✅ .env 文件已創建（`backend/.env`）
2. ✅ JWT_SECRET 已設置並驗證（測試腳本顯示成功）
3. ✅ Token 生成功能正常（測試腳本顯示成功）
4. ✅ 資料庫連接正常（登入時能找到用戶）
5. ✅ 密碼驗證正常（日誌顯示 Login successful）

## 🔍 請檢查以下內容

### 1. 後端服務器日誌

當你嘗試登入時，請查看後端控制台的完整輸出。應該看到：

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

**請告訴我看到的最後幾行是什麼。**

### 2. 前端瀏覽器控制台

打開瀏覽器開發者工具（F12），查看 Console 標籤。嘗試登入時應該看到：

```
Login form submitted: {employeeNumber: "admin001", password: "***"}
Frontend: Attempting login with employee_number: admin001
Frontend: Login response received: {...}
Frontend: Login successful
Login result: {success: true}
Navigating to dashboard...
```

或錯誤訊息：

```
Frontend: Login error: ...
Frontend: Error response: {...}
Frontend: Error status: 500
Login failed: ...
```

**請告訴我在瀏覽器控制台看到的是什麼。**

### 3. 瀏覽器 Network 標籤

1. 打開瀏覽器開發者工具（F12）
2. 切換到 **Network** 標籤
3. 嘗試登入
4. 找到 `login` 請求（通常在列表最上方）
5. 點擊該請求，查看：

**Request（請求）:**
- URL: 應該是 `http://localhost:3000/api/auth/login`（或類似的）
- Method: POST
- Request Payload: `{"employee_number":"admin001","password":"admin123"}`

**Response（響應）:**
- Status: 應該是 200（成功）或其他狀態碼
- Response 內容：應該包含 `token` 和 `user` 對象

**請告訴我：**
1. Status Code 是什麼？（200, 401, 500 等）
2. Response 的內容是什麼？

### 4. 確認後端服務器正在運行

檢查後端控制台是否顯示：
```
Server is running on port 8080
```

### 5. 確認前端代理設置

檢查 `frontend/package.json` 中是否有：
```json
"proxy": "http://localhost:8080"
```

## 🚨 常見問題

### 如果看到 Status 500

後端控制台應該會顯示詳細錯誤訊息。請複製完整的錯誤訊息。

### 如果看到 Status 401

可能是：
- 員工編號錯誤（請確認是 `ADMIN001` 或 `admin001`）
- 密碼錯誤（請確認是 `admin123`）
- 用戶不存在（請運行 `npm run seed`）

### 如果請求沒有到達後端

- 檢查前端代理設置
- 檢查後端是否在 8080 端口運行
- 檢查瀏覽器 Network 標籤中請求的 URL

## 📋 請提供以下資訊

1. **後端控制台的完整日誌**（從登入嘗試開始到結束）
2. **瀏覽器控制台的日誌**（所有 console.log 輸出）
3. **Network 標籤中的 Status Code 和 Response**
4. **前端頁面顯示的錯誤訊息**

有了這些資訊，我可以準確找出問題所在。

