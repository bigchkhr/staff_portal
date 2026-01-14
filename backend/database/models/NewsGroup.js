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

class NewsGroup {
  static async findAll(closedFilter) {
    let query = knex('news_groups').select('*');

    // 根據 closed 參數篩選
    if (closedFilter !== undefined && closedFilter !== null && closedFilter !== '') {
      const isClosed = closedFilter === 'true' || closedFilter === true;
      query = query.where('closed', isClosed);
    }

    const groups = await query.orderBy('name');
    return groups.map(formatGroupRecord);
  }

  static async findById(id) {
    const group = await knex('news_groups').where('id', id).first();
    return formatGroupRecord(group);
  }

  static async create(groupData) {
    const [group] = await knex('news_groups').insert(groupData).returning('*');
    return await this.findById(group.id);
  }

  static async update(id, groupData) {
    await knex('news_groups').where('id', id).update(groupData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('news_groups').where('id', id).del();
  }

  // 新增使用者到群組
  static async addUser(groupId, userId) {
    const group = await knex('news_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('消息群組不存在');
    }

    const userIds = parseIntegerArray(group.user_ids);
    const numericUserId = Number(userId);

    if (!userIds.includes(numericUserId)) {
      await knex('news_groups')
        .where('id', groupId)
        .update({
          user_ids: knex.raw('array_append(user_ids, ?)', [numericUserId]),
        });
    }

    return await this.findById(groupId);
  }

  // 從群組移除使用者
  static async removeUser(groupId, userId) {
    const group = await knex('news_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('消息群組不存在');
    }

    const numericUserId = Number(userId);

    await knex('news_groups')
      .where('id', groupId)
      .update({
        user_ids: knex.raw('array_remove(user_ids, ?)', [numericUserId]),
      });

    return await this.findById(groupId);
  }

  // 取得群組的所有成員
  static async getMembers(groupId) {
    try {
      const group = await knex('news_groups').where('id', groupId).first();
      
      if (!group) {
        console.log(`[getMembers] 群組 ID ${groupId} 不存在`);
        return [];
      }

      const parsedGroup = formatGroupRecord(group);

      if (!parsedGroup || !parsedGroup.user_ids || !Array.isArray(parsedGroup.user_ids) || parsedGroup.user_ids.length === 0) {
        console.log(`[getMembers] 群組 ID ${groupId} 沒有成員，user_ids:`, parsedGroup?.user_ids);
        return [];
      }

      // 確保所有 user_ids 都是有效的數字
      const validUserIds = parsedGroup.user_ids
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id > 0);

      if (validUserIds.length === 0) {
        console.log(`[getMembers] 群組 ID ${groupId} 沒有有效的成員 ID`);
        return [];
      }

      const members = await knex('users')
        .whereIn('users.id', validUserIds)
        .leftJoin('departments', 'users.department_id', 'departments.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .select(
          'users.*',
          'departments.name as department_name',
          'departments.name_zh as department_name_zh',
          'positions.name as position_name',
          'positions.name_zh as position_name_zh'
        );

      return members || [];
    } catch (error) {
      console.error(`[getMembers] 獲取群組 ID ${groupId} 的成員時發生錯誤:`, error);
      console.error('錯誤堆疊:', error.stack);
      throw error;
    }
  }

  // 取得使用者所屬的消息群組
  static async findByUserId(userId) {
    const groups = await knex('news_groups')
      .whereRaw('? = ANY(news_groups.user_ids)', [userId])
      .select('*');
    
    return groups.map(formatGroupRecord);
  }

  // 檢查用戶是否為群組管理員
  static async isManager(userId) {
    const manager = await knex('news_group_managers')
      .where('user_id', userId)
      .first();
    return !!manager;
  }

  // 獲取所有群組管理員
  static async getManagers() {
    const managers = await knex('news_group_managers')
      .leftJoin('users', 'news_group_managers.user_id', 'users.id')
      .select(
        'news_group_managers.*',
        'users.employee_number',
        'users.display_name',
        'users.email'
      );
    return managers;
  }

  // 添加群組管理員
  static async addManager(userId) {
    // 檢查是否已經是管理員
    const existing = await knex('news_group_managers')
      .where('user_id', userId)
      .first();
    
    if (existing) {
      return existing;
    }

    const [manager] = await knex('news_group_managers')
      .insert({ user_id: userId })
      .returning('*');
    
    return manager;
  }

  // 移除群組管理員
  static async removeManager(userId) {
    return await knex('news_group_managers')
      .where('user_id', userId)
      .del();
  }
}

module.exports = NewsGroup;

