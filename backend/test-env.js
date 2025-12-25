// 測試環境變數是否正確加載
require('dotenv').config();

console.log('=== 環境變數檢查 ===\n');

console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ 已設置' : '❌ 未設置');
if (process.env.JWT_SECRET) {
  console.log('JWT_SECRET 長度:', process.env.JWT_SECRET.length);
}

console.log('\nPORT:', process.env.PORT || '使用預設值 8080');
console.log('DB_HOST:', process.env.DB_HOST || '未設置');
console.log('DB_NAME:', process.env.DB_NAME || '未設置');

console.log('\n=== 測試 JWT 生成 ===\n');

try {
  const jwt = require('jsonwebtoken');
  const { generateToken } = require('./utils/jwt');
  
  if (!process.env.JWT_SECRET) {
    console.log('❌ JWT_SECRET 未設置，無法生成 token');
    console.log('\n請檢查：');
    console.log('1. .env 文件是否存在於 backend 文件夾');
    console.log('2. .env 文件中是否有 JWT_SECRET=... 這一行');
    console.log('3. 文件編碼是否為 UTF-8');
    process.exit(1);
  }
  
  const testToken = generateToken(1);
  console.log('✅ Token 生成成功！');
  console.log('Token 前 50 個字符:', testToken.substring(0, 50) + '...');
  
} catch (error) {
  console.log('❌ Token 生成失敗:');
  console.error(error.message);
  process.exit(1);
}

process.exit(0);

