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

class DepartmentGroup {
  static async findAll() {
    const groups = await knex('department_groups')
      .leftJoin('delegation_groups as checker', 'department_groups.checker_id', 'checker.id')
      .leftJoin('delegation_groups as approver_1', 'department_groups.approver_1_id', 'approver_1.id')
      .leftJoin('delegation_groups as approver_2', 'department_groups.approver_2_id', 'approver_2.id')
      .leftJoin('delegation_groups as approver_3', 'department_groups.approver_3_id', 'approver_3.id')
      .select(
        'department_groups.*',
        'checker.name as checker_name',
        'checker.name_zh as checker_name_zh',
        'approver_1.name as approver_1_name',
        'approver_1.name_zh as approver_1_name_zh',
        'approver_2.name as approver_2_name',
        'approver_2.name_zh as approver_2_name_zh',
        'approver_3.name as approver_3_name',
        'approver_3.name_zh as approver_3_name_zh'
      )
      .orderBy('department_groups.name');

    return groups.map(formatGroupRecord);
  }

  static async findById(id) {
    const group = await knex('department_groups')
      .leftJoin('delegation_groups as checker', 'department_groups.checker_id', 'checker.id')
      .leftJoin('delegation_groups as approver_1', 'department_groups.approver_1_id', 'approver_1.id')
      .leftJoin('delegation_groups as approver_2', 'department_groups.approver_2_id', 'approver_2.id')
      .leftJoin('delegation_groups as approver_3', 'department_groups.approver_3_id', 'approver_3.id')
      .select(
        'department_groups.*',
        'checker.name as checker_name',
        'checker.name_zh as checker_name_zh',
        'approver_1.name as approver_1_name',
        'approver_1.name_zh as approver_1_name_zh',
        'approver_2.name as approver_2_name',
        'approver_2.name_zh as approver_2_name_zh',
        'approver_3.name as approver_3_name',
        'approver_3.name_zh as approver_3_name_zh'
      )
      .where('department_groups.id', id)
      .first();

    return formatGroupRecord(group);
  }

  static async create(groupData) {
    const [group] = await knex('department_groups').insert(groupData).returning('*');
    return await this.findById(group.id);
  }

  static async update(id, groupData) {
    await knex('department_groups').where('id', id).update(groupData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('department_groups').where('id', id).del();
  }

  // 新增使用者到部門群組
  static async addUser(groupId, userId) {
    const group = await knex('department_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('部門群組不存在');
    }

    const userIds = parseIntegerArray(group.user_ids);
    const numericUserId = Number(userId);

    if (!userIds.includes(numericUserId)) {
      await knex('department_groups')
        .where('id', groupId)
        .update({
          user_ids: knex.raw('array_append(user_ids, ?)', [numericUserId]),
        });
    }

    return await this.findById(groupId);
  }

  // 從部門群組移除使用者
  static async removeUser(groupId, userId) {
    const group = await knex('department_groups').where('id', groupId).first();
    if (!group) {
      throw new Error('部門群組不存在');
    }

    const numericUserId = Number(userId);

    await knex('department_groups')
      .where('id', groupId)
      .update({
        user_ids: knex.raw('array_remove(user_ids, ?)', [numericUserId]),
      });

    return await this.findById(groupId);
  }

  // 取得部門群組的所有成員
  static async getMembers(groupId) {
    const group = await knex('department_groups').where('id', groupId).first();
    const parsedGroup = formatGroupRecord(group);

    if (!parsedGroup || parsedGroup.user_ids.length === 0) {
      return [];
    }

    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh'
      )
      .whereIn('users.id', parsedGroup.user_ids);
  }

  // 取得使用者所屬的部門群組
  static async findByUserId(userId) {
    const groups = await knex('department_groups')
      .whereRaw('? = ANY(department_groups.user_ids)', [userId])
      .leftJoin('delegation_groups as checker', 'department_groups.checker_id', 'checker.id')
      .leftJoin('delegation_groups as approver_1', 'department_groups.approver_1_id', 'approver_1.id')
      .leftJoin('delegation_groups as approver_2', 'department_groups.approver_2_id', 'approver_2.id')
      .leftJoin('delegation_groups as approver_3', 'department_groups.approver_3_id', 'approver_3.id')
      .select(
        'department_groups.*',
        'checker.name as checker_name',
        'checker.name_zh as checker_name_zh',
        'approver_1.name as approver_1_name',
        'approver_1.name_zh as approver_1_name_zh',
        'approver_2.name as approver_2_name',
        'approver_2.name_zh as approver_2_name_zh',
        'approver_3.name as approver_3_name',
        'approver_3.name_zh as approver_3_name_zh'
      );
    
    return groups;
  }

  // 取得部門群組的批核流程
  static async getApprovalFlow(groupId) {
    const group = await this.findById(groupId);
    if (!group) {
      throw new Error('部門群組不存在');
    }

    const flow = [];
    
    // Checker
    if (group.checker_id) {
      flow.push({
        level: 'checker',
        delegation_group_id: group.checker_id,
        delegation_group_name: group.checker_name,
        delegation_group_name_zh: group.checker_name_zh
      });
    }
    
    // Approver 1
    if (group.approver_1_id) {
      flow.push({
        level: 'approver_1',
        delegation_group_id: group.approver_1_id,
        delegation_group_name: group.approver_1_name,
        delegation_group_name_zh: group.approver_1_name_zh
      });
    }
    
    // Approver 2
    if (group.approver_2_id) {
      flow.push({
        level: 'approver_2',
        delegation_group_id: group.approver_2_id,
        delegation_group_name: group.approver_2_name,
        delegation_group_name_zh: group.approver_2_name_zh
      });
    }
    
    // Approver 3
    if (group.approver_3_id) {
      flow.push({
        level: 'approver_3',
        delegation_group_id: group.approver_3_id,
        delegation_group_name: group.approver_3_name,
        delegation_group_name_zh: group.approver_3_name_zh
      });
    }
    
    return flow;
  }
}

module.exports = DepartmentGroup;

