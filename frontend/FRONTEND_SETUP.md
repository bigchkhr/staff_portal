# 前端設置指南

## 問題：在不同機器上運行時出現錯誤

如果在前端應用在第二部機器上運行 `npm start` 時出現錯誤，通常是因為後端 API 地址配置問題。

## 解決方案

### 方法 1：使用環境變數（推薦）

1. **創建 `.env` 文件**

   在 `frontend` 文件夾中創建 `.env` 文件：

   ```env
   REACT_APP_API_BASE_URL=http://your-backend-ip:8080
   ```

   例如：
   - 如果後端在第一台機器（IP: 192.168.3.4）：
     ```env
     REACT_APP_API_BASE_URL=http://192.168.3.4:8080
     ```
   
   - 如果後端在第二台機器（IP: 192.168.3.5）：
     ```env
     REACT_APP_API_BASE_URL=http://192.168.3.5:8080
     ```
   
   - 如果後端在同一台機器：
     ```env
     REACT_APP_API_BASE_URL=http://localhost:8080
     ```

2. **重啟開發服務器**

   ```bash
   npm start
   ```

### 方法 2：使用 package.json 的 proxy（僅限開發環境）

如果前端和後端在同一台機器上，或者使用相對路徑，可以配置 `package.json` 的 `proxy`：

```json
{
  "proxy": "http://localhost:8080"
}
```

**注意**：這種方法只適用於開發環境，且需要前後端在同一台機器或同一網絡。

## 配置說明

- **`REACT_APP_API_BASE_URL`**：後端 API 的完整 URL
  - 如果設置了，所有 API 請求會使用這個 URL
  - 如果沒有設置，會使用相對路徑（依賴 proxy 配置）

## 檢查配置

1. 確認後端服務器正在運行
2. 確認後端服務器的 IP 地址和端口
3. 確認防火牆允許訪問後端端口（8080）
4. 在瀏覽器中測試後端 URL 是否可訪問：
   ```
   http://your-backend-ip:8080/api/auth/login
   ```

## 常見錯誤

### 錯誤 1：Network Error / CORS Error

**原因**：前端無法連接到後端服務器

**解決方案**：
- 檢查 `REACT_APP_API_BASE_URL` 是否正確
- 確認後端服務器正在運行
- 檢查網絡連接和防火牆設置

### 錯誤 2：404 Not Found

**原因**：後端 URL 配置錯誤

**解決方案**：
- 檢查 `REACT_APP_API_BASE_URL` 是否包含正確的端口號
- 確認後端路由是否正確

### 錯誤 3：Connection Refused

**原因**：後端服務器未啟動或端口被占用

**解決方案**：
- 啟動後端服務器
- 檢查端口是否被其他程序占用

## 生產環境配置

在生產環境中，建議：

1. 使用環境變數配置不同的 API URL
2. 使用反向代理（如 Nginx）來處理 API 請求
3. 確保 CORS 配置正確

## 相關文件

- Axios 配置：`frontend/src/utils/axiosConfig.js`
- 環境變數示例：`frontend/.env.example`


