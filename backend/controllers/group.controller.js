const DepartmentGroup = require('../database/models/DepartmentGroup');
const DelegationGroup = require('../database/models/DelegationGroup');
const GroupContact = require('../database/models/GroupContact');

class GroupController {
  // ========== Department Groups ==========
  
  async getDepartmentGroups(req, res) {
    try {
      const { closed, forCalendar } = req.query; // 支援 closed 參數篩選：'true', 'false', 或 undefined (全部)
      // forCalendar: 如果為 'true'，只返回用戶是approver成員的群組（用於群組假期週曆）
      
      let groups = await DepartmentGroup.findAll(closed);
      
      // 如果請求是用於群組假期週曆，只返回用戶是approver成員的群組
      if (forCalendar === 'true') {
        const userId = req.user.id;
        const GroupContact = require('../database/models/GroupContact');
        
        // 過濾出用戶是approver成員的群組
        const accessibleGroups = [];
        for (const group of groups) {
          const isApprover = await GroupContact.isApproverMember(userId, group.id);
          if (isApprover) {
            accessibleGroups.push(group);
          }
        }
        groups = accessibleGroups;
      }
      
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
      const allowedFields = ['name', 'name_zh', 'description', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id', 'user_ids', 'closed'];
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
      const allowedFields = ['name', 'name_zh', 'description', 'checker_id', 'approver_1_id', 'approver_2_id', 'approver_3_id', 'user_ids', 'closed'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 ID 字段，將空字符串轉換為 null
          if ((key === 'checker_id' || key === 'approver_1_id' || key === 'approver_2_id' || key === 'approver_3_id')) {
            filteredData[key] = groupData[key] === '' || groupData[key] === null || groupData[key] === undefined 
              ? null 
              : Number(groupData[key]);
          } else if (key === 'closed') {
            // 確保 closed 是 boolean
            filteredData[key] = Boolean(groupData[key]);
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
      // 部門群組不可刪除，只能關閉
      return res.status(403).json({ message: '部門群組不可刪除，請使用關閉功能' });
    } catch (error) {
      console.error('Delete department group error:', error);
      res.status(500).json({ message: '操作時發生錯誤' });
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
      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      console.log(`[getDepartmentGroupMembers] 請求獲取群組 ID ${id} 的成員`);
      
      if (!id || isNaN(Number(id))) {
        return res.status(400).json({ 
          message: '無效的群組 ID',
          error: 'Invalid group ID'
        });
      }

      // 系統管理員可以查看所有群組的成員
      if (isSystemAdmin) {
        const members = await DepartmentGroup.getMembers(id);
        console.log(`[getDepartmentGroupMembers] 成功獲取 ${members.length} 個成員`);
        return res.json({ members });
      }

      // 檢查用戶是否可以查看此群組的成員
      // 1. 檢查是否為群組成員
      const Schedule = require('../database/models/Schedule');
      const isMember = await Schedule.isUserInGroup(userId, id);
      if (isMember) {
        const members = await DepartmentGroup.getMembers(id);
        console.log(`[getDepartmentGroupMembers] 成功獲取 ${members.length} 個成員（群組成員權限）`);
        return res.json({ members });
      }

      // 2. 檢查是否為批核成員（approver1, approver2, approver3, checker）
      const GroupContact = require('../database/models/GroupContact');
      const isApprover = await GroupContact.isApproverMember(userId, id);
      if (isApprover) {
        const members = await DepartmentGroup.getMembers(id);
        console.log(`[getDepartmentGroupMembers] 成功獲取 ${members.length} 個成員（批核成員權限）`);
        return res.json({ members });
      }

      // 如果既不是群組成員也不是批核成員，拒絕訪問
      return res.status(403).json({ 
        message: '您沒有權限查看此群組的成員',
        error: 'Permission denied'
      });
    } catch (error) {
      console.error('[getDepartmentGroupMembers] 獲取部門群組成員時發生錯誤:', error);
      console.error('錯誤訊息:', error.message);
      console.error('錯誤堆疊:', error.stack);
      
      // 在開發環境中返回詳細錯誤信息
      const errorResponse = {
        message: '獲取部門群組成員時發生錯誤',
        error: error.message
      };
      
      if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
        errorResponse.details = error.toString();
      }
      
      res.status(500).json(errorResponse);
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
      const { closed } = req.query; // 支援 closed 參數篩選：'true', 'false', 或 undefined (全部)
      const groups = await DelegationGroup.findAll(closed);
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
      const allowedFields = ['name', 'name_zh', 'description', 'user_ids', 'closed'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 description，空字串轉換為 null
          if (key === 'description') {
            filteredData[key] = groupData[key] === '' ? null : groupData[key];
          } else if (key === 'closed') {
            // 確保 closed 是 boolean
            filteredData[key] = Boolean(groupData[key]);
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
      const allowedFields = ['name', 'name_zh', 'description', 'user_ids', 'closed'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          // 對於 description，空字串轉換為 null
          if (key === 'description') {
            filteredData[key] = groupData[key] === '' ? null : groupData[key];
          } else if (key === 'closed') {
            // 確保 closed 是 boolean
            filteredData[key] = Boolean(groupData[key]);
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
      // 授權群組不可刪除，只能關閉
      return res.status(403).json({ message: '授權群組不可刪除，請使用關閉功能' });
    } catch (error) {
      console.error('Delete delegation group error:', error);
      res.status(500).json({ message: '操作時發生錯誤' });
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

  // ========== Group Contacts ==========
  
  // 獲取用戶可以瀏覽聯絡人的部門群組列表（包括直接所屬和通過授權群組關聯的）
  async getAccessibleDepartmentGroupsForContacts(req, res) {
    try {
      const userId = req.user.id;
      const User = require('../database/models/User');
      const DepartmentGroup = require('../database/models/DepartmentGroup');
      
      // 獲取用戶直接所屬的部門群組
      const directDepartmentGroups = await User.getDepartmentGroups(userId);
      
      // 獲取用戶所屬的授權群組
      const userDelegationGroups = await User.getDelegationGroups(userId);
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));
      
      // 獲取所有部門群組
      const allDepartmentGroups = await DepartmentGroup.findAll();
      
      // 過濾出用戶通過授權群組可以訪問的部門群組
      const accessibleViaDelegation = allDepartmentGroups.filter(deptGroup => {
        const checkerId = deptGroup.checker_id ? Number(deptGroup.checker_id) : null;
        const approver1Id = deptGroup.approver_1_id ? Number(deptGroup.approver_1_id) : null;
        const approver2Id = deptGroup.approver_2_id ? Number(deptGroup.approver_2_id) : null;
        const approver3Id = deptGroup.approver_3_id ? Number(deptGroup.approver_3_id) : null;

        return userDelegationGroupIds.includes(checkerId) ||
               userDelegationGroupIds.includes(approver1Id) ||
               userDelegationGroupIds.includes(approver2Id) ||
               userDelegationGroupIds.includes(approver3Id);
      });
      
      // 合併並去重（使用 id 作為唯一標識）
      const directGroupIds = directDepartmentGroups.map(g => g.id);
      const allAccessibleGroups = [...directDepartmentGroups];
      
      accessibleViaDelegation.forEach(group => {
        if (!directGroupIds.includes(group.id)) {
          allAccessibleGroups.push(group);
        }
      });
      
      res.json({ groups: allAccessibleGroups });
    } catch (error) {
      console.error('Get accessible department groups for contacts error:', error);
      res.status(500).json({ message: '獲取可訪問的部門群組列表時發生錯誤' });
    }
  }
  
  // 獲取群組聯絡人清單（部門群組成員或授權群組成員可以瀏覽）
  async getGroupContacts(req, res) {
    try {
      const { departmentGroupId } = req.params;
      const userId = req.user.id;

      // 檢查使用者是否可以瀏覽（部門群組成員或授權群組成員）
      const canView = await GroupContact.canViewContacts(userId, departmentGroupId);
      if (!canView) {
        return res.status(403).json({ message: '您不屬於此群組或相關授權群組，無權限瀏覽聯絡人清單' });
      }

      const contacts = await GroupContact.findAll(departmentGroupId);
      res.json({ contacts });
    } catch (error) {
      console.error('Get group contacts error:', error);
      res.status(500).json({ message: '獲取群組聯絡人清單時發生錯誤' });
    }
  }

  // 獲取單一聯絡人（部門群組成員或授權群組成員可以瀏覽）
  async getGroupContact(req, res) {
    try {
      const { id, departmentGroupId } = req.params;
      const userId = req.user.id;

      const contact = await GroupContact.findById(id);
      if (!contact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      // 驗證聯絡人是否屬於指定的部門群組
      if (contact.department_group_id !== Number(departmentGroupId)) {
        return res.status(400).json({ message: '聯絡人不屬於指定的部門群組' });
      }

      // 檢查使用者是否可以瀏覽（部門群組成員或授權群組成員）
      const canView = await GroupContact.canViewContacts(userId, contact.department_group_id);
      if (!canView) {
        return res.status(403).json({ message: '您不屬於此群組或相關授權群組，無權限瀏覽聯絡人' });
      }

      res.json({ contact });
    } catch (error) {
      console.error('Get group contact error:', error);
      res.status(500).json({ message: '獲取聯絡人時發生錯誤' });
    }
  }

  // 新增群組聯絡人（只有授權群組的批核成員才可新增）
  async createGroupContact(req, res) {
    try {
      const { departmentGroupId } = req.params;
      const userId = req.user.id;
      const contactData = req.body;

      // 檢查使用者是否為授權群組的批核成員
      const isApprover = await GroupContact.isApproverMember(userId, departmentGroupId);
      if (!isApprover) {
        return res.status(403).json({ message: '只有授權群組的批核成員才可新增聯絡人' });
      }

      // 驗證必填欄位
      if (!contactData.name) {
        return res.status(400).json({ message: '請填寫聯絡人姓名' });
      }

      // 過濾和處理資料
      const allowedFields = ['name', 'name_zh', 'company_name', 'company_name_zh', 'phone', 'email', 'address', 'position', 'notes'];
      const filteredData = {
        department_group_id: Number(departmentGroupId)
      };

      for (const key of allowedFields) {
        if (key in contactData) {
          if (key === 'phone') {
            // 處理電話號碼數組
            if (Array.isArray(contactData[key])) {
              const phoneArray = contactData[key].filter(p => p && p.trim() !== '');
              filteredData[key] = phoneArray.length > 0 ? phoneArray : null;
            } else {
              filteredData[key] = contactData[key] === '' ? null : contactData[key];
            }
          } else {
            filteredData[key] = contactData[key] === '' ? null : contactData[key];
          }
        }
      }

      const contact = await GroupContact.create(filteredData);
      res.status(201).json({ 
        message: '聯絡人新增成功',
        contact 
      });
    } catch (error) {
      console.error('Create group contact error:', error);
      res.status(500).json({ 
        message: '新增聯絡人時發生錯誤',
        error: error.message
      });
    }
  }

  // 更新群組聯絡人（只有授權群組的批核成員才可修改）
  async updateGroupContact(req, res) {
    try {
      const { id, departmentGroupId } = req.params;
      const userId = req.user.id;
      const contactData = req.body;

      const contact = await GroupContact.findById(id);
      if (!contact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      // 驗證聯絡人是否屬於指定的部門群組
      if (contact.department_group_id !== Number(departmentGroupId)) {
        return res.status(400).json({ message: '聯絡人不屬於指定的部門群組' });
      }

      // 檢查使用者是否為授權群組的批核成員
      const isApprover = await GroupContact.isApproverMember(userId, contact.department_group_id);
      if (!isApprover) {
        return res.status(403).json({ message: '只有授權群組的批核成員才可修改聯絡人' });
      }

      // 過濾和處理資料
      const allowedFields = ['name', 'name_zh', 'company_name', 'company_name_zh', 'phone', 'email', 'address', 'position', 'notes'];
      const filteredData = {};

      for (const key of allowedFields) {
        if (key in contactData) {
          if (key === 'phone') {
            // 處理電話號碼數組
            if (Array.isArray(contactData[key])) {
              const phoneArray = contactData[key].filter(p => p && p.trim() !== '');
              filteredData[key] = phoneArray.length > 0 ? phoneArray : null;
            } else {
              filteredData[key] = contactData[key] === '' ? null : contactData[key];
            }
          } else {
            filteredData[key] = contactData[key] === '' ? null : contactData[key];
          }
        }
      }

      const updatedContact = await GroupContact.update(id, filteredData);
      res.json({ 
        message: '聯絡人更新成功',
        contact: updatedContact 
      });
    } catch (error) {
      console.error('Update group contact error:', error);
      res.status(500).json({ 
        message: '更新聯絡人時發生錯誤',
        error: error.message
      });
    }
  }

  // 刪除群組聯絡人（只有授權群組的批核成員才可刪除）
  async deleteGroupContact(req, res) {
    try {
      const { id, departmentGroupId } = req.params;
      const userId = req.user.id;

      const contact = await GroupContact.findById(id);
      if (!contact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      // 驗證聯絡人是否屬於指定的部門群組
      if (contact.department_group_id !== Number(departmentGroupId)) {
        return res.status(400).json({ message: '聯絡人不屬於指定的部門群組' });
      }

      // 檢查使用者是否為授權群組的批核成員
      const isApprover = await GroupContact.isApproverMember(userId, contact.department_group_id);
      if (!isApprover) {
        return res.status(403).json({ message: '只有授權群組的批核成員才可刪除聯絡人' });
      }

      await GroupContact.delete(id);
      res.json({ message: '聯絡人刪除成功' });
    } catch (error) {
      console.error('Delete group contact error:', error);
      res.status(500).json({ 
        message: '刪除聯絡人時發生錯誤',
        error: error.message
      });
    }
  }
}

module.exports = new GroupController();

