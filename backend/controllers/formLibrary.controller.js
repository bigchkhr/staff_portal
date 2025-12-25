const FormLibrary = require('../database/models/FormLibrary');
const User = require('../database/models/User');
const path = require('path');
const fs = require('fs');

class FormLibraryController {
  // HR成員上傳表單
  async uploadForm(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以上傳表單' });
      }

      if (!req.file) {
        return res.status(400).json({ message: '請選擇要上傳的文件' });
      }

      const { display_name, description, visible_to_users } = req.body;

      if (!display_name || display_name.trim() === '') {
        // 刪除已上傳的文件
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: '請輸入表單顯示名稱' });
      }

      const formData = {
        display_name: display_name.trim(),
        file_name: req.file.filename,
        file_path: req.file.path,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        visible_to_users: visible_to_users !== undefined 
          ? (visible_to_users === 'true' || visible_to_users === true)
          : true, // 默認對用戶可見
        uploaded_by_id: req.user.id,
        description: description ? description.trim() : null
      };

      const form = await FormLibrary.create(formData);

      res.status(201).json({
        message: '表單上傳成功',
        form
      });
    } catch (error) {
      console.error('Upload form error:', error);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({ 
        message: '上傳表單時發生錯誤',
        error: error.message 
      });
    }
  }

  // 獲取所有表單列表（用戶端：只顯示可見的，HR：顯示所有）
  async getAllForms(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      
      const { search } = req.query;
      
      const options = {
        onlyVisible: !isHRMember, // HR可以看所有，一般用戶只能看可見的
        search: search || null
      };

      const forms = await FormLibrary.findAll(options);
      res.json({ forms });
    } catch (error) {
      console.error('Get all forms error:', error);
      res.status(500).json({ message: '獲取表單列表時發生錯誤' });
    }
  }

  // 下載表單
  async downloadForm(req, res) {
    try {
      const { id } = req.params;
      const form = await FormLibrary.findById(id);

      if (!form) {
        return res.status(404).json({ message: '表單不存在' });
      }

      // 檢查權限：如果表單不可見，只有HR可以下載
      if (!form.visible_to_users) {
        const isHRMember = await User.isHRMember(req.user.id);
        if (!isHRMember) {
          return res.status(403).json({ message: '您沒有權限下載此表單' });
        }
      }

      const filePath = path.resolve(form.file_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: '文件不存在於伺服器' });
      }

      // 構建下載文件名
      const fileExtension = path.extname(form.file_name);
      const downloadFileName = `${form.display_name}${fileExtension}`;

      // 使用 res.download 自動處理文件下載
      res.download(filePath, downloadFileName, (err) => {
        if (err) {
          console.error('Download file error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: '下載表單時發生錯誤' });
          }
        }
      });
    } catch (error) {
      console.error('Download form error:', error);
      res.status(500).json({ message: '下載表單時發生錯誤' });
    }
  }

  // 刪除表單（僅HR成員）
  async deleteForm(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除表單' });
      }

      const { id } = req.params;
      const form = await FormLibrary.findById(id);

      if (!form) {
        return res.status(404).json({ message: '表單不存在' });
      }

      // 刪除文件
      const filePath = path.resolve(form.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 刪除數據庫記錄
      await FormLibrary.delete(id);

      res.json({ message: '表單已刪除' });
    } catch (error) {
      console.error('Delete form error:', error);
      res.status(500).json({ message: '刪除表單時發生錯誤' });
    }
  }

  // 更新表單信息（僅HR成員）
  async updateForm(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以更新表單' });
      }

      const { id } = req.params;
      const form = await FormLibrary.findById(id);

      if (!form) {
        return res.status(404).json({ message: '表單不存在' });
      }

      const { display_name, description, visible_to_users } = req.body;
      const updateData = {};

      if (display_name !== undefined) {
        if (!display_name || display_name.trim() === '') {
          return res.status(400).json({ message: '表單顯示名稱不能為空' });
        }
        updateData.display_name = display_name.trim();
      }

      if (description !== undefined) {
        updateData.description = description === null || description === '' ? null : description.trim();
      }

      if (visible_to_users !== undefined) {
        updateData.visible_to_users = visible_to_users === 'true' || visible_to_users === true;
      }

      const updatedForm = await FormLibrary.update(id, updateData);

      res.json({
        message: '表單信息更新成功',
        form: updatedForm
      });
    } catch (error) {
      console.error('Update form error:', error);
      res.status(500).json({ message: '更新表單信息時發生錯誤' });
    }
  }
}

module.exports = new FormLibraryController();

