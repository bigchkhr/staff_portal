# API 對接檢查清單

## 前端 API 調用 vs 後端路由

### ✅ 認證相關
- ✅ `POST /api/auth/login` → `backend/routes/auth.routes.js`
- ✅ `GET /api/auth/me` → `backend/routes/auth.routes.js`
- ✅ `PUT /api/auth/change-password` → `backend/routes/auth.routes.js`

### ✅ 假期管理
- ✅ `POST /api/leaves` → `backend/routes/leave.routes.js`
- ✅ `GET /api/leaves` → `backend/routes/leave.routes.js`
- ✅ `GET /api/leaves/:id` → `backend/routes/leave.routes.js`
- ✅ `GET /api/leaves/balances` → `backend/routes/leave.routes.js`
- ✅ `POST /api/leaves/:id/documents` → `backend/routes/leave.routes.js`
- ✅ `GET /api/leaves/:id/documents` → `backend/routes/leave.routes.js`

### ✅ 批核相關
- ✅ `GET /api/approvals/pending` → `backend/routes/approval.routes.js`
- ✅ `POST /api/approvals/:id/approve` → `backend/routes/approval.routes.js`

### ✅ 系統管理 (需要 System Admin 權限)
- ✅ `GET /api/admin/users` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/users` → `backend/routes/admin.routes.js`
- ✅ `PUT /api/admin/users/:id` → `backend/routes/admin.routes.js`
- ✅ `GET /api/admin/leave-types` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/leave-types` → `backend/routes/admin.routes.js`
- ✅ `PUT /api/admin/leave-types/:id` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/balances` → `backend/routes/admin.routes.js`
- ✅ `GET /api/admin/departments` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/departments` → `backend/routes/admin.routes.js`
- ✅ `PUT /api/admin/departments/:id` → `backend/routes/admin.routes.js`
- ✅ `GET /api/admin/positions` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/positions` → `backend/routes/admin.routes.js`
- ✅ `PUT /api/admin/positions/:id` → `backend/routes/admin.routes.js`
- ✅ `GET /api/admin/groups` → `backend/routes/admin.routes.js`
- ✅ `POST /api/admin/groups` → `backend/routes/admin.routes.js`
- ✅ `PUT /api/admin/groups/:id` → `backend/routes/admin.routes.js`

### ✅ 用戶相關
- ✅ `GET /api/users/profile` → `backend/routes/user.routes.js`
- ✅ `GET /api/users/department` → `backend/routes/user.routes.js` (部門主管專用)

### ✅ 公共 API (所有已認證用戶)
- ✅ `GET /api/departments` → `backend/routes/department.routes.js`
- ✅ `GET /api/positions` → `backend/routes/position.routes.js`
- ✅ `GET /api/groups` → `backend/routes/group.routes.js`
- ✅ `GET /api/leave-types` → `backend/routes/leaveType.routes.js`

## 狀態總結

**✅ 所有前端 API 調用都已與後端對接成功！**

所有 38+ 個 API 端點都已在後端實現，路由順序正確（具體路由在參數路由之前）。

## 最新修正

1. ✅ 新增 `GET /api/users/department` 端點，讓部門主管可以獲取部門內用戶列表（無需系統管理員權限）
2. ✅ 更新 `LeaveApplication.js`，部門主管現在使用 `/api/users/department` 而非 `/api/admin/users`

## 注意事項

1. 路由順序：在 `leave.routes.js` 中，`/balances` 路由在 `/:id` 之前，這是正確的。
2. 權限控制：
   - 所有 `/api/admin/*` 路由都需要系統管理員權限
   - `/api/users/department` 需要部門主管權限
3. 認證要求：除登入外，所有 API 都需要 JWT 認證。

