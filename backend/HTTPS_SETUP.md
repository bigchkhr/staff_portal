# 後端 HTTPS 配置指南

## 問題

當前前端通過 HTTPS (CloudFront) 訪問，但後端 API 使用 HTTP，導致瀏覽器阻止混合內容請求。

## 解決方案：配置 Nginx 反向代理 + SSL

### 步驟 1：配置 Nginx 處理後端 API 的 HTTPS 請求

編輯 Nginx 配置文件：

```bash
sudo vi /etc/nginx/sites-available/default
```

或創建新的配置文件：

```bash
sudo vi /etc/nginx/sites-available/api-backend
```

### 步驟 2：添加 Nginx 配置

如果後端有域名（例如：`api.yourdomain.com`），使用以下配置：

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;  # 替換為你的域名
    
    # SSL 證書配置（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # API 代理配置
    location /api {
        proxy_pass http://localhost:1689;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 健康檢查
    location /api/health {
        proxy_pass http://localhost:1689/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 步驟 3：創建 SSL 證書（如果還沒有）

```bash
# 安裝 certbot
sudo apt-get install python3-certbot-nginx

# 為域名創建證書
sudo certbot --nginx -d api.yourdomain.com

# 或為 IP 地址創建證書（不推薦，但可以嘗試）
# 注意：IP 地址的 SSL 證書需要特殊配置
```

### 步驟 4：啟用配置並重啟 Nginx

```bash
# 如果創建了新配置文件，創建符號連結
sudo ln -s /etc/nginx/sites-available/api-backend /etc/nginx/sites-enabled/

# 測試配置
sudo nginx -t

# 重啟 Nginx
sudo systemctl restart nginx
```

### 步驟 5：更新前端配置

在 `frontend/.env` 文件中設置：

```env
REACT_APP_API_BASE_URL=https://api.yourdomain.com
```

或在構建時設置：

```bash
REACT_APP_API_BASE_URL=https://api.yourdomain.com yarn build
```

## 如果沒有域名（僅有 IP 地址）

如果只有 IP 地址，有幾個選項：

### 選項 1：使用自簽名證書（僅用於測試，瀏覽器會顯示警告）

```bash
# 生成自簽名證書
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx-selfsigned.key \
  -out /etc/nginx/ssl/nginx-selfsigned.crt

# 在 Nginx 配置中使用
ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
```

### 選項 2：使用 CloudFlare 或其他 CDN 的 SSL

如果前端使用 CloudFront，可以考慮：
- 在 CloudFront 中配置 Origin 為後端 IP
- 使用 CloudFront 的 SSL 終止
- 後端仍然使用 HTTP，但通過 CloudFront 提供 HTTPS

### 選項 3：申請免費域名

- 使用 Freenom 或其他免費域名服務
- 或使用 AWS Route 53 創建子域名

## 驗證配置

1. 測試 HTTPS 連接：
```bash
curl https://api.yourdomain.com/api/health
```

2. 檢查 SSL 證書：
```bash
openssl s_client -connect api.yourdomain.com:443
```

3. 在前端瀏覽器控制台檢查 API Base URL 是否正確

## 常見問題

### 問題 1：證書錯誤
- 確保域名 DNS 記錄正確指向服務器 IP
- 檢查證書是否過期：`sudo certbot certificates`

### 問題 2：502 Bad Gateway
- 檢查後端服務是否運行：`sudo systemctl status your-backend-service`
- 檢查後端監聽端口：`netstat -tlnp | grep 1689`

### 問題 3：CORS 錯誤
- 確保後端 CORS 配置允許前端域名
- 檢查後端 `server.js` 中的 CORS 設置

## 安全建議

1. **生產環境**：
   - 使用有效的 SSL 證書（Let's Encrypt 免費）
   - 啟用 HSTS（HTTP Strict Transport Security）
   - 定期更新證書（certbot 會自動處理）

2. **防火牆**：
   - 只開放必要的端口（443, 80）
   - 限制後端端口（1689）只允許本地訪問

3. **監控**：
   - 設置證書過期提醒
   - 監控 API 響應時間和錯誤率

