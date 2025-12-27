# 🔒 安全風險評估報告

**評估日期：** 2025-12-28  
**評估範圍：** Backend API 安全防護  
**部署環境：** EC2 (0.0.0.0/0)

---

## 📊 總體安全評分

### 當前狀態：**3.5/10** ⚠️ **高風險**

### 啟用所有安全措施後：**8.5/10** ✅ **中等風險**

---

## 🚨 關鍵風險項目（按嚴重程度排序）

### 🔴 **嚴重風險（Critical）**

#### 1. **無 Rate Limiting 保護**
- **風險等級：** 🔴 嚴重
- **影響：** 
  - 暴力破解攻擊（登入端點）
  - DDoS 攻擊（所有 API 端點）
  - 資源耗盡攻擊
- **當前狀態：** ❌ 已定義但**未啟用**
- **位置：** `server.js` 第 115 行（註解）
- **修復難度：** ⭐ 極易（取消註解即可）
- **建議：** 立即啟用 `app.use('/api', apiLimiter)`

#### 2. **登入端點無保護**
- **風險等級：** 🔴 嚴重
- **影響：**
  - 暴力破解密碼
  - 帳號列舉攻擊
  - 自動化攻擊腳本
- **當前狀態：** ❌ 已定義但**未啟用**
- **位置：** `routes/auth.routes.js` 第 8 行（註解）
- **修復難度：** ⭐ 極易
- **建議：** 立即啟用 `loginLimiter` 中間件

#### 3. **無安全標頭（Helmet）**
- **風險等級：** 🔴 嚴重
- **影響：**
  - XSS 攻擊（跨站腳本）
  - Clickjacking 攻擊
  - MIME 類型嗅探
  - 資訊洩露（X-Powered-By）
- **當前狀態：** ❌ 已定義但**未啟用**
- **位置：** `server.js` 第 30 行（註解）
- **修復難度：** ⭐ 極易
- **建議：** 立即啟用 `app.use(helmetConfig)`

#### 4. **輸入驗證不足**
- **風險等級：** 🔴 嚴重
- **影響：**
  - 資料注入攻擊
  - 格式錯誤導致系統異常
  - 惡意輸入導致邏輯錯誤
- **當前狀態：** ⚠️ 只有基本空值檢查
- **問題：**
  - 未使用 `express-validator`（已安裝但未使用）
  - 無輸入 sanitization
  - 無長度限制
  - 無格式驗證（email、日期、數字等）
- **修復難度：** ⭐⭐⭐ 中等（需要修改多個 controllers）
- **建議：** 在所有 controllers 中加入輸入驗證

---

### 🟠 **高風險（High）**

#### 5. **CORS 配置過於寬鬆（開發模式）**
- **風險等級：** 🟠 高
- **影響：**
  - 任何網站都可以呼叫你的 API
  - CSRF 攻擊風險增加
- **當前狀態：** ⚠️ 開發模式允許所有來源
- **位置：** `server.js` 第 81-82 行
- **問題：**
  ```javascript
  if (process.env.NODE_ENV !== 'production' && !process.env.ALLOWED_ORIGINS) {
    return callback(null, true); // 允許所有來源！
  }
  ```
- **修復難度：** ⭐ 極易
- **建議：** 生產環境務必設定 `NODE_ENV=production` 和 `ALLOWED_ORIGINS`

#### 6. **日誌可能洩露敏感資訊**
- **風險等級：** 🟠 高
- **影響：**
  - 密碼可能被記錄（雖然是 hash）
  - 請求 body 完整記錄
  - 可能洩露業務邏輯
- **當前狀態：** ⚠️ 登入時記錄完整請求 body
- **位置：** `controllers/auth.controller.js` 第 11 行
- **問題：**
  ```javascript
  console.log('Request body:', req.body); // 可能包含敏感資訊
  ```
- **修復難度：** ⭐ 極易
- **建議：** 移除或遮蔽敏感欄位（如 password）

#### 7. **Health Check 端點公開**
- **風險等級：** 🟠 高
- **影響：**
  - 資訊洩露（系統狀態）
  - 可用於探測系統
