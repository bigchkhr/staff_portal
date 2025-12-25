// 快速檢查資料庫連接和數據
require('dotenv').config();
const User = require('./database/models/User');

async function checkDatabase() {
  try {
    // console.log('=== 檢查資料庫連接和數據 ===\n');
    
    // console.log('1. 測試查找 ADMIN001 (大寫)...');
    const user1 = await User.findByEmployeeNumber('ADMIN001');
    if (user1) {
      // console.log('✅ 找到用戶:', user1.employee_number, '-', user1.name_zh);
      // console.log('   啟用狀態:', user1.is_active);
      // console.log('   系統管理員:', user1.is_system_admin);
    } else {
      // console.log('❌ 找不到用戶');
    }
    
    // console.log('\n2. 測試查找 admin001 (小寫)...');
    const user2 = await User.findByEmployeeNumber('admin001');
    if (user2) {
      // console.log('✅ 找到用戶:', user2.employee_number, '-', user2.name_zh);
      // console.log('   啟用狀態:', user2.is_active);
      // console.log('   系統管理員:', user2.is_system_admin);
    } else {
      // console.log('❌ 找不到用戶');
    }
    
    // console.log('\n3. 測試查找 Admin001 (混合)...');
    const user3 = await User.findByEmployeeNumber('Admin001');
    if (user3) {
      // console.log('✅ 找到用戶:', user3.employee_number, '-', user3.name_zh);
    } else {
      // console.log('❌ 找不到用戶');
    }
    
    if (!user1 && !user2 && !user3) {
      console.log('\n❌ 資料庫中沒有找到 ADMIN001 用戶！');
      console.log('\n請運行以下命令初始化資料庫：');
      console.log('  cd backend');
      console.log('  npm run migrate');
      console.log('  npm run seed');
    } else {
      console.log('\n✅ 資料庫連接正常，用戶數據存在');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 檢查時發生錯誤:', error);
    console.error('\n可能的原因：');
    console.error('1. 資料庫連接失敗 - 請檢查 .env 文件中的資料庫設置');
    console.error('2. 資料表不存在 - 請運行: npm run migrate');
    console.error('3. 沒有初始數據 - 請運行: npm run seed');
    process.exit(1);
  }
}

checkDatabase();

