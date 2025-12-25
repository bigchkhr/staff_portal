const EmployeeDocument = require('../database/models/EmployeeDocument');
const User = require('../database/models/User');
const path = require('path');
const fs = require('fs');

// 允許的文件類別
const ALLOWED_CATEGORIES = [
  'Salary Advice',
  'IR56B',
  'IR56F',
  'IR56G',
  'Others'
];

class DocumentController {
  // HR成員上傳文件給指定員工
  async uploadDocument(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以上傳文件' });
      }

      if (!req.file) {
        return res.status(400).json({ message: '請選擇要上傳的文件' });
      }

      const { user_id, display_name, category, visible_to_uploader, visible_to_recipient } = req.body;

      if (!user_id) {
        // 刪除已上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: '請指定接收文件的員工' });
      }

      if (!display_name || display_name.trim() === '') {
        // 刪除已上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: '請輸入文件顯示名稱' });
      }

      // 檢查接收文件的員工是否存在
      const recipient = await User.findById(user_id);
      if (!recipient) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: '指定的員工不存在' });
      }

      // 驗證類別值
      let validatedCategory = null;
      if (category && category.trim() !== '') {
        const trimmedCategory = category.trim();
        if (ALLOWED_CATEGORIES.includes(trimmedCategory)) {
          validatedCategory = trimmedCategory;
        } else {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: `無效的文件類別。允許的類別：${ALLOWED_CATEGORIES.join(', ')}` });
        }
      }

      const documentData = {
        user_id: parseInt(user_id),
        file_name: req.file.filename,
        display_name: display_name.trim(),
        category: validatedCategory,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        visible_to_recipient: visible_to_recipient !== undefined 
          ? (visible_to_recipient === 'true' || visible_to_recipient === true)
          : true, // 默認對員工可見
        uploaded_by_id: req.user.id
      };

      const document = await EmployeeDocument.create(documentData);

      res.status(201).json({
        message: '文件上傳成功',
        document
      });
    } catch (error) {
      console.error('Upload document error:', error);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({ 
        message: '上傳文件時發生錯誤',
        error: error.message 
      });
    }
  }

  // 獲取員工的文件列表（員工自己查看）
  async getMyDocuments(req, res) {
    try {
      const { category, search } = req.query;
      
      const options = {
        user_id: req.user.id,
        category: category || null,
        search: search || null
      };

      // 獲取所有發送給該員工的文件
      const allDocuments = await EmployeeDocument.findAll(options);
      
      // 只返回對員工可見的文件（visible_to_recipient 為 true）
      const documents = allDocuments.filter(doc => doc.visible_to_recipient === true || doc.visible_to_recipient === 1);
      
      res.json({ documents });
    } catch (error) {
      console.error('Get my documents error:', error);
      res.status(500).json({ message: '獲取文件列表時發生錯誤' });
    }
  }

  // HR成員獲取所有上傳的文件列表
  async getAllDocuments(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以查看所有文件' });
      }

      const { user_id, category, search, uploaded_by_id } = req.query;
      
      const options = {
        user_id: user_id || null,
        category: category || null,
        search: search || null,
        uploaded_by_id: uploaded_by_id || null
      };

      // HR成員可以看到所有文件，根據過濾條件篩選
      const documents = await EmployeeDocument.findAll(options);
      res.json({ documents });
    } catch (error) {
      console.error('Get all documents error:', error);
      res.status(500).json({ message: '獲取文件列表時發生錯誤' });
    }
  }

  // 下載文件
  async downloadDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await EmployeeDocument.findById(id);

      if (!document) {
        return res.status(404).json({ message: '文件不存在' });
      }

      // 檢查權限：
      // - HR成員可以下載所有文件
      // - 員工只能下載自己的文件，且該文件必須對其可見
      const isHRMember = await User.isHRMember(req.user.id);
      const isOwner = document.user_id === req.user.id;
      const isVisible = document.visible_to_recipient === true || document.visible_to_recipient === 1;

      if (isHRMember) {
        // HR成員可以下載所有文件
      } else if (isOwner && isVisible) {
        // 員工可以下載自己的可見文件
      } else {
        return res.status(403).json({ message: '您沒有權限下載此文件' });
      }

      const filePath = path.resolve(document.file_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: '文件不存在於伺服器' });
      }

      // 構建下載文件名
      const fileExtension = path.extname(document.file_name);
      const downloadFileName = `${document.display_name}${fileExtension}`;

      // 使用 res.download 自動處理文件下載（設置正確的Content-Disposition和Content-Type）
      res.download(filePath, downloadFileName, (err) => {
        if (err) {
          console.error('Download file error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: '下載文件時發生錯誤' });
          }
        }
      });
    } catch (error) {
      console.error('Download document error:', error);
      res.status(500).json({ message: '下載文件時發生錯誤' });
    }
  }

  // 刪除文件（HR成員可以刪除，員工不能刪除）
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await EmployeeDocument.findById(id);

      if (!document) {
        return res.status(404).json({ message: '文件不存在' });
      }

      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除文件' });
      }

      // 刪除文件
      const filePath = path.resolve(document.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 刪除數據庫記錄
      await EmployeeDocument.delete(id);

      res.json({ message: '文件已刪除' });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(500).json({ message: '刪除文件時發生錯誤' });
    }
  }

  // 更新文件信息（HR成員可以更新）
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await EmployeeDocument.findById(id);

      if (!document) {
        return res.status(404).json({ message: '文件不存在' });
      }

      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以更新文件' });
      }

      const { display_name, category, visible_to_recipient } = req.body;
      const updateData = {};

      if (display_name !== undefined) {
        if (!display_name || display_name.trim() === '') {
          return res.status(400).json({ message: '文件顯示名稱不能為空' });
        }
        updateData.display_name = display_name.trim();
      }

      if (category !== undefined) {
        if (category === null || category === '' || category.trim() === '') {
          updateData.category = null;
        } else {
          const trimmedCategory = category.trim();
          if (ALLOWED_CATEGORIES.includes(trimmedCategory)) {
            updateData.category = trimmedCategory;
          } else {
            return res.status(400).json({ message: `無效的文件類別。允許的類別：${ALLOWED_CATEGORIES.join(', ')}` });
          }
        }
      }

      if (visible_to_recipient !== undefined) {
        updateData.visible_to_recipient = visible_to_recipient === 'true' || visible_to_recipient === true;
      }

      const updatedDocument = await EmployeeDocument.update(id, updateData);

      res.json({
        message: '文件信息更新成功',
        document: updatedDocument
      });
    } catch (error) {
      console.error('Update document error:', error);
      res.status(500).json({ message: '更新文件信息時發生錯誤' });
    }
  }

  // 獲取所有文件類別
  async getCategories(req, res) {
    try {
      const categories = await EmployeeDocument.getCategories();
      res.json({ categories });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ message: '獲取文件類別時發生錯誤' });
    }
  }
}

module.exports = new DocumentController();

