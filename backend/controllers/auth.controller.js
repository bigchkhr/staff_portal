const User = require('../database/models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

class AuthController {
  async login(req, res) {
    try {
      const { employee_number, password } = req.body;

      console.log('=== LOGIN REQUEST ===');
      console.log('Request body:', req.body);
      console.log('Employee number:', employee_number);
      console.log('Password provided:', password ? 'Yes' : 'No');

      if (!employee_number || !password) {
        console.log('Missing fields - employee_number:', !!employee_number, 'password:', !!password);
        return res.status(400).json({ message: '請提供員工編號和密碼' });
      }

      console.log('Searching for user with employee_number:', employee_number);
      const user = await User.findByEmployeeNumber(employee_number);

      console.log('Query result:', user ? 'User found' : 'User not found');
      if (user) {
        console.log('Found user details:');
        console.log('- Employee number:', user.employee_number);
        console.log('- Name:', user.display_name);
        console.log('- Has password_hash:', !!user.password_hash);
      }

      if (!user) {
        console.log('❌ User not found for employee_number:', employee_number);
        console.log('Please check:');
        console.log('1. Database has been seeded (npm run seed)');
        console.log('2. Employee number is correct');
        return res.status(401).json({ message: '無效的員工編號或密碼' });
      }

      // 檢查帳戶是否已停用
      if (user.deactivated) {
        console.log('❌ User account deactivated for employee_number:', employee_number);
        return res.status(403).json({ message: '此帳戶已被停用，無法登入' });
      }

      console.log('Comparing password...');
      const isValidPassword = await comparePassword(password, user.password_hash);
      console.log('Password match result:', isValidPassword);

      if (!isValidPassword) {
        console.log('❌ Invalid password for employee_number:', employee_number);
        console.log('Expected password: admin123 (for admin), user123 (for test users)');
        return res.status(401).json({ message: '無效的員工編號或密碼' });
      }

      console.log('✅ Login successful for employee_number:', employee_number);

      let token;
      try {
        console.log('Generating JWT token for user ID:', user.id);
        console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
        token = generateToken(user.id);
        console.log('Token generated successfully');
      } catch (tokenError) {
        console.error('❌ Token generation failed:', tokenError.message);
        return res.status(500).json({ 
          message: '生成認證令牌時發生錯誤',
          error: tokenError.message 
        });
      }

      // 取得使用者的群組資訊
      const departmentGroups = await User.getDepartmentGroups(user.id);
      const delegationGroups = await User.getDelegationGroups(user.id);
      const isHRMember = await User.isHRMember(user.id);
      const delegationGroupIds = delegationGroups.map(group => Number(group.id));
      const isDeptHead = departmentGroups.some(group =>
        (group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id))) ||
        (group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id))) ||
        (group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id)))
      );

      // 準備用戶數據（包含 deactivated 狀態）
      const userData = {
        id: user.id,
        employee_number: user.employee_number,
        surname: user.surname,
        given_name: user.given_name,
        alias: user.alias || null,
        display_name: user.display_name,
        email: user.email,
        department_id: user.department_id || null,
        department_name: user.department_name || null,
        department_name_zh: user.department_name_zh || null,
        position_id: user.position_id || null,
        position_name: user.position_name || null,
        position_name_zh: user.position_name_zh || null,
        deactivated: !!user.deactivated,
        is_system_admin: isHRMember,
        is_dept_head: isDeptHead,
        is_hr_member: isHRMember,
        department_groups: departmentGroups,
        delegation_groups: delegationGroups
      };

      console.log('Sending response with token and user data');
      res.json({
        message: '登入成功',
        token,
        user: userData
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('Error stack:', error.stack);
      
      const errorMessage = error.message || '登入時發生錯誤';
      console.error('Error message:', errorMessage);
      
      res.status(500).json({ 
        message: '登入時發生錯誤',
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: '請提供當前密碼和新密碼' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: '新密碼長度至少需要6個字符' });
      }

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: '用戶不存在' });
      }

      const isValidPassword = await comparePassword(currentPassword, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ message: '當前密碼不正確' });
      }

      const newPasswordHash = await hashPassword(newPassword);
      await User.updatePassword(userId, newPasswordHash);

      res.json({ message: '密碼已成功更改' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: '更改密碼時發生錯誤' });
    }
  }

  async getCurrentUser(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: '用戶不存在' });
      }

      // 取得使用者的群組資訊
      const departmentGroups = await User.getDepartmentGroups(user.id);
      const delegationGroups = await User.getDelegationGroups(user.id);
      const isHRMember = await User.isHRMember(user.id);
      const delegationGroupIds = delegationGroups.map(group => Number(group.id));
      const isDeptHead = departmentGroups.some(group =>
        (group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id))) ||
        (group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id))) ||
        (group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id)))
      );

      res.json({
        user: {
          id: user.id,
          employee_number: user.employee_number,
          surname: user.surname,
          given_name: user.given_name,
          alias: user.alias,
          display_name: user.display_name,
          email: user.email,
          department_id: user.department_id,
          department_name: user.department_name,
          department_name_zh: user.department_name_zh,
          position_id: user.position_id,
          position_name: user.position_name,
          position_name_zh: user.position_name_zh,
          deactivated: !!user.deactivated,
          is_system_admin: isHRMember,
          is_dept_head: isDeptHead,
          is_hr_member: isHRMember,
          department_groups: departmentGroups,
          delegation_groups: delegationGroups
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: '獲取用戶資訊時發生錯誤' });
    }
  }
}

module.exports = new AuthController();
