# 假期管理系統 (Leave Administration System)

這是一個適用於香港的完整假期管理系統，包含前端和後端，使用現代化技術棧構建。

## 技術棧

### 後端
- **Node.js** + **Express.js** - 後端框架
- **PostgreSQL** - 資料庫
- **Knex.js** - SQL 查詢建構器
- **JWT** - 身份認證
- **bcryptjs** - 密碼加密
- **Multer** - 檔案上載處理

### 前端
- **React.js** - 前端框架
- **Material-UI (MUI)** - UI 組件庫
- **React Router** - 路由管理
- **Axios** - HTTP 客戶端
- **Day.js** - 日期處理

## 功能特性

### 假期管理
- ✅ 假期類型管理（有餘額限制和無餘額限制）
- ✅ 假期申請流程
- ✅ 多級批核流程（檢查 → 第一批核 → 第二批核 → 第三批核 (HR)）
- ✅ 假期餘額管理
- ✅ 申請歷史追蹤
- ✅ 交易編號追蹤
- ✅ 證明文件上載

### 用戶管理
- ✅ 用戶帳戶管理
- ✅ 角色權限控制（系統管理員、部門主管、一般員工）
- ✅ 部門管理
- ✅ 職位管理
- ✅ 群組管理
- ✅ 密碼更改功能

### 批核系統
- ✅ 多級批核流程
- ✅ 批核進度追蹤
- ✅ 批核意見記錄
- ✅ 批核歷史記錄

## 安裝與設置

### 前置需求
- Node.js (v14 或以上)
- PostgreSQL (v12 或以上)
- npm 或 yarn

### 1. 克隆專案
```bash
git clone <repository-url>
cd Leave_Administartion
```

### 2. 設置後端

```bash
# 進入後端文件夾
cd backend

# 安裝依賴
npm install

# 設置環境變數
# 在 backend 文件夾中創建 .env 文件
# 根據您的環境設置資料庫連接和 JWT 密鑰

# 運行資料庫遷移
npm run migrate

# 啟動後端服務器（開發模式）
npm run dev
# 或
npm start
```

後端服務器將運行在 `http://localhost:3000`

### 3. 設置前端

```bash
# 進入前端目錄
cd frontend

# 安裝依賴
npm install

# 啟動前端開發服務器
npm start
```

前端應用將運行在 `http://localhost:3000` (如果後端在不同端口，前端會自動使用 proxy)

## 環境變數配置

後端需要設置以下環境變數（在 `.env` 文件中）：

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

## 資料庫結構

系統包含以下主要表：
- `users` - 用戶表
- `departments` - 部門表
- `positions` - 職位表
- `groups` - 群組表
- `leave_types` - 假期類型表
- `leave_balances` - 假期餘額表
- `leave_applications` - 假期申請表
- `leave_documents` - 證明文件表
- `group_permissions` - 群組權限表

## 假期類型

### 有餘額限制的假期（需系統管理員輸入餘額）
- 年假 (Annual Leave)
- 生日假 (Birthday Leave)
- 補假 (Compensatory Leave)
- 全薪病假 (Paid Sick Leave)

### 無餘額限制的假期（只需批核流程）
- 婚假 (Marriage Leave)
- 無薪病假 (Unpaid Sick Leave)
- 無薪事假 (Unpaid Personal Leave)

## 批核流程

每個假期申請遵循以下流程：
1. **申請** → 提交假期申請
2. **檢查 (Checker)** → 檢查申請資料
3. **第一批核 (Approver 1)** → 第一批核
4. **第二批核 (Approver 2)** → 第二批核
5. **第三批核 (Approver 3 / HR)** → HR 群組批核

每個申請都有獨立的交易編號 (Transaction ID) 用於追蹤。

## 角色權限

### 系統管理員 (System Admin)
- 全權管理系統
- 管理用戶帳戶
- 設定批核流程
- 管理假期類型
- 設定假期餘額
- 管理部門、職位、群組

### 部門主管 (Department Head)
- 查看部門員工的申請
- 代員工申請假期
- 批核權限
- 查看部門統計

### 一般員工 (Employee)
- 申請假期
- 查看自己的餘額
- 查看申請歷史
- 追蹤批核進度
- 上載證明文件

## API 端點

### 認證
- `POST /api/auth/login` - 登入
- `GET /api/auth/me` - 獲取當前用戶
- `PUT /api/auth/change-password` - 更改密碼

### 假期管理
- `POST /api/leaves` - 提交假期申請
- `GET /api/leaves` - 獲取申請列表
- `GET /api/leaves/:id` - 獲取申請詳情
- `GET /api/leaves/balances` - 獲取假期餘額
- `POST /api/leaves/:id/documents` - 上載證明文件

### 批核
- `GET /api/approvals/pending` - 獲取待批核申請
- `POST /api/approvals/:id/approve` - 批核申請

### 系統管理（需系統管理員權限）
- `POST /api/admin/users` - 建立用戶
- `PUT /api/admin/users/:id` - 更新用戶
- `GET /api/admin/users` - 獲取用戶列表
- `POST /api/admin/leave-types` - 建立假期類型
- `POST /api/admin/balances` - 設定假期餘額
- 以及其他管理端點...

## 開發說明

### 資料庫遷移
```bash
# 運行遷移
npm run migrate

# 回滾遷移
npm run migrate:rollback
```

### 前端開發
前端使用 React 和 Material-UI，所有頁面都是獨立頁面（不使用 Modal）。

### 權限控制
使用三元運算子進行條件渲染，根據用戶角色顯示不同的菜單選項和功能。

## 注意事項

1. 確保 PostgreSQL 資料庫已正確設置並運行
2. 首次運行前需要執行資料庫遷移
3. 上載的檔案會存放在 `./uploads` 目錄
4. 生產環境請更改 JWT_SECRET
5. 請設置適當的 CORS 配置

## 授權

此專案為內部使用系統。

## 支援

如有問題，請聯繫系統管理員。
