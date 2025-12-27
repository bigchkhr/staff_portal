# ⚡ 快速安全修復指南

**預計時間：** 5-10 分鐘  
**難度：** ⭐ 極易  
**效果：** 安全評分從 3.5/10 提升到 7.5/10

---

## 🎯 目標

啟用已準備好的安全措施，無需修改太多程式碼。

---

## 📝 修復步驟

### 步驟 1：啟用 Helmet 安全標頭（1 分鐘）

**檔案：** `backend/server.js`

**找到第 30 行：**
```javascript
// 安全頭設置（需要先安裝 helmet: npm install helmet）
// app.use(helmetConfig);
```

**修改為：**
```javascript
// 安全頭設置
app.use(helmetConfig);
```

---

### 步驟 2：啟用 API Rate Limiting（1 分鐘）

**檔案：** `backend/server.js`

**找到第 115 行：**
```javascript
// API Rate Limiting（需要先安裝: npm install express-rate-limit）
// app.use('/api', apiLimiter);
```

**修改為：**
```javascript
// API Rate Limiting
app.use('/api', apiLimiter);
```

---

### 步驟 3：啟用登入保護（1 分鐘）

**檔案：** `backend/routes/auth.routes.js`

**找到第 8-9 行：**
```javascript
// 登入端點加入 Rate Limiting（防暴力破解）
// 啟用時取消註解：router.post('/login', loginLimiter, authController.login);
router.post('/login', authController.login);
```

**修改為：**
```javascript
// 登入端點加入 Rate Limiting（防暴力破解）
const { loginLimiter } = require('../middleware/security');
router.post('/login', loginLimiter, authController.login);
```

---

### 步驟 4：清理敏感日誌（2 分鐘）

**檔案：** `backend/controllers/auth.controller.js`

**找到第 11 行：**
```javascript
console.log('Request body:', req.body);
```

**修改為：**
```javascript
// 移除敏感資訊（password）後記錄
const { password, ...safeBody } = req.body;
console.log('Request body:', safeBody);
```

---

### 步驟 5：設定環境變數（2 分鐘）

**檔案：** `backend/.env`

**確保有以下設定：**
```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=your-strong-secret-key-at-least-32-characters
```

**如果沒有 `.env` 檔案，從 `env.example.txt` 複製：**
```bash
cp env.example.txt .env
# 然後編輯 .env 填入實際值
```

---

### 步驟 6：簡化 Health Check（1 分鐘）

**檔案：** `backend/server.js`

**找到第 148-150 行：**
```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Leave Administration System API' });
});
```

**修改為：**
```javascript
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' }); // 移除詳細資訊，減少資訊洩露
});
```

---

## ✅ 驗證修復

### 1. 檢查套件是否已安裝

```bash
cd backend
npm list helmet express-rate-limit
```

**如果未安裝：**
```bash
npm install helmet express-rate-limit
```

### 2. 測試 Rate Limiting

```bash
# 快速發送多次請求（應該在第 101 次被拒絕）
for i in {1..110}; do
  curl http://localhost:8080/api/health
  echo ""
done
```

**預期結果：** 第 101 次請求應該回傳 `429 Too Many Requests`

### 3. 測試登入保護

```bash
# 嘗試登入 6 次（應該在第 6 次被拒絕）
for i in {1..6}; do
  curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"employee_number":"test","password":"wrong"}'
  echo ""
done
```

**預期結果：** 第 6 次請求應該回傳 `429 Too Many Requests`

### 4. 檢查安全標頭

```bash
curl -I http://localhost:8080/api/health
```

**預期結果：** 應該看到以下標頭：
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 📊 修復前後對比

| 安全項目 | 修復前 | 修復後 |
|---------|--------|--------|
| Rate Limiting | ❌ 0/10 | ✅ 9/10 |
| 登入保護 | ❌ 0/10 | ✅ 9/10 |
| 安全標頭 | ❌ 0/10 | ✅ 9/10 |
| 資訊洩露 | ⚠️ 5/10 | ✅ 8/10 |
| **總分** | **3.5/10** | **7.5/10** |

---

## 🚨 常見問題

### Q1: 啟用後出現錯誤 "Cannot find module 'helmet'"
**解決方案：**
```bash
npm install helmet express-rate-limit
```

### Q2: Rate Limiting 太嚴格，影響正常使用
**解決方案：** 調整 `middleware/security.js` 中的限制：
```javascript
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 從 100 增加到 200
  // ...
});
```

### Q3: 開發環境也需要啟用嗎？
**建議：** 開發環境可以保持寬鬆，但生產環境必須啟用。可以根據 `NODE_ENV` 條件啟用：
```javascript
if (process.env.NODE_ENV === 'production') {
  app.use(helmetConfig);
  app.use('/api', apiLimiter);
}
```

---

## 📋 檢查清單

完成修復後，確認：

- [ ] ✅ Helmet 已啟用（`app.use(helmetConfig)`）
- [ ] ✅ API Rate Limiting 已啟用（`app.use('/api', apiLimiter)`）
- [ ] ✅ 登入 Rate Limiting 已啟用（`loginLimiter` 中間件）
- [ ] ✅ 敏感日誌已清理（password 不記錄）
- [ ] ✅ 環境變數已設定（`NODE_ENV=production`）
- [ ] ✅ CORS 已設定（`ALLOWED_ORIGINS`）
- [ ] ✅ 套件已安裝（`helmet`, `express-rate-limit`）
- [ ] ✅ 測試通過（Rate Limiting 生效）

---

## 🎯 下一步

完成快速修復後，建議進行：

1. **加強輸入驗證**（中期改進）
   - 在所有 controllers 中使用 `express-validator`
   - 驗證 email、日期、數字格式

2. **加強檔案上傳驗證**（中期改進）
   - 檢查檔案內容（magic bytes）
   - 掃描惡意檔案

3. **加入 CSRF 保護**（中期改進）
   - 安裝 `csurf` 套件
   - 在需要保護的路由中加入 CSRF token

詳細改進計劃請參考：`SECURITY_RISK_ASSESSMENT.md`

---

**完成時間：** ________  
**完成者：** ________  
**備註：** ________

