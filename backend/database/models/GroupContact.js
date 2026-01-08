const knex = require('../../config/database');

class GroupContact {
  static async findAll(departmentGroupId) {
    const contacts = await knex('group_contacts')
      .where('department_group_id', departmentGroupId)
      .orderBy('name');
    return contacts.map(contact => this.formatContactRecord(contact));
  }

  static async findById(id) {
    const contact = await knex('group_contacts')
      .where('id', id)
      .first();
    return this.formatContactRecord(contact);
  }

  static async create(contactData) {
    // 處理 phone 數組
    const dataToInsert = { ...contactData };
    if (dataToInsert.phone && Array.isArray(dataToInsert.phone)) {
      // 過濾空值並轉換為數組格式
      const phoneArray = dataToInsert.phone.filter(p => p && p.trim() !== '');
      dataToInsert.phone = phoneArray.length > 0 ? phoneArray : null;
    } else if (dataToInsert.phone === '' || dataToInsert.phone === null) {
      dataToInsert.phone = null;
    }

    const [contact] = await knex('group_contacts')
      .insert(dataToInsert)
      .returning('*');
    return this.formatContactRecord(contact);
  }

  static async update(id, contactData) {
    // 處理 phone 數組
    const dataToUpdate = { ...contactData };
    if (dataToUpdate.phone && Array.isArray(dataToUpdate.phone)) {
      // 過濾空值並轉換為數組格式
      const phoneArray = dataToUpdate.phone.filter(p => p && p.trim() !== '');
      dataToUpdate.phone = phoneArray.length > 0 ? phoneArray : null;
    } else if (dataToUpdate.phone === '' || dataToUpdate.phone === null) {
      dataToUpdate.phone = null;
    }

    await knex('group_contacts')
      .where('id', id)
      .update(dataToUpdate);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('group_contacts')
      .where('id', id)
      .del();
  }

  // 解析 user_ids 數組的輔助函數
  static parseIntegerArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => Number(v)).filter((v) => !Number.isNaN(v));
    }
    if (typeof value === 'string') {
      return value
        .replace(/[{}]/g, '')
        .replace(/"/g, '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '')
        .map((v) => Number(v))
        .filter((v) => !Number.isNaN(v));
    }
    return [];
  }

  // 解析 phone 數組的輔助函數
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
      phone: this.parseStringArray(record.phone)
    };
  }

  // 檢查使用者是否屬於部門群組
  static async isGroupMember(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();
    
    if (!group) {
      return false;
    }

    const userIds = this.parseIntegerArray(group.user_ids);
    return userIds.includes(Number(userId));
  }

  // 檢查使用者是否可以瀏覽聯絡人（部門群組成員或授權群組成員）
  static async canViewContacts(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();
    
    if (!group) {
      return false;
    }

    // 檢查是否為部門群組成員
    const userIds = this.parseIntegerArray(group.user_ids);
    if (userIds.includes(Number(userId))) {
      return true;
    }

    // 檢查是否屬於任何一個授權群組（checker, approver_1, approver_2, approver_3）
    const delegationGroupIds = [
      group.checker_id,
      group.approver_1_id,
      group.approver_2_id,
      group.approver_3_id
    ].filter(id => id !== null && id !== undefined);

    if (delegationGroupIds.length === 0) {
      return false;
    }

    // 檢查使用者是否屬於任何一個授權群組
    const isInAnyDelegationGroup = await knex('delegation_groups')
      .whereIn('id', delegationGroupIds)
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .first();

    return !!isInAnyDelegationGroup;
  }

  // 檢查使用者是否屬於授權群組的批核成員
  static async isApproverMember(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();
    
    if (!group) {
      return false;
    }

    // 檢查使用者是否屬於任何一個授權群組（checker, approver_1, approver_2, approver_3）
    const delegationGroupIds = [
      group.checker_id,
      group.approver_1_id,
      group.approver_2_id,
      group.approver_3_id
    ].filter(id => id !== null && id !== undefined);

    if (delegationGroupIds.length === 0) {
      return false;
    }

    // 檢查使用者是否屬於任何一個授權群組
    const isInAnyDelegationGroup = await knex('delegation_groups')
      .whereIn('id', delegationGroupIds)
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .first();

    return !!isInAnyDelegationGroup;
  }
}

module.exports = GroupContact;

