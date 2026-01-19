const knex = require('../../config/database');

class MonthlyAttendanceSummary {
  // 取得所有月結記錄
  static async findAll(filters = {}) {
    try {
      let query = knex('monthly_attendance_summaries')
        .leftJoin('users', 'monthly_attendance_summaries.user_id', 'users.id')
        .leftJoin('users as creator', 'monthly_attendance_summaries.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'monthly_attendance_summaries.updated_by_id', 'updater.id')
        .select(
          'monthly_attendance_summaries.*',
          'users.employee_number',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'creator.display_name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.display_name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        );

      if (filters.user_id) {
        query = query.where('monthly_attendance_summaries.user_id', filters.user_id);
      }
      if (filters.year) {
        query = query.where('monthly_attendance_summaries.year', filters.year);
      }
      if (filters.month) {
        query = query.where('monthly_attendance_summaries.month', filters.month);
      }

      const results = await query.orderBy('monthly_attendance_summaries.year', 'desc')
        .orderBy('monthly_attendance_summaries.month', 'desc')
        .orderBy('users.employee_number', 'asc');

      return results.map(row => ({
        id: row.id,
        user_id: row.user_id,
        year: row.year,
        month: row.month,
        daily_data: row.daily_data || [],
        created_by_id: row.created_by_id,
        updated_by_id: row.updated_by_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          employee_number: row.employee_number,
          display_name: row.user_name,
          name_zh: row.user_name_zh
        },
        created_by: row.created_by_name || row.created_by_name_zh,
        updated_by: row.updated_by_name || row.updated_by_name_zh
      }));
    } catch (error) {
      console.error('Find all monthly attendance summaries error:', error);
      throw error;
    }
  }

  // 根據ID取得單一月結記錄
  static async findById(id) {
    try {
      const result = await knex('monthly_attendance_summaries')
        .leftJoin('users', 'monthly_attendance_summaries.user_id', 'users.id')
        .leftJoin('users as creator', 'monthly_attendance_summaries.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'monthly_attendance_summaries.updated_by_id', 'updater.id')
        .select(
          'monthly_attendance_summaries.*',
          'users.employee_number',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'creator.display_name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.display_name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        )
        .where('monthly_attendance_summaries.id', id)
        .first();

      if (!result) return null;

      return {
        id: result.id,
        user_id: result.user_id,
        year: result.year,
        month: result.month,
        daily_data: result.daily_data || [],
        created_by_id: result.created_by_id,
        updated_by_id: result.updated_by_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
        user: {
          employee_number: result.employee_number,
          display_name: result.user_name,
          name_zh: result.user_name_zh
        },
        created_by: result.created_by_name || result.created_by_name_zh,
        updated_by: result.updated_by_name || result.updated_by_name_zh
      };
    } catch (error) {
      console.error('Find monthly attendance summary by id error:', error);
      throw error;
    }
  }

  // 根據用戶、年份、月份取得月結記錄
  static async findByUserAndMonth(userId, year, month) {
    try {
      const result = await knex('monthly_attendance_summaries')
        .where('user_id', userId)
        .where('year', year)
        .where('month', month)
        .first();

      if (!result) return null;

      return {
        id: result.id,
        user_id: result.user_id,
        year: result.year,
        month: result.month,
        daily_data: result.daily_data || [],
        created_by_id: result.created_by_id,
        updated_by_id: result.updated_by_id,
        created_at: result.created_at,
        updated_at: result.updated_at
      };
    } catch (error) {
      console.error('Find monthly attendance summary by user and month error:', error);
      throw error;
    }
  }

  // 建立月結記錄
  static async create(data) {
    try {
      const result = await knex('monthly_attendance_summaries').insert({
        user_id: data.user_id,
        year: data.year,
        month: data.month,
        daily_data: JSON.stringify(data.daily_data || []),
        created_by_id: data.created_by_id,
        updated_by_id: data.updated_by_id
      }).returning('id');

      // returning('id') 返回數組，取第一個元素的 id 屬性
      let id;
      if (Array.isArray(result) && result.length > 0) {
        id = typeof result[0] === 'object' && result[0] !== null ? result[0].id : result[0];
      } else if (result && typeof result === 'object' && result.id) {
        id = result.id;
      } else {
        id = result;
      }

      // 確保 id 是數字
      id = typeof id === 'number' ? id : parseInt(id, 10);

      return await this.findById(id);
    } catch (error) {
      console.error('Create monthly attendance summary error:', error);
      throw error;
    }
  }

  // 更新月結記錄
  static async update(id, data) {
    try {
      const updateData = {};
      if (data.daily_data !== undefined) {
        updateData.daily_data = JSON.stringify(data.daily_data);
      }
      if (data.updated_by_id !== undefined) {
        updateData.updated_by_id = data.updated_by_id;
      }

      await knex('monthly_attendance_summaries')
        .where('id', id)
        .update(updateData);

      return await this.findById(id);
    } catch (error) {
      console.error('Update monthly attendance summary error:', error);
      throw error;
    }
  }

  // 更新或建立月結記錄（upsert）
  static async upsert(data) {
    try {
      const existing = await this.findByUserAndMonth(data.user_id, data.year, data.month);
      
      if (existing) {
        return await this.update(existing.id, {
          daily_data: data.daily_data,
          updated_by_id: data.updated_by_id
        });
      } else {
        return await this.create(data);
      }
    } catch (error) {
      console.error('Upsert monthly attendance summary error:', error);
      throw error;
    }
  }

  // 刪除月結記錄
  static async delete(id) {
    try {
      await knex('monthly_attendance_summaries').where('id', id).del();
      return true;
    } catch (error) {
      console.error('Delete monthly attendance summary error:', error);
      throw error;
    }
  }
}

module.exports = MonthlyAttendanceSummary;
