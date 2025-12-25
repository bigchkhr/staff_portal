# 環境變數設置指南

## 問題
錯誤：`secretOrPrivateKey must have a value`

這表示 `JWT_SECRET` 環境變數沒有設置。

## 解決方案

### 1. 在 `backend` 文件夾中創建 `.env` 文件

創建文件：`backend/.env`

### 2. 將以下內容複製到 `.env` 文件：

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=leave_admin
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=8080
NODE_ENV=development

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

### 3. 重新啟動後端服務器

```bash
cd backend
npm start
```

或

```bash
cd backend
npm run dev
```

## 重要提醒

1. **`.env` 文件必須在 `backend` 文件夾中**
2. **不要將 `.env` 文件提交到 Git**（已在 `.gitignore` 中）
3. **生產環境請更改 `JWT_SECRET` 為更複雜的值**

## 驗證

重啟後端服務器後，再次嘗試登入，應該可以成功了！

如果仍然有問題，請檢查：
- `.env` 文件是否在正確的位置（`backend/.env`）
- 文件編碼是否正確（UTF-8）
- 是否有語法錯誤（每個變數一行，沒有空格）

