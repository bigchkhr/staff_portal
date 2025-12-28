const Announcement = require('../database/models/Announcement');
const User = require('../database/models/User');
const knex = require('../config/database');
const path = require('path');
const fs = require('fs');

class AnnouncementController {
  // 獲取所有公告列表
  async getAllAnnouncements(req, res) {
    try {
      const announcements = await Announcement.findAll();
      res.json({ announcements });
    } catch (error) {
      console.error('Get all announcements error:', error);
      res.status(500).json({ message: '獲取公告列表時發生錯誤', error: error.message });
    }
  }

  // 獲取單個公告詳情（包含附件）
  async getAnnouncementById(req, res) {
    try {
      const { id } = req.params;
      const announcement = await Announcement.findById(id);
      
      if (!announcement) {
        return res.status(404).json({ message: '公告不存在' });
      }
      
      res.json({ announcement });
    } catch (error) {
      console.error('Get announcement by id error:', error);
      res.status(500).json({ message: '獲取公告詳情時發生錯誤', error: error.message });
    }
  }

  // HR Group 成員創建公告
  async createAnnouncement(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以創建公告' });
      }

      const { title, content, is_pinned } = req.body;

      if (!title || (typeof title === 'string' && title.trim() === '')) {
        return res.status(400).json({ message: '請輸入公告標題' });
      }

      if (!content || (typeof content === 'string' && content.trim() === '')) {
        return res.status(400).json({ message: '請輸入公告內容' });
      }

      // 處理 is_pinned：可能是 boolean、字符串 'true'/'false' 或字符串 '0'/'1'
      let pinnedValue = false;
      if (is_pinned !== undefined && is_pinned !== null) {
        if (typeof is_pinned === 'boolean') {
          pinnedValue = is_pinned;
        } else if (typeof is_pinned === 'string') {
          pinnedValue = is_pinned === 'true' || is_pinned === '1';
        } else {
          pinnedValue = Boolean(is_pinned);
        }
      }

      const announcementData = {
        title: typeof title === 'string' ? title.trim() : title,
        content: typeof content === 'string' ? content.trim() : content,
        created_by_id: req.user.id,
        is_pinned: pinnedValue
      };

      const announcement = await Announcement.create(announcementData);
      
      // 如果有上傳的文件，處理附件
      if (req.files && req.files.length > 0) {
        const attachmentPromises = req.files.map(file => {
          return knex('announcement_attachments').insert({
            announcement_id: announcement.id,
            file_name: file.filename,
            file_path: file.path,
            file_type: file.mimetype,
            file_size: file.size,
            uploaded_by_id: req.user.id
          });
        });
        
        await Promise.all(attachmentPromises);
      }

      // 返回包含附件的完整公告
      const fullAnnouncement = await Announcement.findById(announcement.id);

