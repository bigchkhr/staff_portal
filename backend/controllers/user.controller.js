const User = require('../database/models/User');

class UserController {
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ message: '用戶不存在' });
      }

      // 取得使用者的群組資訊
      const departmentGroups = await User.getDepartmentGroups(user.id);
      const delegationGroups = await User.getDelegationGroups(user.id);
      const isHRMember = await User.isHRMember(user.id);

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
          is_hr_member: isHRMember,
          department_groups: departmentGroups,
          delegation_groups: delegationGroups
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: '獲取用戶資料時發生錯誤' });
    }
  }

  async getDepartmentUsers(req, res) {
    try {
      const departmentId = req.user.department_id;
      
      if (!departmentId) {
        return res.status(400).json({ message: '用戶未分配部門' });
      }

      const users = await User.findAll({ 
        department_id: departmentId
      });

      res.json({ users });
    } catch (error) {
      console.error('Get department users error:', error);
      res.status(500).json({ message: '獲取部門用戶列表時發生錯誤' });
    }
  }

  async checkCanApprove(req, res) {
    try {
      const { id } = req.params;
      const canApprove = await User.canApprove(req.user.id, id);
      res.json({ canApprove });
    } catch (error) {
      console.error('Check can approve error:', error);
      res.status(500).json({ message: '檢查批核權限時發生錯誤' });
    }
  }

  async checkCanView(req, res) {
    try {
      const { id } = req.params;
      const canView = await User.canViewApplication(req.user.id, id);
      res.json({ canView });
    } catch (error) {
      console.error('Check can view error:', error);
      res.status(500).json({ message: '檢查查看權限時發生錯誤' });
    }
  }
}

module.exports = new UserController();
