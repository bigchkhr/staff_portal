# 後端設置指南

## 快速設置步驟

### 1. 安裝依賴
```bash
cd backend
npm install
```

### 2. 創建 `.env` 文件

在 `backend` 文件夾中創建 `.env` 文件，複製以下內容：

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

**重要：** 複製 `.env.example` 文件並重命名為 `.env`，然後根據您的環境修改配置。

### 3. 設置資料庫

確保 PostgreSQL 正在運行，然後：

```bash
cd backend
npm run migrate    # 創建資料表
npm run seed        # 插入初始數據
```

### 4. 啟動後端服務器

```bash
cd backend
npm start
```

或開發模式（自動重啟）：

```bash
cd backend
npm run dev
```

服務器將運行在 `http://localhost:8080`

## 測試

### 測試資料庫連接
```bash
cd backend
node check-db.js
```

### 測試登入功能
```bash
cd backend
node test-login.js
```

## 默認登入資訊

### 系統管理員
- **員工編號**: `ADMIN001` 或 `admin001`
- **密碼**: `admin123`

### 一般員工
- **員工編號**: `EMP001` 或 `emp001`
- **密碼**: `user123`

## 常見問題

### 問題 1: `secretOrPrivateKey must have a value`
**解決方案：** 創建 `.env` 文件並設置 `JWT_SECRET`

### 問題 2: 資料庫連接失敗
**解決方案：** 檢查 `.env` 文件中的資料庫配置，確保 PostgreSQL 正在運行

### 問題 3: 找不到用戶
**解決方案：** 運行 `npm run seed` 插入初始數據

