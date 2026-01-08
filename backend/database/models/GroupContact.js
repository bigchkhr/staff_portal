const knex = require('../../config/database');

class GroupContact {
  static async findAll(departmentGroupId) {
    return await knex('group_contacts')
      .where('department_group_id', departmentGroupId)
      .orderBy('name');
  }

  static async findById(id) {
    return await knex('group_contacts')
      .where('id', id)
      .first();
  }

  static async create(contactData) {
    const [contact] = await knex('group_contacts')
      .insert(contactData)
      .returning('*');
    return contact;
  }

  static async update(id, contactData) {
    await knex('group_contacts')
      .where('id', id)
      .update(contactData);
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