- **當前狀態：** ⚠️ 公開訪問，無認證
- **位置：** `server.js` 第 148 行
- **建議：** 限制資訊或加入基本認證

#### 8. **檔案上傳驗證不足**
- **風險等級：** 🟠 高
- **影響：**
  - 惡意檔案上傳
  - 檔案類型偽造（MIME type 可被偽造）
  - 路徑遍歷攻擊（雖然已使用時間戳）
- **當前狀態：** ⚠️ 有基本驗證但不足
- **問題：**
  - 只檢查 MIME type 和副檔名（可偽造）
  - 未檢查檔案內容
  - 未掃描惡意檔案
- **修復難度：** ⭐⭐ 中等
- **建議：** 加入檔案內容檢查、病毒掃描

---

### 🟡 **中等風險（Medium）**

#### 9. **無 CSRF 保護**
- **風險等級：** 🟡 中等
- **影響：**
  - 跨站請求偽造攻擊
  - 未授權操作
- **當前狀態：** ❌ 無 CSRF token 驗證
- **修復難度：** ⭐⭐ 中等
- **建議：** 使用 `csurf` 或 `csrf` 套件

#### 10. **JWT Token 無過期時間檢查**
- **風險等級：** 🟡 中等
- **影響：**
  - Token 被盜用後永久有效
  - 無法強制登出
- **當前狀態：** ⚠️ 需要檢查 JWT 實作
- **建議：** 設定合理的過期時間，實作 refresh token

#### 11. **無請求 ID 追蹤**
- **風險等級：** 🟡 中等
- **影響：**
  - 難以追蹤異常請求
  - 除錯困難
- **當前狀態：** ⚠️ 有日誌但無唯一請求 ID
- **建議：** 加入 `uuid` 或 `request-id` 中間件

#### 12. **密碼策略未強制**
- **風險等級：** 🟡 中等
- **影響：**
  - 弱密碼容易被破解
  - 帳號安全風險
- **當前狀態：** ⚠️ 只有前端驗證（可繞過）
- **建議：** 後端強制密碼複雜度要求

---

### 🟢 **低風險（Low）**

#### 13. **SQL Injection 防護**
- **風險等級：** 🟢 低（已防護）
- **狀態：** ✅ 良好
- **原因：** 使用 Knex ORM，所有查詢都是參數化的
- **建議：** 保持現狀，避免使用 raw SQL

#### 14. **密碼加密**
- **風險等級：** 🟢 低（已防護）
- **狀態：** ✅ 良好
- **原因：** 使用 bcryptjs 進行雜湊
- **建議：** 保持現狀

#### 15. **認證與授權機制**
- **風險等級：** 🟢 低（已實作）
- **狀態：** ✅ 良好
- **原因：** JWT 認證、權限分級（系統管理員、部門主管）
- **建議：** 保持現狀

---

## 📋 詳細風險分析

### 攻擊向量分析

| 攻擊類型 | 風險等級 | 當前防護 | 建議措施 |
|---------|---------|---------|---------|
| **暴力破解** | 🔴 嚴重 | ❌ 無 | 啟用 `loginLimiter` |
| **DDoS** | 🔴 嚴重 | ❌ 無 | 啟用 `apiLimiter` |
| **XSS** | 🔴 嚴重 | ❌ 無 | 啟用 `helmet` |
| **SQL Injection** | 🟢 低 | ✅ 已防護 | 保持現狀 |
| **檔案上傳攻擊** | 🟠 高 | ⚠️ 部分 | 加強驗證 |
| **CSRF** | 🟡 中等 | ❌ 無 | 加入 CSRF token |
| **資訊洩露** | 🟠 高 | ⚠️ 部分 | 清理日誌 |
| **路徑遍歷** | 🟢 低 | ✅ 已防護 | 保持現狀 |

---

## 🛠️ 立即修復清單（優先級排序）

### ⚡ **立即修復（5 分鐘內）**

