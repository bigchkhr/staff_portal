const knex = require('../../config/database');

class Schedule {
  // 取得所有排班記錄（可選篩選條件）
  static async findAll(filters = {}) {
    try {
      let query = knex('schedules')
        .leftJoin('users', 'schedules.user_id', 'users.id')
        .leftJoin('department_groups', 'schedules.department_group_id', 'department_groups.id')
        .leftJoin('users as creator', 'schedules.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'schedules.updated_by_id', 'updater.id')
        .select(
          'schedules.*',
          'users.name as user_name',
          'users.name_zh as user_name_zh',
          'users.employee_number',
          'department_groups.name as group_name',
          'department_groups.name_zh as group_name_zh',
          'creator.name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        );

      // 根據群組ID篩選
      if (filters.department_group_id) {
        query = query.where('schedules.department_group_id', filters.department_group_id);
      }

      // 根據用戶ID篩選
      if (filters.user_id) {
        query = query.where('schedules.user_id', filters.user_id);
      }

      // 根據日期範圍篩選
      if (filters.start_date) {
        query = query.where('schedules.schedule_date', '>=', filters.start_date);
      }
      if (filters.end_date) {
        query = query.where('schedules.schedule_date', '<=', filters.end_date);
      }

      // 根據日期篩選
      if (filters.schedule_date) {
        query = query.where('schedules.schedule_date', filters.schedule_date);
      }

      const results = await query.orderBy('schedules.schedule_date', 'desc')
        .orderBy('users.employee_number');
      
      // 確保返回空數組而不是 undefined
      return results || [];
    } catch (error) {
      console.error('Schedule.findAll query error:', error);
      throw error;
    }
  }

  // 根據ID取得單一記錄
  static async findById(id) {
    try {
      const result = await knex('schedules')
        .leftJoin('users', 'schedules.user_id', 'users.id')
        .leftJoin('department_groups', 'schedules.department_group_id', 'department_groups.id')
        .leftJoin('users as creator', 'schedules.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'schedules.updated_by_id', 'updater.id')
        .select(
          'schedules.*',
          'users.name as user_name',
          'users.name_zh as user_name_zh',
          'users.employee_number',
          'department_groups.name as group_name',
          'department_groups.name_zh as group_name_zh',
          'creator.name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        )
        .where('schedules.id', id)
        .first();
      return result || null;
    } catch (error) {
      console.error('Schedule.findById error:', error);
      throw error;
    }
  }

  // 建立排班記錄
  static async create(scheduleData) {
    const [schedule] = await knex('schedules')
      .insert(scheduleData)
      .returning('*');
    return await this.findById(schedule.id);
  }

  // 批量建立排班記錄
  static async createBatch(schedulesData) {
    if (!schedulesData || schedulesData.length === 0) {
      return [];
    }

    // 使用 upsert 邏輯：如果已存在則更新，否則插入
    const results = [];
    for (const scheduleData of schedulesData) {
      const existing = await knex('schedules')
        .where({
          user_id: scheduleData.user_id,
          schedule_date: scheduleData.schedule_date
        })
        .first();

      if (existing) {
        // 更新現有記錄
        await knex('schedules')
          .where('id', existing.id)
          .update({
            is_morning_leave: scheduleData.is_morning_leave,
            is_afternoon_leave: scheduleData.is_afternoon_leave,
            updated_by_id: scheduleData.updated_by_id || scheduleData.created_by_id,
            updated_at: knex.fn.now()
          });
        results.push(await this.findById(existing.id));
      } else {
        // 插入新記錄
        results.push(await this.create(scheduleData));
      }
    }

    return results;
  }

  // 更新排班記錄
  static async update(id, scheduleData) {
    await knex('schedules')
      .where('id', id)
      .update(scheduleData);
    return await this.findById(id);
  }

  // 刪除排班記錄
  static async delete(id) {
    return await knex('schedules').where('id', id).del();
  }

  // 批量刪除排班記錄
  static async deleteBatch(filters) {
    let query = knex('schedules');

    if (filters.user_id) {
      query = query.where('user_id', filters.user_id);
    }
    if (filters.department_group_id) {
      query = query.where('department_group_id', filters.department_group_id);
    }
    if (filters.start_date) {
      query = query.where('schedule_date', '>=', filters.start_date);
    }
    if (filters.end_date) {
      query = query.where('schedule_date', '<=', filters.end_date);
    }
    if (filters.schedule_date) {
      query = query.where('schedule_date', filters.schedule_date);
    }

    return await query.del();
  }

  // 檢查用戶是否屬於指定群組
  static async isUserInGroup(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();
    
    if (!group || !group.user_ids) {
      return false;
    }

    // 解析 user_ids 數組
    let userIds = group.user_ids;
    if (typeof userIds === 'string') {
      userIds = userIds.replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
    }

    return Array.isArray(userIds) && userIds.includes(Number(userId));
  }

  // 檢查用戶是否為批核成員（checker, approver_1, approver_2, approver_3）
  static async canEditSchedule(userId, departmentGroupId) {
    const group = await knex('department_groups')
      .where('id', departmentGroupId)
      .first();

    if (!group) {
      return false;
    }

    // 取得用戶所屬的授權群組
    const delegationGroups = await knex('delegation_groups')
      .whereRaw('? = ANY(delegation_groups.user_ids)', [Number(userId)])
      .select('id');

    const delegationGroupIds = delegationGroups.map(g => Number(g.id));

    // 檢查是否為 checker, approver_1, approver_2, 或 approver_3
    const isChecker = group.checker_id && delegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id));

    return isChecker || isApprover1 || isApprover2 || isApprover3;
  }
}

module.exports = Schedule;
