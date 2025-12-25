// 測試腳本：檢查登入功能
const User = require('./database/models/User');
const { comparePassword } = require('./utils/password');

async function testLogin() {
  try {
    console.log('=== 開始測試登入功能 ===\n');
    
    // 測試 1: 檢查資料庫中是否有用戶
    console.log('1. 檢查資料庫中的用戶...');
    const adminUser = await User.findByEmployeeNumber('ADMIN001');
    const adminUserLower = await User.findByEmployeeNumber('admin001');
    
    if (!adminUser && !adminUserLower) {
      console.log('❌ 找不到 ADMIN001 用戶');
      console.log('請確認已運行: npm run migrate 和 npm run seed');
      return;
    }
    
    const user = adminUser || adminUserLower;
    console.log('✅ 找到用戶:', user.employee_number);
    console.log('   姓名:', user.name_zh);
    console.log('   啟用狀態:', user.is_active);
    console.log('   是否為系統管理員:', user.is_system_admin);
    console.log('');
    
    // 測試 2: 檢查密碼
    console.log('2. 測試密碼驗證...');
    const testPassword = 'admin123';
    const isValid = await comparePassword(testPassword, user.password_hash);
    
    if (isValid) {
      console.log('✅ 密碼驗證成功');
    } else {
      console.log('❌ 密碼驗證失敗');
      console.log('   請確認密碼是否為: admin123');
    }
    console.log('');
    
    // 測試 3: 測試不同大小寫的員工編號
    console.log('3. 測試不同大小寫的員工編號...');
    const testNumbers = ['ADMIN001', 'admin001', 'Admin001', 'ADMIN001'];
    for (const empNum of testNumbers) {
      const foundUser = await User.findByEmployeeNumber(empNum);
      if (foundUser) {
        console.log(`✅ ${empNum} -> 找到用戶`);
      } else {
        console.log(`❌ ${empNum} -> 找不到用戶`);
      }
    }
    
    console.log('\n=== 測試完成 ===');
  } catch (error) {
    console.error('測試時發生錯誤:', error);
  }
  
  process.exit(0);
}

testLogin();

