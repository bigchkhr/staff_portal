# CloudFront API Gateway 設置指南

## 概述

本指南說明如何在**現有的 CloudFront 分發**中添加 API Gateway 功能，將 HTTPS 請求轉發到後端的 HTTP 服務。

**重要**：如果你已經有一個 CloudFront 分發指向 S3（用於前端），不需要創建新的分發，只需要在現有分發中添加 API Origin。

這樣可以：
- ✅ 後端不需要配置 HTTPS
- ✅ 前端可以通過 HTTPS 訪問 API
- ✅ 解決瀏覽器混合內容阻止問題
- ✅ 使用同一個 CloudFront URL 服務前端和 API

## 快速總結

**核心概念**：
1. 在現有的 CloudFront 分發中添加一個新的 Origin，指向後端 EC2 (`3.1.139.29:1689`)
2. 創建一個新的快取行為，將 `/api/*` 路徑路由到這個新的 Origin
3. 配置 CORS 回應標頭政策
4. 前端和 API 現在都使用同一個 CloudFront URL

**配置要點**：
- Origin: `3.1.139.29:1689` (HTTP Only)
- Path pattern: `/api/*`
- Cache policy: `CachingDisabled` (API 不應快取)
- 行為優先級：API 行為優先級要高於 S3 行為

## 架構說明

```
前端 (HTTPS) → CloudFront (HTTPS) → S3 (前端靜態文件)
           → CloudFront (HTTPS) → EC2 (HTTP:1689) (API)
```

## 步驟 1：編輯現有的 CloudFront 分發

1. 登入 AWS Console
2. 前往 **CloudFront** 服務
3. 找到你現有的 CloudFront 分發（origin 指向 S3 的那個）
4. 點擊分發 ID 進入詳細設置
5. 點擊 **「Origins」** 標籤
6. 點擊 **「Create origin」** 添加新的 Origin

## 步驟 2：添加 API Origin（後端 EC2）

### Origin 設置

- **Origin domain**：選擇 **「自訂 Origin」**，輸入：
  ```
  3.1.139.29:1689
  ```
  或使用 EC2 的域名（如果有）

- **Origin path**：留空（因為後端 API 路徑是 `/api/...`）

- **Origin ID**：自訂一個名稱（例如：`api-backend-ec2`）

- **Origin protocol policy**：選擇 **「HTTP Only」**（因為後端只使用 HTTP）

- **Origin SSL protocols**：選擇 **「TLSv1.2」**（雖然使用 HTTP，但這裡可以設置）

### Origin 自訂標頭（可選）

如果需要，可以添加自訂標頭：
- `Host`: `3.1.139.29:1689`

## 步驟 3：創建 API 專用的快取行為

現在需要創建一個新的快取行為，將 `/api/*` 路徑的請求路由到後端 EC2。

1. 在 CloudFront 分發設置中，點擊 **「Behaviors」** 標籤
2. 點擊 **「Create behavior」**

### 快取行為設置

- **Path pattern**：`/api/*`（匹配所有 `/api/` 開頭的路徑）

- **Origin and origin groups**：選擇剛才創建的 API Origin（例如：`api-backend-ec2`）

- **Viewer protocol policy**：選擇 **「Redirect HTTP to HTTPS」** 或 **「HTTPS Only」**
  - 這確保前端只能通過 HTTPS 訪問

- **Allowed HTTP methods**：選擇 **「GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE」**
  - 這很重要，因為 API 需要支援所有 HTTP 方法

- **Cache policy**：選擇 **「CachingDisabled」**
  - 對於 API，必須使用 **「CachingDisabled」** 以避免快取問題
  - API 請求不應該被快取

- **Origin request policy**：選擇 **「AllViewer」**
  - 確保所有請求標頭都轉發到後端

- **Response headers policy**：選擇或創建包含 CORS 標頭的政策（見下方）

### 重要：行為優先級

