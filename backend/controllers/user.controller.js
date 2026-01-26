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
          position_stream: user.position_stream || null,
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
      const { application_type } = req.query;
      
      let canApprove;
      if (application_type === 'extra_working_hours') {
        canApprove = await User.canApproveExtraWorkingHours(req.user.id, id);
      } else if (application_type === 'outdoor_work') {
        canApprove = await User.canApproveOutdoorWork(req.user.id, id);
      } else {
        canApprove = await User.canApprove(req.user.id, id);
      }
      
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

  // 獲取用戶列表（允許批核者訪問，用於月結表等場景）
  async getUsersForApprovers(req, res) {
    try {
      const userId = req.user.id;
      
      // 檢查權限：HR 成員、系統管理員或批核者
      const isHRMember = await User.isHRMember(userId);
      const user = await User.findById(userId);
      const isSystemAdmin = user && user.is_system_admin;
      const isApprovalMember = await User.isApprovalMember(userId);
      
      if (!isHRMember && !isSystemAdmin && !isApprovalMember) {
        return res.status(403).json({ message: '無權限存取用戶列表' });
      }

      const { department_id, search, page, limit } = req.query;
      const options = {};

      if (department_id) options.department_id = department_id;
      if (search) options.search = search;
      
      // 分頁參數
      if (page) options.page = parseInt(page);
      if (limit) options.limit = parseInt(limit);

      const result = await User.findAll(options);

      res.json({
        users: result.users,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Get users for approvers error:', error);
      res.status(500).json({ message: '獲取用戶列表時發生錯誤' });
    }
  }
}

module.exports = new UserController();
