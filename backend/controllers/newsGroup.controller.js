const NewsGroup = require('../database/models/NewsGroup');
const User = require('../database/models/User');
const knex = require('../config/database');

class NewsGroupController {
  // 獲取所有消息群組
  async getNewsGroups(req, res) {
    try {
      const { closed } = req.query;
      const groups = await NewsGroup.findAll(closed);
      res.json({ groups });
    } catch (error) {
      console.error('Get news groups error:', error);
      res.status(500).json({ message: '獲取消息群組列表時發生錯誤' });
    }
  }

  // 獲取單個消息群組
  async getNewsGroup(req, res) {
    try {
      const { id } = req.params;
      const group = await NewsGroup.findById(id);
      
      if (!group) {
        return res.status(404).json({ message: '消息群組不存在' });
      }
      
      res.json({ group });
    } catch (error) {
      console.error('Get news group error:', error);
      res.status(500).json({ message: '獲取消息群組時發生錯誤' });
    }
  }

  // 創建消息群組（僅群組管理員）
  async createNewsGroup(req, res) {
    try {
      const userId = req.user.id;
      
      // 檢查是否為群組管理員
      const isManager = await NewsGroup.isManager(userId);
      if (!isManager) {
        return res.status(403).json({ message: '只有消息群組管理員可以創建群組' });
      }

      const groupData = req.body;
      
      if (!groupData.name || !groupData.name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位（名稱、中文名稱）' });
      }

      const allowedFields = ['name', 'name_zh', 'description', 'user_ids', 'closed'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          filteredData[key] = groupData[key];
        }
      }

      const group = await NewsGroup.create(filteredData);
      res.status(201).json({ group });
    } catch (error) {
      console.error('Create news group error:', error);
      res.status(500).json({ message: '創建消息群組時發生錯誤', error: error.message });
    }
  }

  // 更新消息群組（僅群組管理員）
  async updateNewsGroup(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // 檢查是否為群組管理員
      const isManager = await NewsGroup.isManager(userId);
      if (!isManager) {
        return res.status(403).json({ message: '只有消息群組管理員可以更新群組' });
      }

      const groupData = req.body;
      const allowedFields = ['name', 'name_zh', 'description', 'user_ids', 'closed'];
      const filteredData = {};
      
      for (const key of allowedFields) {
        if (key in groupData) {
          filteredData[key] = groupData[key];
        }
      }

      const group = await NewsGroup.update(id, filteredData);
      res.json({ group });
    } catch (error) {
      console.error('Update news group error:', error);
      res.status(500).json({ message: '更新消息群組時發生錯誤', error: error.message });
    }
  }

  // 刪除消息群組（僅群組管理員）
  async deleteNewsGroup(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      // 檢查是否為群組管理員
      const isManager = await NewsGroup.isManager(userId);
      if (!isManager) {
        return res.status(403).json({ message: '只有消息群組管理員可以刪除群組' });
      }

      await NewsGroup.delete(id);
      res.json({ message: '消息群組已刪除' });
    } catch (error) {
      console.error('Delete news group error:', error);
      res.status(500).json({ message: '刪除消息群組時發生錯誤', error: error.message });
    }
  }

  // 獲取群組成員
  async getNewsGroupMembers(req, res) {
    try {
      const { id } = req.params;
      const members = await NewsGroup.getMembers(id);
      res.json({ members });
    } catch (error) {
      console.error('Get news group members error:', error);
      res.status(500).json({ message: '獲取群組成員時發生錯誤', error: error.message });
    }
  }

  // 添加成員到群組（僅群組管理員）
  async addUserToNewsGroup(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body;
      const userId = req.user.id;
      
      // 檢查是否為群組管理員
      const isManager = await NewsGroup.isManager(userId);
      if (!isManager) {
        return res.status(403).json({ message: '只有消息群組管理員可以添加成員' });
      }

      if (!user_id) {
        return res.status(400).json({ message: '請提供用戶 ID' });
      }

      const group = await NewsGroup.addUser(id, user_id);
      res.json({ group });
    } catch (error) {
      console.error('Add user to news group error:', error);
      res.status(500).json({ message: '添加成員時發生錯誤', error: error.message });
    }
  }

  // 從群組移除成員（僅群組管理員）
  async removeUserFromNewsGroup(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.params;
      const currentUserId = req.user.id;
      
      // 檢查是否為群組管理員
      const isManager = await NewsGroup.isManager(currentUserId);
      if (!isManager) {
        return res.status(403).json({ message: '只有消息群組管理員可以移除成員' });
      }

      const group = await NewsGroup.removeUser(id, parseInt(userId));
      res.json({ group });
    } catch (error) {
      console.error('Remove user from news group error:', error);
      res.status(500).json({ message: '移除成員時發生錯誤', error: error.message });
    }
  }

  // 獲取所有群組管理員
  async getManagers(req, res) {
    try {
      const userId = req.user.id;
      
      // 檢查是否為系統管理員
      const user = await User.findById(userId);
      if (!user || !user.is_system_admin) {
        return res.status(403).json({ message: '只有系統管理員可以查看群組管理員列表' });
      }

      const managers = await NewsGroup.getManagers();
      res.json({ managers });
    } catch (error) {
      console.error('Get managers error:', error);
      res.status(500).json({ message: '獲取群組管理員列表時發生錯誤', error: error.message });
    }
  }

  // 添加群組管理員（僅系統管理員）
  async addManager(req, res) {
    try {
      const userId = req.user.id;
      
      // 檢查是否為系統管理員
      const user = await User.findById(userId);
      if (!user || !user.is_system_admin) {
        return res.status(403).json({ message: '只有系統管理員可以添加群組管理員' });
      }

      const { user_id } = req.body;
      if (!user_id) {
        return res.status(400).json({ message: '請提供用戶 ID' });
      }

      const manager = await NewsGroup.addManager(user_id);
      res.json({ manager });
    } catch (error) {
      console.error('Add manager error:', error);
      res.status(500).json({ message: '添加群組管理員時發生錯誤', error: error.message });
    }
  }

  // 移除群組管理員（僅系統管理員）
  async removeManager(req, res) {
    try {
      const userId = req.user.id;
      
      // 檢查是否為系統管理員
      const user = await User.findById(userId);
      if (!user || !user.is_system_admin) {
        return res.status(403).json({ message: '只有系統管理員可以移除群組管理員' });
      }

      const { user_id } = req.params;
      await NewsGroup.removeManager(user_id);
      res.json({ message: '群組管理員已移除' });
    } catch (error) {
      console.error('Remove manager error:', error);
      res.status(500).json({ message: '移除群組管理員時發生錯誤', error: error.message });
    }
  }

  // 檢查當前用戶是否為群組管理員
  async checkIsManager(req, res) {
    try {
      const userId = req.user.id;
      const isManager = await NewsGroup.isManager(userId);
      res.json({ isManager });
    } catch (error) {
      console.error('Check is manager error:', error);
      res.status(500).json({ message: '檢查管理員權限時發生錯誤', error: error.message });
    }
  }
}

module.exports = new NewsGroupController();