確保 API 行為的優先級**高於**默認行為（S3）：
- API 行為（`/api/*`）應該有**較小的優先級數字**（例如：0）
- S3 行為（`*`）應該有**較大的優先級數字**（例如：1）

這樣 `/api/*` 的請求會先匹配到 API 行為，其他請求才會匹配到 S3 行為。

### 回應標頭政策（CORS）

如果需要處理 CORS，創建或選擇回應標頭政策：

1. 前往 **CloudFront** → **Policies** → **Response headers**
2. 創建新政策或編輯現有政策
3. 添加以下 CORS 標頭：
   - `Access-Control-Allow-Origin`: `*` 或特定域名（如 `https://d1plg781uxznov.cloudfront.net`）
   - `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, PATCH, OPTIONS`
   - `Access-Control-Allow-Headers`: `Content-Type, Authorization, X-Requested-With`
   - `Access-Control-Allow-Credentials`: `true`（如果需要）
   - `Access-Control-Max-Age`: `3600`

## 步驟 4：配置回應標頭政策（CORS）

為了處理 CORS，需要創建或選擇回應標頭政策：

1. 前往 **CloudFront** → **Policies** → **Response headers**
2. 點擊 **「Create response headers policy」**
3. 設置政策名稱（例如：`api-cors-policy`）
4. 在 **「CORS」** 部分：
   - 啟用 **「CORS」**
   - **Access-Control-Allow-Origin**：
     - 選擇 **「Specify origins」**
     - 添加你的前端 CloudFront URL（例如：`https://d1plg781uxznov.cloudfront.net`）
     - 或使用 `*`（不推薦，但可以測試）
   - **Access-Control-Allow-Methods**：選擇 `GET, POST, PUT, DELETE, PATCH, OPTIONS`
   - **Access-Control-Allow-Headers**：添加 `Content-Type, Authorization, X-Requested-With`
   - **Access-Control-Allow-Credentials**：選擇 `true`（如果需要）
   - **Access-Control-Max-Age**：設置 `3600`

5. 點擊 **「Create」** 創建政策

6. 在 API 快取行為中，選擇這個回應標頭政策

## 步驟 5：保存並部署

1. 點擊 **「Create behavior」** 創建 API 行為
2. CloudFront 會自動開始部署更新
3. 等待部署完成（通常需要 5-15 分鐘）

## 步驟 6：使用現有的 CloudFront URL

你不需要新的 URL，使用**現有的 CloudFront URL**（指向 S3 的那個）即可：

```
https://d1plg781uxznov.cloudfront.net
```

現在這個 URL 可以同時服務：
- 前端靜態文件（從 S3）
- API 請求（從 EC2，路徑 `/api/*`）

## 步驟 7：更新前端配置

由於前端和 API 現在使用同一個 CloudFront URL，有兩種配置方式：

### 方法 1：使用相對路徑（推薦）

前端不需要設置完整的 API URL，使用相對路徑即可：

在 `frontend/src/App.js` 中，將 API base URL 設置為空字符串或相對路徑：

```javascript
// 如果前端和 API 在同一個 CloudFront URL 下，使用相對路徑
axios.defaults.baseURL = ''; // 或 '/api'
```

這樣所有 API 請求會自動使用當前域名（CloudFront URL）。

### 方法 2：使用環境變數（明確指定）

如果你想明確指定 API URL，在 `frontend/.env` 文件中設置：

```env
REACT_APP_API_BASE_URL=https://d1plg781uxznov.cloudfront.net
```

### 方法 3：構建時設置

```bash
cd frontend
REACT_APP_API_BASE_URL=https://d1plg781uxznov.cloudfront.net yarn build
```

**注意**：如果使用相對路徑，確保 axios 的 baseURL 設置正確。當前代碼已經支持環境變數，所以只需要設置 `REACT_APP_API_BASE_URL` 為你的 CloudFront URL 即可。

## 步驟 8：測試配置

### 1. 測試前端靜態文件

在瀏覽器中訪問你的 CloudFront URL：
```
https://d1plg781uxznov.cloudfront.net
```

