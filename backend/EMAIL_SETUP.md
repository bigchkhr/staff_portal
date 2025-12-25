# Email Notification 設置指南

## 概述

系統已整合 email notification 功能，使用 Google OAuth2 發送郵件。當假期申請通過 e-flow 進行時，系統會自動發送通知：

1. **申請創建時**：發送通知給當前批核階段（checker、approver1、approver2、approver3）的批核群組所有成員
2. **批核階段變更時**：發送通知給下一階段批核群組的所有成員
3. **申請完成時**：發送通知給申請者
4. **申請拒絕時**：發送通知給申請者

**注意**：如果被通知者的 email 值為 null，系統會自動跳過發送 email。

## 環境變數配置

在 `backend/.env` 文件中添加以下配置：

### 方法 1：使用 Google OAuth2（推薦）

```env
# Gmail OAuth2 配置
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER_EMAIL=your-email@gmail.com

# 前端 URL（用於 email 中的連結）
FRONTEND_URL=http://localhost:3000
```

### 方法 2：使用 SMTP（備用方案）

如果沒有配置 OAuth2，系統會嘗試使用 SMTP：

```env
# SMTP 配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 前端 URL
FRONTEND_URL=http://localhost:3000
```

## Google OAuth2 設置步驟

### 1. 創建 Google Cloud 項目

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新項目或選擇現有項目
3. 啟用 Gmail API

### 2. 創建 OAuth 2.0 憑證

1. 前往「API 和服務」>「憑證」
2. 點擊「建立憑證」>「OAuth 用戶端 ID」
3. 選擇應用程式類型為「網頁應用程式」
4. 設定授權重新導向 URI：
   - 前往 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
   - 點擊右上角的設定圖示
   - 勾選「Use your own OAuth credentials」
   - 輸入您的 Client ID 和 Client Secret
   - 在左側選擇「Gmail API v1」>「https://mail.google.com/」
   - 點擊「Authorize APIs」
   - 完成授權後，點擊「Exchange authorization code for tokens」
   - 複製「Refresh token」

### 3. 獲取 Refresh Token

1. 前往 [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. 在左側選擇「Gmail API v1」>「https://mail.google.com/」
3. 點擊「Authorize APIs」
4. 登入您的 Google 帳號並授權
5. 點擊「Exchange authorization code for tokens」
6. 複製「Refresh token」並設置到 `.env` 文件

### 4. 設置環境變數

將獲取的資訊填入 `.env` 文件：

```env
GMAIL_CLIENT_ID=從 Google Cloud Console 獲取
GMAIL_CLIENT_SECRET=從 Google Cloud Console 獲取
GMAIL_REFRESH_TOKEN=從 OAuth Playground 獲取
GMAIL_USER_EMAIL=您的 Gmail 地址
```

## 安裝依賴

確保已安裝必要的 npm 套件：

```bash
cd backend
npm install
```

## 測試 Email 功能

系統會在以下情況自動發送 email：

1. **創建 e-flow 申請**：通知當前批核階段的批核群組成員
2. **批核申請**：通知下一階段的批核群組成員（如果還有下一階段）
3. **申請完成**：通知申請者
4. **申請拒絕**：通知申請者

## 注意事項

1. **Email 為 null 的處理**：如果用戶的 email 欄位為 null 或空，系統會自動跳過發送，不會報錯
2. **批量發送**：系統會為批核群組的每個成員單獨發送 email（不使用 BCC）
3. **錯誤處理**：Email 發送失敗不會影響申請或批核流程，只會在控制台記錄錯誤
4. **開發環境**：如果沒有配置 email，系統會繼續運行，但不會發送 email

## 故障排除

### 問題 1：Email 發送失敗

**解決方案**：
- 檢查 `.env` 文件中的配置是否正確
- 確認 Gmail API 已啟用
- 檢查 Refresh Token 是否有效（可能需要重新生成）

### 問題 2：收到「Invalid credentials」錯誤

**解決方案**：
- 確認 Client ID 和 Client Secret 正確
- 檢查 Refresh Token 是否過期（需要重新生成）

### 問題 3：Email 沒有發送

**解決方案**：
- 檢查控制台日誌，查看是否有錯誤訊息
- 確認用戶的 email 欄位不為 null
- 檢查 email service 是否正確初始化

## 相關文件

- Email Service: `backend/utils/emailService.js`
- Leave Controller: `backend/controllers/leave.controller.js`
- Approval Controller: `backend/controllers/approval.controller.js`

