const User = require('../database/models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: '請提供電子郵件和密碼' });
      }

      const user = await User.findByEmail(email);

      if (!user) {
        return res.status(401).json({ message: '無效的電子郵件或密碼' });
      }

      if (!user.is_active) {
        return res.status(403).json({ message: '帳戶已被停用' });
      }

      const isValidPassword = await comparePassword(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ message: '無效的電子郵件或密碼' });
      }

      const token = generateToken(user.id);

      res.json({
        message: '登入成功',
        token,
        user: {
          id: user.id,
          employee_number: user.employee_number,
          surname: user.surname,
          given_name: user.given_name,
          alias: user.alias,
          name_zh: user.name_zh,
          email: user.email,
          is_system_admin: user.is_system_admin,
          is_dept_head: user.is_dept_head,
          department_id: user.department_id,
          department_name: user.department_name,
          department_name_zh: user.department_name_zh,
          position_id: user.position_id,
          position_name: user.position_name,
          position_name_zh: user.position_name_zh,
          group_id: user.group_id,
          group_name: user.group_name,
          group_name_zh: user.group_name_zh
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: '登入時發生錯誤' });
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

      res.json({
        user: {
          id: user.id,
          employee_number: user.employee_number,
          surname: user.surname,
          given_name: user.given_name,
          alias: user.alias,
          name_zh: user.name_zh,
          email: user.email,
          is_system_admin: user.is_system_admin,
          is_dept_head: user.is_dept_head,
          department_id: user.department_id,
          department_name: user.department_name,
          department_name_zh: user.department_name_zh,
          position_id: user.position_id,
          position_name: user.position_name,
          position_name_zh: user.position_name_zh,
          group_id: user.group_id,
          group_name: user.group_name,
          group_name_zh: user.group_name_zh
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ message: '獲取用戶資訊時發生錯誤' });
    }
  }
}

module.exports = new AuthController();

