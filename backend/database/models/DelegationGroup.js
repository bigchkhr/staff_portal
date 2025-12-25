const knex = require('../../config/database');

const parseIntegerArray = (value) => {
  if (!value) {
    return [];
  }

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
};

const formatGroupRecord = (record) => {
  if (!record) {
    return record;
  }

  return {
    ...record,
    user_ids: parseIntegerArray(record.user_ids),
  };
};

class DelegationGroup {
  static async findAll() {
    const groups = await knex('delegation_groups').orderBy('name');
    return groups.map(formatGroupRecord);
  }

  static async findById(id) {
    const group = await knex('delegation_groups').where('id', id).first();
    return formatGroupRecord(group);
  }

  static async create(groupData) {
    const [group] = await knex('delegation_groups').insert(groupData).returning('*');
    return formatGroupRecord(group);
  }

  static async update(id, groupData) {
    await knex('delegation_groups').where('id', id).update(groupData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('delegation_groups').where('id', id).del();
  }

  // 新增使用者到授權群組
  static async addUser(groupId, userId) {
    const group = await knex('delegation_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('授權群組不存在');
    }

    const userIds = parseIntegerArray(group.user_ids);
    const numericUserId = Number(userId);

    if (!userIds.includes(numericUserId)) {
      await knex('delegation_groups')
        .where('id', groupId)
        .update({
          user_ids: knex.raw('array_append(user_ids, ?)', [numericUserId]),
        });
    }

    return await this.findById(groupId);
  }

  // 從授權群組移除使用者
  static async removeUser(groupId, userId) {
    const group = await knex('delegation_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('授權群組不存在');
    }

    const numericUserId = Number(userId);

    await knex('delegation_groups')
      .where('id', groupId)
      .update({
        user_ids: knex.raw('array_remove(user_ids, ?)', [numericUserId]),
      });

    return await this.findById(groupId);
  }

  // 取得授權群組的所有成員
  static async getMembers(groupId) {
    const group = await knex('delegation_groups').where('id', groupId).first();
    const parsedGroup = formatGroupRecord(group);

    if (!parsedGroup || parsedGroup.user_ids.length === 0) {
      return [];
    }

    return await knex('users')
      .whereIn('users.id', parsedGroup.user_ids)
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      );
  }

  // 檢查使用者是否在授權群組中
  static async hasUser(groupId, userId) {
    const group = await this.findById(groupId);
    if (!group) {
      return false;
    }

    return group.user_ids.includes(Number(userId));
  }
}

module.exports = DelegationGroup;

