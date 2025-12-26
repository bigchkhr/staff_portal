# AWS S3 和 CloudFront 設定指南

## 概述

本指南說明如何設置 AWS S3 和 CloudFront 並與後端 API 整合。

## 後端 CORS 配置

後端已經配置了 CORS 支持，允許從以下來源訪問：

1. **本地開發環境**（預設）：
   - `http://localhost:3000`
   - `http://localhost:3001`
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:3001`

2. **通過環境變數配置的來源**：
   - `ALLOWED_ORIGINS` - 用逗號分隔多個 URL
   - `CLOUDFRONT_URL` - CloudFront 分發 URL
   - `FRONTEND_URL` - 前端應用 URL

## 環境變數設置

在 `backend/.env` 文件中添加以下配置：

```env
# CORS Configuration
# 允許的來源（用逗號分隔多個 URL）
# 開發環境範例:
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# 生產環境範例（多個域名）:
# ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://app.yourdomain.com

# AWS CloudFront URL
# CloudFront 分發的 URL，例如:
# CLOUDFRONT_URL=https://d1234567890.cloudfront.net
# 或自定義域名:
# CLOUDFRONT_URL=https://cdn.yourdomain.com
CLOUDFRONT_URL=

# 前端應用 URL（用於電子郵件連結等）
FRONTEND_URL=http://localhost:3000
```

## AWS S3 設置步驟

### 1. 創建 S3 儲存桶

1. 登入 AWS Console
2. 前往 S3 服務
3. 創建新儲存桶：
   - **儲存桶名稱**：例如 `leave-admin-documents`
   - **區域**：選擇最接近的區域（例如：`ap-east-1` 香港）
   - **阻擋所有公開存取**：根據需求設置
   - **啟用版本控制**（可選）：建議啟用以追蹤文件變更

### 2. 配置儲存桶 CORS

在 S3 儲存桶設置中，添加以下 CORS 配置：

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://yourdomain.com",
            "https://*.cloudfront.net"
        ],
        "ExposeHeaders": [
            "ETag",
            "Content-Length"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**重要**：將 `AllowedOrigins` 中的 URL 替換為你的實際域名和 CloudFront URL。

### 3. 設置儲存桶政策（如果需要公開存取）

如果需要公開讀取文件，添加以下儲存桶政策：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## AWS CloudFront 設置步驟

### 1. 創建 CloudFront 分發

1. 前往 AWS CloudFront 服務
2. 點擊「創建分發」
3. 配置設置：

   **原始設定**：
   - **原始網域**：選擇你的 S3 儲存桶
   - **原始路徑**：留空（或設置特定路徑）
   - **名稱**：自動生成

   **預設快取行為**：
   - **檢視器協定原則**：選擇「將 HTTP 重新導向到 HTTPS」
   - **允許的 HTTP 方法**：`GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`
   - **快取原則**：根據需求選擇（建議使用「CachingOptimized」）

   **分發設定**：
   - **價格類別**：選擇適合的價格類別
   - **備用域名 (CNAME)**（可選）：例如 `cdn.yourdomain.com`
   - **SSL 憑證**：如果使用 CNAME，選擇對應的 SSL 憑證

### 2. 配置 CloudFront CORS 標頭

在 CloudFront 分發的「行為」設置中：

1. 編輯預設行為
2. 在「回應標頭原則」中：
   - 創建新的回應標頭原則
   - 添加以下 CORS 標頭：
     - `Access-Control-Allow-Origin`: `*` 或特定域名
     - `Access-Control-Allow-Methods`: `GET, POST, PUT, DELETE, OPTIONS`
     - `Access-Control-Allow-Headers`: `Content-Type, Authorization`
     - `Access-Control-Max-Age`: `3600`

### 3. 獲取 CloudFront URL

創建分發後，你會獲得一個 CloudFront URL，格式如下：
```
https://d1234567890.cloudfront.net
```

將此 URL 添加到 `backend/.env` 文件中的 `CLOUDFRONT_URL`。

## 後端整合

### 更新後端代碼以使用 S3

如果你計劃將文件上傳到 S3 而不是本地儲存，需要：

1. 安裝 AWS SDK：
```bash
npm install aws-sdk
```

2. 在 `.env` 中添加 AWS 憑證：
```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-east-1
AWS_S3_BUCKET_NAME=leave-admin-documents
```

3. 更新文件上傳中間件以使用 S3（需要修改 `middleware/upload.js` 和相關控制器）

## 測試 CORS 配置

### 1. 檢查後端 CORS 設置

啟動後端服務器後，你應該看到類似以下的輸出：

```
=== CORS Configuration ===
允許的來源: [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://d1234567890.cloudfront.net'
]
CloudFront URL: https://d1234567890.cloudfront.net
==========================
```

### 2. 測試 API 請求

使用瀏覽器開發者工具或 Postman 測試 API 請求，確認：

- ✅ 請求成功（沒有 CORS 錯誤）
- ✅ 回應標頭包含 `Access-Control-Allow-Origin`
- ✅ 如果需要，`Access-Control-Allow-Credentials` 設置為 `true`

### 3. 常見 CORS 錯誤解決

**錯誤**：`Access to fetch at '...' from origin '...' has been blocked by CORS policy`

**解決方案**：
1. 確認請求的來源 URL 在 `ALLOWED_ORIGINS` 或 `CLOUDFRONT_URL` 中
2. 檢查 `.env` 文件是否正確設置
3. 重啟後端服務器
4. 確認 CloudFront 分發已部署完成（可能需要幾分鐘）

## 安全建議

1. **生產環境**：
   - 不要使用 `*` 作為 `Access-Control-Allow-Origin`
   - 明確指定允許的域名
   - 使用 HTTPS

2. **憑證管理**：
   - 不要在代碼中硬編碼 AWS 憑證
   - 使用 IAM 角色（在 EC2/ECS 上）或環境變數
   - 定期輪換憑證

3. **S3 儲存桶**：
   - 限制公開存取
   - 使用 IAM 政策控制存取權限
   - 啟用日誌記錄和監控

## 相關文件

- [AWS S3 文檔](https://docs.aws.amazon.com/s3/)
- [AWS CloudFront 文檔](https://docs.aws.amazon.com/cloudfront/)
- [CORS 配置說明](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