1. **啟用 Rate Limiting**
   ```javascript
   // server.js 第 115 行
   app.use('/api', apiLimiter); // 取消註解
   ```

2. **啟用登入保護**
   ```javascript
   // routes/auth.routes.js 第 8 行
   router.post('/login', loginLimiter, authController.login); // 取消註解
   ```

3. **啟用 Helmet**
   ```javascript
   // server.js 第 30 行
   app.use(helmetConfig); // 取消註解
   ```

4. **設定環境變數**
   ```bash
   NODE_ENV=production
   ALLOWED_ORIGINS=https://your-frontend.com
   ```

### 🔧 **短期修復（1-2 小時）**

5. **清理敏感日誌**
   ```javascript
   // controllers/auth.controller.js
   // 移除或遮蔽 password 欄位
   const { password, ...safeBody } = req.body;
   console.log('Request body:', safeBody);
   ```

6. **加強 Health Check**
   ```javascript
   // server.js
   app.get('/api/health', (req, res) => {
     res.json({ status: 'OK' }); // 移除詳細資訊
   });
   ```

### 📅 **中期改進（1-2 天）**

7. **加入輸入驗證**
   - 在所有 controllers 中使用 `express-validator`
   - 驗證 email、日期、數字格式
   - 設定長度限制

8. **加強檔案上傳驗證**
   - 檢查檔案內容（magic bytes）
   - 掃描惡意檔案
   - 限制檔案數量

9. **加入 CSRF 保護**
   - 安裝 `csurf` 套件
   - 在需要保護的路由中加入 CSRF token

---

## 📊 安全評分對比

### 當前狀態（未啟用安全措施）

| 安全項目 | 評分 | 狀態 |
|---------|------|------|
| Rate Limiting | 0/10 | ❌ 未啟用 |
| 登入保護 | 0/10 | ❌ 未啟用 |
| 安全標頭 | 0/10 | ❌ 未啟用 |
| 輸入驗證 | 3/10 | ⚠️ 基本檢查 |
| SQL Injection | 8/10 | ✅ 已防護 |
| 檔案上傳 | 5/10 | ⚠️ 部分防護 |
| CORS | 6/10 | ⚠️ 開發模式寬鬆 |
| 認證授權 | 8/10 | ✅ 已實作 |
| 密碼加密 | 8/10 | ✅ 已實作 |
| **總分** | **3.8/10** | ⚠️ **高風險** |

### 啟用所有安全措施後

| 安全項目 | 評分 | 狀態 |
|---------|------|------|
| Rate Limiting | 9/10 | ✅ 已啟用 |
| 登入保護 | 9/10 | ✅ 已啟用 |
| 安全標頭 | 9/10 | ✅ 已啟用 |
| 輸入驗證 | 7/10 | ⚠️ 需改進 |
| SQL Injection | 8/10 | ✅ 已防護 |
| 檔案上傳 | 7/10 | ⚠️ 需改進 |
| CORS | 9/10 | ✅ 已設定 |
| 認證授權 | 8/10 | ✅ 已實作 |
| 密碼加密 | 8/10 | ✅ 已實作 |
| **總分** | **8.0/10** | ✅ **中等風險** |

---

## 🎯 攻擊場景模擬

### 場景 1：暴力破解攻擊
**攻擊者行為：**
```bash
# 使用工具自動嘗試登入
for i in {1..10000}; do
  curl -X POST http://your-server.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"employee_number":"admin","password":"password'$i'"}'
done
```

**當前防護：** ❌ 無（可無限嘗試）  
**啟用 Rate Limiting 後：** ✅ 第 6 次嘗試後被封鎖 15 分鐘

---

### 場景 2：DDoS 攻擊
**攻擊者行為：**
```bash
# 發送大量請求
ab -n 100000 -c 1000 http://your-server.com/api/health
```

**當前防護：** ❌ 無（伺服器可能癱瘓）  
**啟用 Rate Limiting 後：** ✅ 每 IP 15 分鐘限制 100 次請求

---

### 場景 3：XSS 攻擊
**攻擊者行為：**
```javascript
// 在輸入欄位注入腳本
<script>alert('XSS')</script>
```

