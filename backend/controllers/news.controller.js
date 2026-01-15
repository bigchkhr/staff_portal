const News = require('../database/models/News');
const NewsGroup = require('../database/models/NewsGroup');
const User = require('../database/models/User');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const knex = require('../config/database');
const fs = require('fs');
const path = require('path');

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

  // 創建新消息（群組管理員、HR Group 成員或 delegation group 成員）
  async createNews(req, res) {
    try {
      // 檢查是否為消息群組管理員或 HR Group 成員
      const [isManager, isHRMember] = await Promise.all([
        NewsGroup.isManager(req.user.id),
        User.isHRMember(req.user.id)
      ]);
      
      // 如果不是管理員或 HR 成員，檢查是否為 delegation group 成員
      let canPublish = isManager || isHRMember;

      // 處理 FormData 中的 group_ids（可能是數組或字符串）
      let group_ids = req.body.group_ids;
      if (typeof group_ids === 'string') {
        // 如果是字符串，嘗試解析為數組
        try {
          group_ids = JSON.parse(group_ids);
        } catch (e) {
          // 如果不是 JSON，可能是單個值
          group_ids = [group_ids];
        }
      }
      // 如果 group_ids 是數組形式（來自 FormData 的 group_ids[]）
      if (req.body['group_ids[]']) {
        group_ids = Array.isArray(req.body['group_ids[]']) ? req.body['group_ids[]'] : [req.body['group_ids[]']];
      }

      const { title, content } = req.body;
      
      // 處理布爾值（FormData 會將布爾值轉為字符串）
      const is_pinned = req.body.is_pinned === 'true' || req.body.is_pinned === true;
      const is_all_employees = req.body.is_all_employees === 'true' || req.body.is_all_employees === true;

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
      const validGroupIds = group_ids && Array.isArray(group_ids) 
        ? group_ids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        : [];
      
      if (!is_all_employees && validGroupIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請至少選擇一個群組'
        });
      }

      // 驗證所有群組 ID 是否存在於部門群組中，並檢查用戶是否有權限
      if (validGroupIds.length > 0) {
        const existingGroups = await knex('department_groups')
          .whereIn('id', validGroupIds)
          .where('closed', false)
          .select('id');
        
        const existingGroupIds = existingGroups.map(g => Number(g.id));
        const invalidGroupIds = validGroupIds.filter(id => !existingGroupIds.includes(id));
        
        if (invalidGroupIds.length > 0) {
          return res.status(400).json({
            success: false,
            message: `無效的部門群組 ID: ${invalidGroupIds.join(', ')}`
          });
        }

        // 如果不是管理員或 HR 成員，檢查用戶是否有權限發布消息給這些部門群組
        if (!canPublish) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(req.user.id, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const unauthorizedGroupIds = validGroupIds.filter(id => !accessibleGroupIds.includes(id));
          
          if (unauthorizedGroupIds.length > 0) {
            return res.status(403).json({
              success: false,
              message: `您沒有權限發布消息給以下部門群組: ${unauthorizedGroupIds.join(', ')}`
            });
          }
          canPublish = true; // 用戶有權限發布給所有指定的群組
        }
      } else if (!canPublish) {
        // 如果選擇了所有員工但用戶不是管理員或 HR 成員，需要檢查是否有權限
        // 獲取用戶有權限的部門群組
        const accessibleGroups = await DepartmentGroup.getAccessibleForNews(req.user.id, false);
        if (accessibleGroups.length === 0) {
          return res.status(403).json({
            success: false,
            message: '您沒有權限發布消息'
          });
        }
        canPublish = true;
      }

      if (!canPublish) {
        return res.status(403).json({
          success: false,
          message: '您沒有權限發布消息'
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

      // 處理附件上傳
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await knex('news_attachments').insert({
            news_id: news.id,
            file_name: file.originalname,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by_id: req.user.id
          });
        }
      }

      // 重新獲取消息以包含附件信息
      const newsWithAttachments = await News.findById(news.id, req.user.id);

      res.status(201).json({
        success: true,
        message: '消息發布成功',
        news: newsWithAttachments
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

  // 更新消息（僅群組管理員、HR Group 成員或創建者）
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

      // 檢查是否為消息群組管理員或 HR Group 成員
      const [isManager, isHRMember] = await Promise.all([
        NewsGroup.isManager(userId),
        User.isHRMember(userId)
      ]);
      
      // 獲取消息以檢查創建者
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 檢查權限：群組管理員、HR Group 成員、創建者，或 delegation group 成員（有權限發布給消息的群組）
      let canEdit = isManager || isHRMember || news.created_by_id === userId;
      
      if (!canEdit) {
        // 檢查用戶是否有權限發布消息給消息指定的部門群組
        const newsGroupIds = news.group_ids || [];
        if (newsGroupIds.length > 0) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(userId, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const hasAccessToAllGroups = newsGroupIds.every(id => accessibleGroupIds.includes(Number(id)));
          canEdit = hasAccessToAllGroups;
        }
      }

      if (!canEdit) {
        return res.status(403).json({
          success: false,
          message: '您沒有權限編輯此消息'
        });
      }

      // 處理 FormData 中的 group_ids（可能是數組或字符串）
      let group_ids = req.body.group_ids;
      if (typeof group_ids === 'string') {
        // 如果是字符串，嘗試解析為數組
        try {
          group_ids = JSON.parse(group_ids);
        } catch (e) {
          // 如果不是 JSON，可能是單個值
          group_ids = [group_ids];
        }
      }
      // 如果 group_ids 是數組形式（來自 FormData 的 group_ids[]）
      if (req.body['group_ids[]']) {
        group_ids = Array.isArray(req.body['group_ids[]']) ? req.body['group_ids[]'] : [req.body['group_ids[]']];
      }

      const { title, content } = req.body;
      
      // 處理布爾值（FormData 會將布爾值轉為字符串）
      const is_pinned = req.body.is_pinned === 'true' || req.body.is_pinned === true;
      const is_all_employees = req.body.is_all_employees === 'true' || req.body.is_all_employees === true;

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
      const validGroupIds = group_ids && Array.isArray(group_ids) 
        ? group_ids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0)
        : [];
      
      if (!is_all_employees && validGroupIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請至少選擇一個群組'
        });
      }

      // 驗證所有群組 ID 是否存在於部門群組中，並檢查用戶是否有權限
      if (validGroupIds.length > 0) {
        const existingGroups = await knex('department_groups')
          .whereIn('id', validGroupIds)
          .where('closed', false)
          .select('id');
        
        const existingGroupIds = existingGroups.map(g => Number(g.id));
        const invalidGroupIds = validGroupIds.filter(id => !existingGroupIds.includes(id));
        
        if (invalidGroupIds.length > 0) {
          return res.status(400).json({
            success: false,
            message: `無效的部門群組 ID: ${invalidGroupIds.join(', ')}`
          });
        }

        // 如果不是管理員或 HR 成員，檢查用戶是否有權限發布消息給這些部門群組
        if (!isManager && !isHRMember && news.created_by_id !== userId) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(userId, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const unauthorizedGroupIds = validGroupIds.filter(id => !accessibleGroupIds.includes(id));
          
          if (unauthorizedGroupIds.length > 0) {
            return res.status(403).json({
              success: false,
              message: `您沒有權限發布消息給以下部門群組: ${unauthorizedGroupIds.join(', ')}`
            });
          }
        }
      }

      const newsData = {
        title: title.trim(),
        content: content.trim(),
        is_pinned: is_pinned || false,
        is_all_employees: is_all_employees !== undefined ? is_all_employees : false,
        group_ids: is_all_employees ? [] : validGroupIds
      };

      const updatedNews = await News.update(newsId, newsData);

      // 處理附件上傳
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await knex('news_attachments').insert({
            news_id: newsId,
            file_name: file.originalname,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by_id: req.user.id
          });
        }
      }

      // 重新獲取消息以包含附件信息
      const newsWithAttachments = await News.findById(newsId, req.user.id);

      res.json({
        success: true,
        message: '消息更新成功',
        news: newsWithAttachments
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

  // 刪除消息（僅群組管理員、HR Group 成員或創建者）
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

      // 檢查是否為消息群組管理員或 HR Group 成員
      const [isManager, isHRMember] = await Promise.all([
        NewsGroup.isManager(userId),
        User.isHRMember(userId)
      ]);
      
      // 獲取消息以檢查創建者
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 檢查權限：群組管理員、HR Group 成員、創建者，或 delegation group 成員（有權限發布給消息的群組）
      let canDelete = isManager || isHRMember || news.created_by_id === userId;
      
      if (!canDelete) {
        // 檢查用戶是否有權限發布消息給消息指定的部門群組
        const newsGroupIds = news.group_ids || [];
        if (newsGroupIds.length > 0) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(userId, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const hasAccessToAllGroups = newsGroupIds.every(id => accessibleGroupIds.includes(Number(id)));
          canDelete = hasAccessToAllGroups;
        }
      }

      if (!canDelete) {
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

  // 上傳消息附件
  async uploadAttachment(req, res) {
    try {
      console.log('[uploadAttachment] Request received:', {
        params: req.params,
        files: req.files ? req.files.length : 0,
        body: req.body
      });

      const { id } = req.params;
      const newsId = parseInt(id, 10);

      // 驗證 id 參數
      if (!id || id === 'undefined' || isNaN(newsId)) {
        console.error('[uploadAttachment] Invalid news ID:', id);
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      // 檢查消息是否存在
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 檢查權限
      const [isManager, isHRMember] = await Promise.all([
        NewsGroup.isManager(req.user.id),
        User.isHRMember(req.user.id)
      ]);
      
      let canEdit = isManager || isHRMember || news.created_by_id === req.user.id;
      
      if (!canEdit) {
        const newsGroupIds = news.group_ids || [];
        if (newsGroupIds.length > 0) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(req.user.id, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const hasAccessToAllGroups = newsGroupIds.every(id => accessibleGroupIds.includes(Number(id)));
          canEdit = hasAccessToAllGroups;
        }
      }

      if (!canEdit) {
        // 刪除已上傳的文件
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }
        return res.status(403).json({
          success: false,
          message: '您沒有權限為此消息上傳附件'
        });
      }

      if (!req.files || req.files.length === 0) {
        console.error('[uploadAttachment] No files uploaded');
        return res.status(400).json({
          success: false,
          message: '請選擇要上傳的檔案'
        });
      }

      console.log('[uploadAttachment] Processing files:', req.files.map(f => ({
        originalname: f.originalname,
        size: f.size,
        mimetype: f.mimetype,
        path: f.path
      })));

      const attachments = [];
      for (const file of req.files) {
        try {
          const [attachment] = await knex('news_attachments')
            .insert({
              news_id: newsId,
              file_name: file.originalname,
              file_path: file.path,
              file_type: file.mimetype,
              file_size: file.size,
              uploaded_by_id: req.user.id
            })
            .returning('*');
          
          attachments.push(attachment);
          console.log('[uploadAttachment] File saved:', attachment.id);
        } catch (dbError) {
          console.error('[uploadAttachment] Database error for file:', file.originalname, dbError);
          // 如果數據庫插入失敗，刪除已上傳的文件
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          throw dbError;
        }
      }

      console.log('[uploadAttachment] Successfully uploaded', attachments.length, 'attachments');
      res.status(201).json({
        success: true,
        message: `成功上傳 ${attachments.length} 個附件`,
        attachments: attachments
      });
    } catch (error) {
      console.error('[uploadAttachment] Error:', error);
      console.error('[uploadAttachment] Error stack:', error.stack);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.error('Error deleting uploaded file:', unlinkError);
            }
          }
        }
      }

      res.status(500).json({
        success: false,
        message: '上傳附件時發生錯誤',
        error: error.message
      });
    }
  }

  // 刪除消息附件
  async deleteAttachment(req, res) {
    try {
      const { id, attachmentId } = req.params;
      const newsId = parseInt(id, 10);
      const attachId = parseInt(attachmentId, 10);

      // 驗證參數
      if (!id || id === 'undefined' || isNaN(newsId)) {
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      if (!attachmentId || attachmentId === 'undefined' || isNaN(attachId)) {
        return res.status(400).json({
          success: false,
          message: '無效的附件 ID'
        });
      }

      // 檢查消息是否存在
      const news = await knex('news').where('id', newsId).first();
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在'
        });
      }

      // 檢查附件是否存在
      const attachment = await knex('news_attachments')
        .where('id', attachId)
        .where('news_id', newsId)
        .first();
      
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: '附件不存在'
        });
      }

      // 檢查權限
      const [isManager, isHRMember] = await Promise.all([
        NewsGroup.isManager(req.user.id),
        User.isHRMember(req.user.id)
      ]);
      
      let canDelete = isManager || isHRMember || news.created_by_id === req.user.id || attachment.uploaded_by_id === req.user.id;
      
      if (!canDelete) {
        const newsGroupIds = news.group_ids || [];
        if (newsGroupIds.length > 0) {
          const accessibleGroups = await DepartmentGroup.getAccessibleForNews(req.user.id, false);
          const accessibleGroupIds = accessibleGroups.map(g => Number(g.id));
          const hasAccessToAllGroups = newsGroupIds.every(id => accessibleGroupIds.includes(Number(id)));
          canDelete = hasAccessToAllGroups;
        }
      }

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: '您沒有權限刪除此附件'
        });
      }

      // 刪除文件
      if (attachment.file_path && fs.existsSync(attachment.file_path)) {
        try {
          fs.unlinkSync(attachment.file_path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }

      // 刪除數據庫記錄
      await knex('news_attachments').where('id', attachId).del();

      res.json({
        success: true,
        message: '附件已刪除'
      });
    } catch (error) {
      console.error('Delete attachment error:', error);
      res.status(500).json({
        success: false,
        message: '刪除附件時發生錯誤',
        error: error.message
      });
    }
  }

  // 下載消息附件
  async downloadAttachment(req, res) {
    try {
      const { id, attachmentId } = req.params;
      const newsId = parseInt(id, 10);
      const attachId = parseInt(attachmentId, 10);

      // 驗證參數
      if (!id || id === 'undefined' || isNaN(newsId)) {
        return res.status(400).json({
          success: false,
          message: '無效的消息 ID'
        });
      }

      if (!attachmentId || attachmentId === 'undefined' || isNaN(attachId)) {
        return res.status(400).json({
          success: false,
          message: '無效的附件 ID'
        });
      }

      // 檢查消息是否存在並有權限查看
      const userId = req.user?.id || null;
      const news = await News.findById(newsId, userId);
      if (!news) {
        return res.status(404).json({
          success: false,
          message: '消息不存在或您沒有權限查看此消息'
        });
      }

      // 檢查附件是否存在
      const attachment = await knex('news_attachments')
        .where('id', attachId)
        .where('news_id', newsId)
        .first();
      
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: '附件不存在'
        });
      }

      // 檢查文件是否存在
      if (!attachment.file_path || !fs.existsSync(attachment.file_path)) {
        return res.status(404).json({
          success: false,
          message: '附件文件不存在'
        });
      }

      // 發送文件
      res.download(attachment.file_path, attachment.file_name, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              message: '下載附件時發生錯誤'
            });
          }
        }
      });
    } catch (error) {
      console.error('Download attachment error:', error);
      res.status(500).json({
        success: false,
        message: '下載附件時發生錯誤',
        error: error.message
      });
    }
  }
}

module.exports = new NewsController();

