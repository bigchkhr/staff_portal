const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');

class GroupController {
  // ========== Department Groups ==========
  
  async getDepartmentGroups(req, res) {
    try {
      const groups = await DepartmentGroup.findAll();
      res.json({ groups });
    } catch (error) {
      console.error('Get department groups error:', error);
      res.status(500).json({ message: '獲取部門群組列表時發生錯誤' });
    }
  }

  async getDepartmentGroup(req, res) {
    try {
      const { id } = req.params;
      const group = await DepartmentGroup.findById(id);
      
      if (!group) {
        return res.status(404).json({ message: '部門群組不存在' });
      }
      
      res.json({ group });
    } catch (error) {
      console.error('Get department group error:', error);
      res.status(500).json({ message: '獲取部門群組時發生錯誤' });
    }
  }

  async createDepartmentGroup(req, res) {
    try {
      const groupData = req.body;
      
      // 驗證必填欄位
      if (!groupData.name || !groupData.name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位（名稱、中文名稱）' });
      }
      
      // 過濾和處理資料，將空字串轉換為 null（對於 ID 欄位）
      const allowedFields = ['name', 'name_zh', 'description', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id', 'user_ids'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 ID 欄位，將空字串轉換為 null
          if (key === 'checker_id' || key === 'approver_1_id' || key === 'approver_2_id' || key === 'approver_3_id') {
            filteredData[key] = groupData[key] === '' || groupData[key] === null || groupData[key] === undefined 
              ? null 
              : Number(groupData[key]);
          } else {
            filteredData[key] = groupData[key];
          }
        }
      }
      
      // 如果 user_ids 是數組，確保格式正確
      if (filteredData.user_ids && Array.isArray(filteredData.user_ids)) {
        filteredData.user_ids = filteredData.user_ids.map(id => Number(id)).filter(id => !isNaN(id));
      }
      
      const group = await DepartmentGroup.create(filteredData);
      res.status(201).json({ 
        message: '部門群組建立成功',
        group 
      });
    } catch (error) {
      console.error('Create department group error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '建立部門群組時發生錯誤',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async updateDepartmentGroup(req, res) {
    try {
      const { id } = req.params;
      const groupData = req.body;
      
      console.log('[updateDepartmentGroup] 更新 ID:', id);
      console.log('[updateDepartmentGroup] 更新數據:', JSON.stringify(groupData, null, 2));
      
      // 過濾掉不需要更新的字段（如果有的話）
      const allowedFields = ['name', 'name_zh', 'description', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id', 'user_ids'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 ID 字段，將空字符串轉換為 null
          if ((key === 'checker_id' || key === 'approver_1_id' || key === 'approver_2_id' || key === 'approver_3_id')) {
            filteredData[key] = groupData[key] === '' || groupData[key] === null || groupData[key] === undefined 
              ? null 
              : Number(groupData[key]);
          } else {
            filteredData[key] = groupData[key];
          }
        }
      }
      
      // 如果 user_ids 是數組，確保格式正確
      if (filteredData.user_ids && Array.isArray(filteredData.user_ids)) {
        filteredData.user_ids = filteredData.user_ids.map(id => Number(id)).filter(id => !isNaN(id));
      }
      
      console.log('[updateDepartmentGroup] 過濾後的數據:', JSON.stringify(filteredData, null, 2));
      
      const group = await DepartmentGroup.update(id, filteredData);
      
      if (!group) {
        return res.status(404).json({ message: '部門群組不存在' });
      }
      
      res.json({ 
        message: '部門群組更新成功',
        group 
      });
    } catch (error) {
      console.error('Update department group error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '更新部門群組時發生錯誤',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async deleteDepartmentGroup(req, res) {
    try {
      const { id } = req.params;
      await DepartmentGroup.delete(id);
      res.json({ message: '部門群組刪除成功' });
    } catch (error) {
      console.error('Delete department group error:', error);
      res.status(500).json({ message: '刪除部門群組時發生錯誤' });
    }
  }

  async addUserToDepartmentGroup(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ message: '請提供使用者 ID' });
      }
      