應該正常顯示前端應用。

### 2. 測試 API 健康檢查

在瀏覽器中訪問：
```
https://d1plg781uxznov.cloudfront.net/api/health
```

應該返回後端的健康檢查回應（JSON 格式）。

### 3. 測試 API 請求

使用瀏覽器開發者工具（Console）測試登入請求：
```javascript
fetch('https://d1plg781uxznov.cloudfront.net/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    employee_number: 'test',
    password: 'test'
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

### 4. 檢查 CORS

在瀏覽器開發者工具的 Network 標籤中，檢查 API 請求的回應標頭，應該包含：
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

### 5. 測試前端應用

訪問前端應用並嘗試登入，應該可以正常連接到 API。

## 步驟 9：更新後端 CORS 配置（可選）

**注意**：後端已經配置為允許所有來源（`origin: true`），所以這一步是可選的。

如果你想明確指定允許的來源，可以在 `backend/.env` 文件中設置：

```env
# 添加 CloudFront URL 到允許的來源（可選）
CLOUDFRONT_URL=https://d1plg781uxznov.cloudfront.net
FRONTEND_URL=https://d1plg781uxznov.cloudfront.net
```

但由於後端已經允許所有來源，這不是必需的。

## 常見問題

### 問題 1：502 Bad Gateway

**原因**：
- 後端服務未運行
- EC2 安全組未開放 1689 端口
- Origin 配置錯誤

**解決方案**：
1. 檢查後端服務是否運行：`curl http://3.1.139.29:1689/api/health`
2. 檢查 EC2 安全組，確保端口 1689 對 CloudFront 開放
3. 檢查 CloudFront Origin 配置

### 問題 2：CORS 錯誤

**原因**：
- CloudFront 回應標頭政策未配置或配置錯誤
- 前端和 API 的 CloudFront URL 不一致

**解決方案**：
1. 檢查 CloudFront 回應標頭政策是否正確配置
2. 確認 `Access-Control-Allow-Origin` 包含前端的 CloudFront URL
3. 確認前端和 API 使用同一個 CloudFront URL（推薦）或正確配置 CORS
4. 後端已經允許所有來源，所以後端 CORS 應該不是問題

### 問題 3：請求被快取

**原因**：
- CloudFront 快取政策設置不當

**解決方案**：
1. 使用 **「CachingDisabled」** 快取政策
2. 或創建自訂快取政策，只快取 GET 請求，不快取 POST/PUT/DELETE

### 問題 4：OPTIONS 請求失敗

**原因**：
- CloudFront 未正確處理 OPTIONS 請求

**解決方案**：
1. 確保 **「Allowed HTTP methods」** 包含 OPTIONS
2. 在回應標頭政策中添加 CORS 標頭

## 安全建議

1. **限制來源**：
   - 在 CloudFront 回應標頭政策中，不要使用 `*` 作為 `Access-Control-Allow-Origin`
   - 明確指定允許的前端域名

2. **WAF（Web Application Firewall）**：
   - 考慮在 CloudFront 前添加 AWS WAF
   - 可以過濾惡意請求

3. **監控**：
   - 啟用 CloudFront 日誌記錄
   - 設置 CloudWatch 警報

4. **速率限制**：
   - 在 CloudFront 或後端設置速率限制
   - 防止 API 濫用

## 成本估算

CloudFront 按使用量收費：
- **數據傳輸**：根據傳輸量收費
- **請求**：根據請求數量收費
- **價格類別**：選擇較低的價格類別可以降低成本

對於 API Gateway 使用場景，成本通常較低，因為：
- API 回應通常較小
- 可以禁用快取以減少成本

## 相關文件

- [AWS CloudFront 文檔](https://docs.aws.amazon.com/cloudfront/)
- [CloudFront 作為 API Gateway](https://aws.amazon.com/blogs/networking-and-content-delivery/using-amazon-cloudfront-to-accelerate-and-secure-your-api/)
- [CORS 配置說明](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

