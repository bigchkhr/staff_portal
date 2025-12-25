# 後端 API 文件

這是假期管理系統的後端服務器。

## 安裝

```bash
npm install
```

## 環境變數

在 `backend` 文件夾中創建 `.env` 文件：

```env
# 資料庫配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=leave_admin
DB_USER=postgres
DB_PASSWORD=postgres

# JWT 配置
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 服務器配置
PORT=3000
NODE_ENV=development

# 檔案上載配置
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

## 資料庫遷移

```bash
# 運行遷移
npm run migrate

# 回滾遷移
npm run migrate:rollback

# 運行種子資料
npm run seed
```

## 啟動服務器

```bash
# 開發模式（使用 nodemon）
npm run dev

# 生產模式
npm start
```

服務器將運行在 `http://localhost:3000` (或您在 .env 中設置的 PORT)

## API 端點

詳見主 README.md 文件中的 API 端點說明。

