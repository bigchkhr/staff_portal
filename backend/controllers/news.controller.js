const News = require('../database/models/News');
const NewsGroup = require('../database/models/NewsGroup');
const User = require('../database/models/User');
const knex = require('../config/database');

class NewsController {
  // 獲取所有最新消息列表（根據用戶權限過濾）
  async getAllNews(req, res) {
    try {
      const userId = req.user?.id || null;
      const newsList = await News.findAll(userId);
      
      res.json({
        success: true,
        news: newsList
      });
    } catch (error) {
      console.error('Get all news error:', error);
      res.status(500).json({
        success: false,
        message: '獲取最新消息列表時發生錯誤',
        error: error.message
      });
    }
  }

  // 獲取單個消息詳情
  async getNewsById(req, res) {
    try {
      const { id } = req.params;
      
      // 驗證 id 參數
      if (!id || id === 'undefined' || isNaN(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      const newsId = parseInt(id, 10);
      const userId = req.user?.id || null;
      const news = await News.findById(newsId, userId);

      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在或您沒有權限查看此消息'
        });
      }

      res.json({
        success: true,
        news: news
      });
    } catch (error) {
      console.error('Get news by id error:', error);
      res.status(500).json({
        success: false,
        message: '獲取消息詳情時發生錯誤',
        error: error.message
      });
    }
  }

  // 創建新消息（僅群組管理員）
  async createNews(req, res) {
    try {
      // 檢查是否為消息群組管理員
      const isManager = await NewsGroup.isManager(req.user.id);
      if (!isManager) {
        return res.status(403).json({
          success: false,
          message: '只有消息群組管理員可以發布消息'
        });
      }

      const { title, content, is_pinned, is_all_employees, group_ids } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '請輸入消息標題'
        });
      }

      if (!content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '請輸入消息內容'
        });
      }

      // 驗證群組選擇：如果 is_all_employees 為 false，則必須有 group_ids
      const validGroupIds = group_ids && Array.isArray(group_ids) ? group_ids : [];
      if (!is_all_employees && validGroupIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請至少選擇一個群組'
        });
      }

      const newsData = {
        title: title.trim(),
        content: content.trim(),
        created_by_id: req.user.id,
        is_pinned: is_pinned || false,
        is_all_employees: is_all_employees !== undefined ? is_all_employees : false,
        group_ids: is_all_employees ? [] : validGroupIds
      };

      const news = await News.create(newsData);

      res.status(201).json({
        success: true,
        message: '消息發布成功',
        news: news
      });
    } catch (error) {
      console.error('Create news error:', error);
      res.status(500).json({
        success: false,
        message: '發布消息時發生錯誤',
        error: error.message
      });
    }
  }

  // 更新消息（僅群組管理員或創建者）
  async updateNews(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 驗證 id 參數
      if (!id || id === 'undefined' || isNaN(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      const newsId = parseInt(id, 10);

      // 檢查是否為消息群組管理員
      const isManager = await NewsGroup.isManager(userId);
      
      // 獲取消息以檢查創建者
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 只有群組管理員或創建者可以更新
      if (!isManager && news.created_by_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '您沒有權限編輯此消息'
        });
      }

      const { title, content, is_pinned, is_all_employees, group_ids } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '請輸入消息標題'
        });
      }

      if (!content || content.trim() === '') {
        return res.status(400).json({
          success: false,
          message: '請輸入消息內容'
        });
      }

      // 驗證群組選擇：如果 is_all_employees 為 false，則必須有 group_ids
      const validGroupIds = group_ids && Array.isArray(group_ids) ? group_ids : [];
      if (!is_all_employees && validGroupIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請至少選擇一個群組'
        });
      }

      const newsData = {
        title: title.trim(),
        content: content.trim(),
        is_pinned: is_pinned || false,
        is_all_employees: is_all_employees !== undefined ? is_all_employees : false,
        group_ids: is_all_employees ? [] : validGroupIds
      };

      const updatedNews = await News.update(newsId, newsData);

      res.json({
        success: true,
        message: '消息更新成功',
        news: updatedNews
      });
    } catch (error) {
      console.error('Update news error:', error);
      res.status(500).json({
        success: false,
        message: '更新消息時發生錯誤',
        error: error.message
      });
    }
  }

  // 刪除消息（僅群組管理員或創建者）
  async deleteNews(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 驗證 id 參數
      if (!id || id === 'undefined' || isNaN(parseInt(id, 10))) {
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      const newsId = parseInt(id, 10);

      // 檢查是否為消息群組管理員
      const isManager = await NewsGroup.isManager(userId);
      
      // 獲取消息以檢查創建者
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 只有群組管理員或創建者可以刪除
      if (!isManager && news.created_by_id !== userId) {
        return res.status(403).json({
          success: false,
          message: '您沒有權限刪除此消息'
        });
      }

      await News.delete(newsId);

      res.json({
        success: true,
        message: '消息已刪除'
      });
    } catch (error) {
      console.error('Delete news error:', error);
      res.status(500).json({
        success: false,
        message: '刪除消息時發生錯誤',
        error: error.message
      });
    }
  }
}

module.exports = new NewsController();