**當前防護：** ❌ 無安全標頭  
**啟用 Helmet 後：** ✅ CSP 標頭會阻擋腳本執行

---

### 場景 4：檔案上傳攻擊
**攻擊者行為：**
```bash
# 偽造檔案類型上傳惡意檔案
curl -X POST http://your-server.com/api/documents/upload \
  -F "file=@malware.exe" \
  -H "Content-Type: application/pdf" # 偽造 MIME type
```

**當前防護：** ⚠️ 只檢查 MIME type（可偽造）  
**建議改進：** 檢查檔案內容（magic bytes）

---

## 📈 風險矩陣

| 攻擊難度 | 影響程度 | 風險等級 | 當前防護 |
|---------|---------|---------|---------|
| 極易 | 嚴重 | 🔴 嚴重 | ❌ 無 |
| 容易 | 高 | 🟠 高 | ⚠️ 部分 |
| 中等 | 中等 | 🟡 中等 | ⚠️ 部分 |
| 困難 | 低 | 🟢 低 | ✅ 已防護 |

---

## ✅ 已實作的安全措施

1. ✅ **SQL Injection 防護** - 使用 Knex ORM
2. ✅ **密碼加密** - 使用 bcryptjs
3. ✅ **JWT 認證** - Token 基礎認證
4. ✅ **權限分級** - 系統管理員、部門主管
5. ✅ **請求大小限制** - 10MB 限制
6. ✅ **檔案類型驗證** - MIME type 和副檔名
7. ✅ **檔案大小限制** - 5MB/8MB
8. ✅ **安全日誌** - 生產環境記錄異常

---

## ❌ 缺少的安全措施

1. ❌ **Rate Limiting** - 未啟用
2. ❌ **登入保護** - 未啟用
3. ❌ **Helmet 安全標頭** - 未啟用
4. ❌ **輸入驗證** - 不足
5. ❌ **CSRF 保護** - 無
6. ❌ **檔案內容驗證** - 無
7. ❌ **密碼策略強制** - 無
8. ❌ **請求 ID 追蹤** - 無

---

## 🚀 快速修復指南

### 步驟 1：啟用基本安全措施（5 分鐘）

```javascript
// backend/server.js

// 1. 啟用 Helmet（第 30 行）
app.use(helmetConfig);

// 2. 啟用 Rate Limiting（第 115 行）
app.use('/api', apiLimiter);
```

```javascript
// backend/routes/auth.routes.js

// 3. 啟用登入保護（第 8 行）
router.post('/login', loginLimiter, authController.login);
```

### 步驟 2：設定環境變數

```bash
# .env
NODE_ENV=production
ALLOWED_ORIGINS=https://your-frontend-domain.com
JWT_SECRET=your-strong-secret-key
```

### 步驟 3：清理敏感日誌

```javascript
// backend/controllers/auth.controller.js
// 移除或修改第 11 行
const { password, ...safeBody } = req.body;
console.log('Request body:', safeBody);
```

---

## 📞 緊急應變計劃

如果發現攻擊：

1. **立即啟用所有安全措施**
2. **檢查日誌找出攻擊來源**
3. **封鎖惡意 IP**
4. **更改所有密碼和秘鑰**
5. **通知相關人員**

---

## 🎯 結論

### 當前狀態：**不適合部署到生產環境**

**主要問題：**
- ❌ 無 Rate Limiting（易受 DDoS 和暴力破解）
- ❌ 無安全標頭（易受 XSS 攻擊）
- ❌ 登入端點無保護（易受暴力破解）

### 修復後狀態：**可部署，但需持續改進**

**完成以下步驟後可達到 8/10 的安全等級：**
1. ✅ 啟用 Rate Limiting
2. ✅ 啟用登入保護
3. ✅ 啟用 Helmet
4. ✅ 設定環境變數
5. ⚠️ 加強輸入驗證（中期改進）

---

**最後更新：** 2025-12-28  
**下次評估建議：** 完成修復後 1 個月