      res.status(201).json({
        message: '公告創建成功',
        announcement: fullAnnouncement
      });
    } catch (error) {
      console.error('Create announcement error:', error);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.error('Error deleting uploaded file:', unlinkError);
            }
          }
        });
      }

      res.status(500).json({ 
        message: '創建公告時發生錯誤',
        error: error.message 
      });
    }
  }

  // HR Group 成員更新公告
  async updateAnnouncement(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以更新公告' });
      }

      const { id } = req.params;
      const { title, content, is_pinned } = req.body;

      const announcement = await Announcement.findById(id);
      if (!announcement) {
        return res.status(404).json({ message: '公告不存在' });
      }

      const updateData = {};
      if (title !== undefined) {
        if (typeof title === 'string' && title.trim() === '') {
          return res.status(400).json({ message: '公告標題不能為空' });
        }
        updateData.title = typeof title === 'string' ? title.trim() : title;
      }
      if (content !== undefined) {
        if (typeof content === 'string' && content.trim() === '') {
          return res.status(400).json({ message: '公告內容不能為空' });
        }
        updateData.content = typeof content === 'string' ? content.trim() : content;
      }
      if (is_pinned !== undefined && is_pinned !== null) {
        if (typeof is_pinned === 'boolean') {
          updateData.is_pinned = is_pinned;
        } else if (typeof is_pinned === 'string') {
          updateData.is_pinned = is_pinned === 'true' || is_pinned === '1';
        } else {
          updateData.is_pinned = Boolean(is_pinned);
        }
      }

      await Announcement.update(id, updateData);
      const updatedAnnouncement = await Announcement.findById(id);

      res.json({
        message: '公告更新成功',
        announcement: updatedAnnouncement
      });
    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({ 
        message: '更新公告時發生錯誤',
        error: error.message 
      });
    }
  }

  // HR Group 成員刪除公告
  async deleteAnnouncement(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除公告' });
      }

      const { id } = req.params;
      
      // 獲取公告和附件信息
      const announcement = await Announcement.findById(id);
      if (!announcement) {
        return res.status(404).json({ message: '公告不存在' });
      }

      // 刪除附件文件
      if (announcement.attachments && announcement.attachments.length > 0) {
        announcement.attachments.forEach(attachment => {
          if (attachment.file_path && fs.existsSync(attachment.file_path)) {
            try {
              fs.unlinkSync(attachment.file_path);
            } catch (unlinkError) {
              console.error('Error deleting attachment file:', unlinkError);
            }
          }
        });
      }

      // 刪除公告（級聯刪除附件記錄）
      await Announcement.delete(id);

      res.json({ message: '公告刪除成功' });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({ 
        message: '刪除公告時發生錯誤',
        error: error.message 
      });
    }
  }

  // 上傳公告附件
  async uploadAttachment(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以上傳附件' });
      }

      const { id } = req.params;
      
      // 檢查公告是否存在
      const announcement = await Announcement.findById(id);
      if (!announcement) {
        // 刪除已上傳的文件
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            if (file.path && fs.existsSync(file.path)) {
              try {
                fs.unlinkSync(file.path);
              } catch (unlinkError) {
                console.error('Error deleting uploaded file:', unlinkError);
              }
            }
          });
        }
        return res.status(404).json({ message: '公告不存在' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: '請選擇要上傳的文件' });
      }

      // 保存附件記錄
      const attachmentPromises = req.files.map(file => {
        return knex('announcement_attachments').insert({
          announcement_id: parseInt(id),
          file_name: file.filename,
          file_path: file.path,
          file_type: file.mimetype,
          file_size: file.size,
          uploaded_by_id: req.user.id
        }).returning('*');
      });

      const attachments = await Promise.all(attachmentPromises);

      res.status(201).json({
        message: '附件上傳成功',
        attachments: attachments.map(a => a[0])
      });
    } catch (error) {
      console.error('Upload attachment error:', error);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          if (file.path && fs.existsSync(file.path)) {
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.error('Error deleting uploaded file:', unlinkError);
            }
          }
        });
      }

      res.status(500).json({ 
        message: '上傳附件時發生錯誤',
        error: error.message 
      });
    }
  }

  // 刪除附件
  async deleteAttachment(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除附件' });
      }

      const { attachmentId } = req.params;
      
      // 獲取附件信息
      const attachment = await knex('announcement_attachments')
        .where('id', attachmentId)
        .first();
      
      if (!attachment) {
        return res.status(404).json({ message: '附件不存在' });
      }

      // 刪除文件
      if (attachment.file_path && fs.existsSync(attachment.file_path)) {
        try {
          fs.unlinkSync(attachment.file_path);
        } catch (unlinkError) {
          console.error('Error deleting attachment file:', unlinkError);
        }
      }

      // 刪除附件記錄
      await knex('announcement_attachments').where('id', attachmentId).del();

      res.json({ message: '附件刪除成功' });
    } catch (error) {
      console.error('Delete attachment error:', error);
      res.status(500).json({ 
        message: '刪除附件時發生錯誤',
        error: error.message 
      });
    }
  }

  // 下載或預覽附件
  async downloadAttachment(req, res) {
    try {
      const { attachmentId } = req.params;
      const { view } = req.query; // 檢查是否為預覽模式
      
      // 獲取附件信息
      const attachment = await knex('announcement_attachments')
        .where('id', attachmentId)
        .first();
      
      if (!attachment) {
        return res.status(404).json({ message: '附件不存在' });
      }

      // 檢查文件是否存在
      if (!fs.existsSync(attachment.file_path)) {
        return res.status(404).json({ message: '文件不存在' });
      }

      // 如果是預覽模式（view=true），直接發送文件內容
      if (view === 'true') {
        const filePath = path.resolve(attachment.file_path);
        const fileExtension = path.extname(attachment.file_name).toLowerCase();
        
        // 設置正確的 Content-Type
        let contentType = attachment.file_type || 'application/octet-stream';
        if (!contentType || contentType === 'application/octet-stream') {
          // 根據文件擴展名推斷 MIME 類型
          const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff'
          };
          contentType = mimeTypes[fileExtension] || 'application/octet-stream';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
        
        // 發送文件流
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        
        fileStream.on('error', (err) => {
          console.error('File stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: '讀取文件時發生錯誤' });
          }
        });
      } else {
        // 下載模式：使用 res.download
        const originalName = attachment.file_name;
        res.download(attachment.file_path, originalName, (err) => {
          if (err) {
            console.error('Download error:', err);
            if (!res.headersSent) {
              res.status(500).json({ message: '下載文件時發生錯誤' });
            }
          }
        });
      }
    } catch (error) {
      console.error('Download attachment error:', error);
      res.status(500).json({ 
        message: '下載附件時發生錯誤',
        error: error.message 
      });
    }
  }
}

module.exports = new AnnouncementController();