      const group = await DepartmentGroup.addUser(id, user_id);
      res.json({ 
        message: '使用者已加入部門群組',
        group 
      });
    } catch (error) {
      console.error('Add user to department group error:', error);
      res.status(500).json({ 
        message: error.message || '新增使用者到部門群組時發生錯誤' 
      });
    }
  }

  async removeUserFromDepartmentGroup(req, res) {
    try {
      const { id, userId } = req.params;
      const group = await DepartmentGroup.removeUser(id, parseInt(userId));
      res.json({ 
        message: '使用者已從部門群組移除',
        group 
      });
    } catch (error) {
      console.error('Remove user from department group error:', error);
      res.status(500).json({ 
        message: error.message || '從部門群組移除使用者時發生錯誤' 
      });
    }
  }

  async getDepartmentGroupMembers(req, res) {
    try {
      const { id } = req.params;
      const members = await DepartmentGroup.getMembers(id);
      res.json({ members });
    } catch (error) {
      console.error('Get department group members error:', error);
      res.status(500).json({ message: '獲取部門群組成員時發生錯誤' });
    }
  }

  async getDepartmentGroupApprovalFlow(req, res) {
    try {
      const { id } = req.params;
      const flow = await DepartmentGroup.getApprovalFlow(id);
      res.json({ flow });
    } catch (error) {
      console.error('Get approval flow error:', error);
      res.status(500).json({ 
        message: error.message || '獲取批核流程時發生錯誤' 
      });
    }
  }

  // ========== Delegation Groups ==========
  
  async getDelegationGroups(req, res) {
    try {
      const groups = await DelegationGroup.findAll();
      res.json({ groups });
    } catch (error) {
      console.error('Get delegation groups error:', error);
      res.status(500).json({ message: '獲取授權群組列表時發生錯誤' });
    }
  }

  async getDelegationGroup(req, res) {
    try {
      const { id } = req.params;
      const group = await DelegationGroup.findById(id);
      
      if (!group) {
        return res.status(404).json({ message: '授權群組不存在' });
      }
      
      res.json({ group });
    } catch (error) {
      console.error('Get delegation group error:', error);
      res.status(500).json({ message: '獲取授權群組時發生錯誤' });
    }
  }

  async createDelegationGroup(req, res) {
    try {
      const groupData = req.body;
      
      // 驗證必填欄位
      if (!groupData.name || !groupData.name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位（名稱、中文名稱）' });
      }
      
      // 過濾和處理資料
      const allowedFields = ['name', 'name_zh', 'description', 'user_ids'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 description，空字串轉換為 null
          if (key === 'description') {
            filteredData[key] = groupData[key] === '' ? null : groupData[key];
          } else {
            filteredData[key] = groupData[key];
          }
        }
      }
      
      // 如果 user_ids 是數組，確保格式正確
      if (filteredData.user_ids && Array.isArray(filteredData.user_ids)) {
        filteredData.user_ids = filteredData.user_ids.map(id => Number(id)).filter(id => !isNaN(id));
      }
      
      const group = await DelegationGroup.create(filteredData);
      res.status(201).json({ 
        message: '授權群組建立成功',
        group 
      });
    } catch (error) {
      console.error('Create delegation group error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '建立授權群組時發生錯誤',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async updateDelegationGroup(req, res) {
    try {
      const { id } = req.params;
      const groupData = req.body;
      
      // 過濾和處理資料
      const allowedFields = ['name', 'name_zh', 'description', 'user_ids'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 description，空字串轉換為 null
          if (key === 'description') {
            filteredData[key] = groupData[key] === '' ? null : groupData[key];
          } else {
            filteredData[key] = groupData[key];
          }
        }
      }
      
      // 如果 user_ids 是數組，確保格式正確
      if (filteredData.user_ids && Array.isArray(filteredData.user_ids)) {
        filteredData.user_ids = filteredData.user_ids.map(id => Number(id)).filter(id => !isNaN(id));
      }
      
      const group = await DelegationGroup.update(id, filteredData);
      
      if (!group) {
        return res.status(404).json({ message: '授權群組不存在' });
      }
      
      res.json({ 
        message: '授權群組更新成功',
        group 
      });
    } catch (error) {
      console.error('Update delegation group error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '更新授權群組時發生錯誤',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async deleteDelegationGroup(req, res) {
    try {
      const { id } = req.params;
      await DelegationGroup.delete(id);
      res.json({ message: '授權群組刪除成功' });
    } catch (error) {
      console.error('Delete delegation group error:', error);
      res.status(500).json({ message: '刪除授權群組時發生錯誤' });
    }
  }

  async addUserToDelegationGroup(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body;
      
      if (!user_id) {
        return res.status(400).json({ message: '請提供使用者 ID' });
      }
      
      const group = await DelegationGroup.addUser(id, user_id);
      res.json({ 
        message: '使用者已加入授權群組',
        group 
      });
    } catch (error) {
      console.error('Add user to delegation group error:', error);
      res.status(500).json({ 
        message: error.message || '新增使用者到授權群組時發生錯誤' 
      });
    }
  }

  async removeUserFromDelegationGroup(req, res) {
    try {
      const { id, userId } = req.params;
      const group = await DelegationGroup.removeUser(id, parseInt(userId));
      res.json({ 
        message: '使用者已從授權群組移除',
        group 
      });
    } catch (error) {
      console.error('Remove user from delegation group error:', error);
      res.status(500).json({ 
        message: error.message || '從授權群組移除使用者時發生錯誤' 
      });
    }
  }

  async getDelegationGroupMembers(req, res) {
    try {
      const { id } = req.params;
      const members = await DelegationGroup.getMembers(id);
      res.json({ members });
    } catch (error) {
      console.error('Get delegation group members error:', error);
      res.status(500).json({ message: '獲取授權群組成員時發生錯誤' });
    }
  }

  // ========== User Group Info ==========
  
  async getUserGroups(req, res) {
    try {
      const userId = req.user.id;
      const User = require('../database/models/User');
      
      const departmentGroups = await User.getDepartmentGroups(userId);
      const delegationGroups = await User.getDelegationGroups(userId);
      
      res.json({ 
        department_groups: departmentGroups,
        delegation_groups: delegationGroups
      });
    } catch (error) {
      console.error('Get user groups error:', error);
      res.status(500).json({ message: '獲取使用者群組資訊時發生錯誤' });
    }
  }
}

module.exports = new GroupController();

