require('dotenv').config();
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const readline = require('readline');

// 創建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function getRefreshToken() {
  console.log('=== Google OAuth2 Refresh Token 獲取工具 ===\n');
  
  // 檢查現有配置
  const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_USER_EMAIL
  } = process.env;
  
  console.log('📋 當前配置檢查:');
  console.log('  GMAIL_CLIENT_ID:', GMAIL_CLIENT_ID ? `${GMAIL_CLIENT_ID.substring(0, 30)}...` : '❌ 未設置');
  console.log('  GMAIL_CLIENT_SECRET:', GMAIL_CLIENT_SECRET ? '✅ 已設置' : '❌ 未設置');
  console.log('  GMAIL_USER_EMAIL:', GMAIL_USER_EMAIL || '❌ 未設置');
  console.log('');
  
  // 如果缺少必要配置，提示用戶
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.log('⚠️  缺少必要的 OAuth2 配置！');
    console.log('');
    console.log('請先設置以下環境變數在 .env 文件中：');
    console.log('  - GMAIL_CLIENT_ID');
    console.log('  - GMAIL_CLIENT_SECRET');
    console.log('  - GMAIL_USER_EMAIL');
    console.log('');
    console.log('如果還沒有這些憑證，請按照以下步驟：');
    console.log('1. 前往 https://console.cloud.google.com/');
    console.log('2. 創建或選擇項目');
    console.log('3. 啟用 Gmail API');
    console.log('4. 創建 OAuth 2.0 憑證（應用程式類型：網頁應用程式）');
    console.log('5. 設置授權重新導向 URI: https://developers.google.com/oauthplayground');
    console.log('');
    rl.close();
    return;
  }
  
  // 創建 OAuth2 客戶端
  const oauth2Client = new OAuth2(
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground' // 使用 OAuth Playground 作為 redirect URI
  );
  
  // 生成授權 URL
  const scopes = [
    'https://mail.google.com/', // 完整 Gmail 訪問權限
    'https://www.googleapis.com/auth/gmail.send', // 發送郵件
    'https://www.googleapis.com/auth/gmail.compose' // 撰寫郵件
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // 重要：需要 refresh token
    scope: scopes,
    prompt: 'consent' // 強制顯示同意畫面，確保獲取 refresh token
  });
  
  console.log('🔗 請按照以下步驟操作：\n');
  console.log('1. 複製以下 URL 並在瀏覽器中打開：');
  console.log('');
  console.log('   ' + authUrl);
  console.log('');
  console.log('2. 登入您的 Google 帳號（' + (GMAIL_USER_EMAIL || '您的 Gmail 帳號') + '）');
  console.log('3. 授予應用程式權限');
  console.log('4. 完成授權後，您將被重定向到一個頁面');
  console.log('5. 從重定向 URL 中複製授權碼（authorization code）');
  console.log('   URL 格式類似：https://developers.google.com/oauthplayground/?code=YOUR_AUTH_CODE&scope=...');
  console.log('   授權碼是 "code=" 後面的部分');
  console.log('');
  
  // 獲取授權碼
  const authCode = await question('請貼上授權碼 (authorization code): ');
  
  if (!authCode || authCode.trim() === '') {
    console.log('❌ 未提供授權碼，操作已取消');
    rl.close();
    return;
  }
  
  try {
    console.log('');
    console.log('🔄 正在交換授權碼以獲取 tokens...');
    
    // 交換授權碼獲取 tokens
    const { tokens } = await oauth2Client.getToken(authCode.trim());
    
    if (!tokens || !tokens.refresh_token) {
      console.log('⚠️  警告：未獲取到 refresh token');
      console.log('可能的原因：');
      console.log('1. 您之前已經授權過此應用，Google 不會再次提供 refresh token');
      console.log('2. 解決方案：在 Google 帳號設置中撤銷應用權限，然後重新運行此腳本');
      console.log('');
      if (tokens && tokens.access_token) {
        console.log('✅ 已獲取 access token，但沒有 refresh token');
        console.log('Access Token:', tokens.access_token.substring(0, 30) + '...');
      }
    } else {
      console.log('✅ 成功獲取 tokens！');
      console.log('');
      console.log('📝 請將以下內容添加到您的 .env 文件中：');
      console.log('');
      console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('');
      
      // 驗證新獲取的 refresh token
      console.log('🔍 正在驗證新獲取的 refresh token...');
      oauth2Client.setCredentials({
        refresh_token: tokens.refresh_token
      });
      
      try {
        const tokenResponse = await oauth2Client.getAccessToken();
        if (tokenResponse && tokenResponse.token) {
          console.log('✅ Refresh token 驗證成功！');
          console.log('   Access token 已成功獲取，長度:', tokenResponse.token.length);
          console.log('');
          console.log('🎉 設置完成！現在可以使用新的 refresh token 了。');
        } else {
          console.log('⚠️  警告：無法使用 refresh token 獲取 access token');
        }
      } catch (verifyError) {
        console.log('❌ Refresh token 驗證失敗:', verifyError.message);
      }
    }
    
    // 顯示完整的 token 信息（用於調試）
    if (tokens) {
      console.log('');
      console.log('📊 Token 詳細信息：');
      console.log('  - Access Token:', tokens.access_token ? tokens.access_token.substring(0, 30) + '...' : 'N/A');
      console.log('  - Refresh Token:', tokens.refresh_token ? tokens.refresh_token.substring(0, 30) + '...' : 'N/A');
      console.log('  - Expiry Date:', tokens.expiry_date ? new Date(tokens.expiry_date).toLocaleString('zh-TW') : 'N/A');
      console.log('  - Token Type:', tokens.token_type || 'N/A');
      console.log('  - Scope:', tokens.scope || 'N/A');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ 錯誤:', error.message);
    if (error.response) {
      console.error('  狀態碼:', error.response.status);
      console.error('  錯誤詳情:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('');
    console.error('可能的解決方案:');
    console.error('1. 檢查授權碼是否正確（確保完整複製，沒有多餘空格）');
    console.error('2. 確認授權碼未過期（授權碼通常只有幾分鐘有效期）');
    console.error('3. 確認 Client ID 和 Client Secret 正確');
    console.error('4. 確認 Redirect URI 設置為: https://developers.google.com/oauthplayground');
  }
  
  rl.close();
}

// 運行腳本
getRefreshToken().catch((error) => {
  console.error('發生未預期的錯誤:', error);
  rl.close();
  process.exit(1);
});

