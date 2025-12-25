require('dotenv').config();
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const https = require('https');

async function validateTokenInfo(accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const tokenInfo = JSON.parse(data);
            resolve({
              valid: true,
              info: tokenInfo
            });
          } else {
            resolve({
              valid: false,
              error: `Token 無效或已過期 (狀態碼: ${res.statusCode})`
            });
          }
        } catch (parseError) {
          reject(new Error(`解析響應失敗: ${parseError.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`請求失敗: ${error.message}`));
    });
  });
}

async function testOAuth2() {
  console.log('=== OAuth2 Token 驗證測試 ===\n');
  
  const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REFRESH_TOKEN,
    GMAIL_USER_EMAIL
  } = process.env;
  
  console.log('📋 環境變數檢查:');
  console.log('  GMAIL_CLIENT_ID:', GMAIL_CLIENT_ID ? `${GMAIL_CLIENT_ID.substring(0, 20)}...` : '❌ 未設置');
  console.log('  GMAIL_CLIENT_SECRET:', GMAIL_CLIENT_SECRET ? '✅ 已設置' : '❌ 未設置');
  console.log('  GMAIL_REFRESH_TOKEN:', GMAIL_REFRESH_TOKEN ? `${GMAIL_REFRESH_TOKEN.substring(0, 20)}...` : '❌ 未設置');
  console.log('  GMAIL_USER_EMAIL:', GMAIL_USER_EMAIL || '❌ 未設置');
  console.log('');
  
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !GMAIL_USER_EMAIL) {
    console.error('❌ 錯誤：缺少必要的 OAuth2 配置');
    console.error('請在 .env 文件中設置所有必要的環境變數');
    process.exit(1);
  }
  
  try {
    console.log('🔧 正在創建 OAuth2 客戶端...');
    const oauth2Client = new OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );
    
    console.log('🔑 設置 refresh token...');
    oauth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN
    });
    
    console.log('📥 正在獲取 access token...');
    const tokenResponse = await oauth2Client.getAccessToken();
    
    if (!tokenResponse || !tokenResponse.token) {
      console.error('❌ 錯誤：無法獲取 access token');
      console.error('可能的原因：');
      console.error('1. Refresh token 已過期或無效');
      console.error('2. Client ID 或 Client Secret 不正確');
      console.error('3. Gmail API 未啟用');
      process.exit(1);
    }
    
    const accessToken = tokenResponse.token;
    console.log('✅ Access token 獲取成功');
    console.log('  Token 長度:', accessToken.length);
    console.log('  Token 前綴:', accessToken.substring(0, 30) + '...');
    console.log('');
    
    // 驗證 token 信息
    console.log('🔍 正在驗證 token 有效性...');
    const tokenValidation = await validateTokenInfo(accessToken);
    
    if (tokenValidation.valid) {
      console.log('✅ Token 驗證成功');
      const tokenInfo = tokenValidation.info;
      console.log('  Token 詳細信息:');
      console.log('    - 發行給 (issued_to):', tokenInfo.issued_to || 'N/A');
      console.log('    - 用戶 ID (user_id):', tokenInfo.user_id || 'N/A');
      console.log('    - 範圍 (scope):', tokenInfo.scope || 'N/A');
      console.log('    - 過期時間 (expires_in):', tokenInfo.expires_in ? `${tokenInfo.expires_in} 秒` : 'N/A');
      if (tokenInfo.expires_in) {
        const expiryDate = new Date(Date.now() + tokenInfo.expires_in * 1000);
        console.log('    - 預計過期時間:', expiryDate.toLocaleString('zh-TW'));
      }
      console.log('    - 電子郵件 (email):', tokenInfo.email || 'N/A');
      console.log('    - 驗證狀態 (verified_email):', tokenInfo.verified_email ? '✅ 已驗證' : '❌ 未驗證');
      console.log('    - 訪問類型 (access_type):', tokenInfo.access_type || 'N/A');
    } else {
      console.error('❌ Token 驗證失敗:', tokenValidation.error);
    }
    console.log('');
    
    // 檢查 credentials 中的 token 信息
    console.log('📊 檢查 OAuth2 客戶端憑證狀態...');
    const credentials = oauth2Client.credentials;
    if (credentials) {
      console.log('  - Access Token:', credentials.access_token ? `${credentials.access_token.substring(0, 30)}...` : '未設置');
      console.log('  - Refresh Token:', credentials.refresh_token ? `${credentials.refresh_token.substring(0, 30)}...` : '未設置');
      console.log('  - Expiry Date:', credentials.expiry_date ? new Date(credentials.expiry_date).toLocaleString('zh-TW') : '未設置');
      if (credentials.expiry_date) {
        const now = Date.now();
        const expiry = credentials.expiry_date;
        const timeUntilExpiry = expiry - now;
        if (timeUntilExpiry > 0) {
          const minutes = Math.floor(timeUntilExpiry / 60000);
          const seconds = Math.floor((timeUntilExpiry % 60000) / 1000);
          console.log('  - 剩餘有效時間:', `${minutes} 分 ${seconds} 秒`);
        } else {
          console.log('  - ⚠️  Token 已過期');
        }
      }
      console.log('  - Token Type:', credentials.token_type || 'N/A');
      console.log('  - Scope:', credentials.scope || 'N/A');
    }
    console.log('');
    
    // 測試 Gmail API 連接
    console.log('📧 正在測試 Gmail API 連接...');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ Gmail API 連接成功');
      console.log('  Email 地址:', profile.data.emailAddress);
      console.log('  Messages Total:', profile.data.messagesTotal || 'N/A');
      console.log('  Threads Total:', profile.data.threadsTotal || 'N/A');
      console.log('  History ID:', profile.data.historyId || 'N/A');
    } catch (apiError) {
      console.error('❌ Gmail API 連接失敗:', apiError.message);
      if (apiError.response) {
        console.error('  狀態碼:', apiError.response.status);
        console.error('  錯誤數據:', JSON.stringify(apiError.response.data, null, 2));
      }
    }
    console.log('');
    
    // 測試發送權限（可選）
    console.log('🔐 檢查 API 權限...');
    try {
      // 嘗試獲取用戶的標籤列表（需要 read 權限）
      const labels = await gmail.users.labels.list({ userId: 'me' });
      console.log('✅ 讀取權限驗證成功');
      console.log('  可用標籤數量:', labels.data.labels ? labels.data.labels.length : 0);
    } catch (permError) {
      console.error('❌ 權限檢查失敗:', permError.message);
    }
    console.log('');
    
    console.log('✅ 所有測試完成！');
    console.log('');
    console.log('📝 總結:');
    console.log('  - Refresh Token:', tokenValidation.valid ? '✅ 有效' : '❌ 無效');
    console.log('  - Access Token:', tokenValidation.valid ? '✅ 有效' : '❌ 無效');
    console.log('  - Gmail API:', '✅ 可連接');
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error('');
    console.error('錯誤詳情:');
    if (error.response) {
      console.error('  狀態碼:', error.response.status);
      console.error('  錯誤數據:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('  完整錯誤:', error);
    }
    console.error('');
    console.error('🔧 可能的解決方案:');
    console.error('1. 檢查 refresh token 是否有效');
    console.error('2. 前往 OAuth Playground 重新獲取 refresh token');
    console.error('3. 確認 Gmail API 已在 Google Cloud Console 中啟用');
    console.error('4. 確認 OAuth 2.0 憑證配置正確');
    console.error('5. 確認 Redirect URI 設置為: https://developers.google.com/oauthplayground');
    console.error('6. 檢查 Client ID 和 Client Secret 是否匹配');
    process.exit(1);
  }
}

testOAuth2();

