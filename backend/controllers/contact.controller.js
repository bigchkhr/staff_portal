const UserContact = require('../database/models/UserContact');

class ContactController {
  // 獲取當前用戶的所有聯絡人
  async getContacts(req, res) {
    try {
      const contacts = await UserContact.findAll(req.user.id);
      res.json({ contacts });
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({ message: '獲取聯絡人列表時發生錯誤' });
    }
  }

  // 獲取單個聯絡人
  async getContact(req, res) {
    try {
      const { id } = req.params;
      const contact = await UserContact.findById(id, req.user.id);

      if (!contact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      res.json({ contact });
    } catch (error) {
      console.error('Get contact error:', error);
      res.status(500).json({ message: '獲取聯絡人時發生錯誤' });
    }
  }

  // 創建聯絡人
  async createContact(req, res) {
    try {
      const { name, company_name, department, position, emails, phones } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ message: '名稱不能為空' });
      }

      const contactData = {
        user_id: req.user.id,
        name: name.trim(),
        company_name: company_name?.trim() || null,
        department: department?.trim() || null,
        position: position?.trim() || null,
        emails: emails || [],
        phones: phones || []
      };

      const contact = await UserContact.create(contactData);
      res.status(201).json({ contact, message: '聯絡人創建成功' });
    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({ message: '創建聯絡人時發生錯誤' });
    }
  }

  // 更新聯絡人
  async updateContact(req, res) {
    try {
      const { id } = req.params;
      const { name, company_name, department, position, emails, phones } = req.body;

      // 檢查聯絡人是否存在且屬於當前用戶
      const existingContact = await UserContact.findById(id, req.user.id);
      if (!existingContact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      if (!name || name.trim() === '') {
        return res.status(400).json({ message: '名稱不能為空' });
      }

      const contactData = {
        name: name.trim(),
        company_name: company_name?.trim() || null,
        department: department?.trim() || null,
        position: position?.trim() || null,
        emails: emails || [],
        phones: phones || []
      };

      const contact = await UserContact.update(id, req.user.id, contactData);
      res.json({ contact, message: '聯絡人更新成功' });
    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({ message: '更新聯絡人時發生錯誤' });
    }
  }

  // 刪除聯絡人
  async deleteContact(req, res) {
    try {
      const { id } = req.params;

      // 檢查聯絡人是否存在且屬於當前用戶
      const existingContact = await UserContact.findById(id, req.user.id);
      if (!existingContact) {
        return res.status(404).json({ message: '聯絡人不存在' });
      }

      await UserContact.delete(id, req.user.id);
      res.json({ message: '聯絡人刪除成功' });
    } catch (error) {
      console.error('Delete contact error:', error);
      res.status(500).json({ message: '刪除聯絡人時發生錯誤' });
    }
  }
}

module.exports = new ContactController();
