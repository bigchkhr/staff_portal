const knex = require('../../config/database');

class UserContact {
  static async findAll(userId) {
    const contacts = await knex('user_contacts')
      .where('user_id', userId)
      .orderBy('name');
    return contacts.map(contact => this.formatContactRecord(contact));
  }

  static async findById(id, userId) {
    const contact = await knex('user_contacts')
      .where('id', id)
      .where('user_id', userId)
      .first();
    return this.formatContactRecord(contact);
  }

  static async create(contactData) {
    // 處理 emails 和 phones 數組
    const dataToInsert = { ...contactData };
    
    if (dataToInsert.emails && Array.isArray(dataToInsert.emails)) {
      const emailArray = dataToInsert.emails.filter(e => e && e.trim() !== '');
      dataToInsert.emails = emailArray.length > 0 ? emailArray : null;
    } else if (dataToInsert.emails === '' || dataToInsert.emails === null) {
      dataToInsert.emails = null;
    }

    if (dataToInsert.phones && Array.isArray(dataToInsert.phones)) {
      const phoneArray = dataToInsert.phones.filter(p => p && p.trim() !== '');
      dataToInsert.phones = phoneArray.length > 0 ? phoneArray : null;
    } else if (dataToInsert.phones === '' || dataToInsert.phones === null) {
      dataToInsert.phones = null;
    }

    const [contact] = await knex('user_contacts')
      .insert(dataToInsert)
      .returning('*');
    return this.formatContactRecord(contact);
  }

  static async update(id, userId, contactData) {
    // 處理 emails 和 phones 數組
    const dataToUpdate = { ...contactData };
    
    if (dataToUpdate.emails && Array.isArray(dataToUpdate.emails)) {
      const emailArray = dataToUpdate.emails.filter(e => e && e.trim() !== '');
      dataToUpdate.emails = emailArray.length > 0 ? emailArray : null;
    } else if (dataToUpdate.emails === '' || dataToUpdate.emails === null) {
      dataToUpdate.emails = null;
    }

    if (dataToUpdate.phones && Array.isArray(dataToUpdate.phones)) {
      const phoneArray = dataToUpdate.phones.filter(p => p && p.trim() !== '');
      dataToUpdate.phones = phoneArray.length > 0 ? phoneArray : null;
    } else if (dataToUpdate.phones === '' || dataToUpdate.phones === null) {
      dataToUpdate.phones = null;
    }

    await knex('user_contacts')
      .where('id', id)
      .where('user_id', userId)
      .update(dataToUpdate);
    return await this.findById(id, userId);
  }

  static async delete(id, userId) {
    return await knex('user_contacts')
      .where('id', id)
      .where('user_id', userId)
      .del();
  }

  // 解析字符串數組的輔助函數
  static parseStringArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v)).filter((v) => v !== '');
    }
    if (typeof value === 'string') {
      return value
        .replace(/[{}]/g, '')
        .replace(/"/g, '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
    }
    return [];
  }

  // 格式化聯絡人記錄，解析數組欄位
  static formatContactRecord(record) {
    if (!record) {
      return record;
    }
    return {
      ...record,
      emails: this.parseStringArray(record.emails),
      phones: this.parseStringArray(record.phones)
    };
  }
}

module.exports = UserContact;
