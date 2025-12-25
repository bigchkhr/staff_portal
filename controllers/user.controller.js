const User = require('../database/models/User');

class UserController {
  async getProfile(req, res) {
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
      console.error('Get profile error:', error);
      res.status(500).json({ message: '獲取用戶資料時發生錯誤' });
    }
  }
}

module.exports = new UserController();

