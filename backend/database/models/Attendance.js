const knex = require('../../config/database');

class Attendance {
  // 取得所有考勤記錄（可選篩選條件）
  static async findAll(filters = {}) {
    try {
      let query = knex('attendances')
        .leftJoin('users', 'attendances.user_id', 'users.id')
        .leftJoin('department_groups', 'attendances.department_group_id', 'department_groups.id')
        .leftJoin('departments', 'users.department_id', 'departments.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .select(
          'attendances.*',
          'users.employee_number',
          'users.display_name',
          'users.name_zh',
          'users.surname',
          'users.given_name',
          'department_groups.name as department_group_name',
          'department_groups.name_zh as department_group_name_zh',
          'departments.name as department_name',
          'departments.name_zh as department_name_zh',
          'positions.code as position_code',
          'positions.name as position_name',
          'positions.name_zh as position_name_zh'
        );

      if (filters.user_id) {
        query = query.where('attendances.user_id', filters.user_id);
      }

      if (filters.department_group_id) {
        query = query.where('attendances.department_group_id', filters.department_group_id);
      }

      if (filters.start_date) {
        query = query.where('attendances.attendance_date', '>=', filters.start_date);
      }

      if (filters.end_date) {
        query = query.where('attendances.attendance_date', '<=', filters.end_date);
      }

      if (filters.attendance_date) {
        query = query.where('attendances.attendance_date', filters.attendance_date);
      }

      if (filters.status) {
        query = query.where('attendances.status', filters.status);
      }

      return await query.orderBy('attendances.attendance_date', 'desc')
        .orderBy('users.employee_number', 'asc');
    } catch (error) {
      console.error('Attendance.findAll error:', error);
      throw error;
    }
  }

  // 根據ID取得單一記錄
  static async findById(id) {
    try {
      const result = await knex('attendances')
        .leftJoin('users', 'attendances.user_id', 'users.id')
        .leftJoin('department_groups', 'attendances.department_group_id', 'department_groups.id')
        .leftJoin('departments', 'users.department_id', 'departments.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .select(
          'attendances.*',
          'users.employee_number',
          'users.display_name',
          'users.name_zh',
          'users.surname',
          'users.given_name',
          'department_groups.name as department_group_name',
          'department_groups.name_zh as department_group_name_zh',
          'departments.name as department_name',
          'departments.name_zh as department_name_zh',
          'positions.code as position_code',
          'positions.name as position_name',
          'positions.name_zh as position_name_zh'
        )
        .where('attendances.id', id)
        .first();

      return result;
    } catch (error) {
      console.error('Attendance.findById error:', error);
      throw error;
    }
  }

  // 建立考勤記錄
  static async create(attendanceData) {
    try {
      const [attendance] = await knex('attendances')
        .insert(attendanceData)
        .returning('*');
      return await this.findById(attendance.id);
    } catch (error) {
      console.error('Attendance.create error:', error);
      throw error;
    }
  }

  // 更新考勤記錄
  static async update(id, attendanceData) {
    try {
      await knex('attendances')
        .where('id', id)
        .update({
          ...attendanceData,
          updated_at: knex.fn.now()
        });
      return await this.findById(id);
    } catch (error) {
      console.error('Attendance.update error:', error);
      throw error;
    }
  }

  // 刪除考勤記錄
  static async delete(id) {
    try {
      return await knex('attendances')
        .where('id', id)
        .delete();
    } catch (error) {
      console.error('Attendance.delete error:', error);
      throw error;
    }
  }

  // 根據用戶ID和日期查找考勤記錄
  static async findByUserAndDate(userId, date) {
    try {
      return await knex('attendances')
        .where({
          user_id: userId,
          attendance_date: date
        })
        .first();
    } catch (error) {
      console.error('Attendance.findByUserAndDate error:', error);
      throw error;
    }
  }

  // 批量建立或更新考勤記錄
  static async upsert(attendanceData) {
    try {
      const existing = await this.findByUserAndDate(
        attendanceData.user_id,
        attendanceData.attendance_date
      );

      if (existing) {
        return await this.update(existing.id, attendanceData);
      } else {
        return await this.create(attendanceData);
      }
    } catch (error) {
      console.error('Attendance.upsert error:', error);
      throw error;
    }
  }
}

module.exports = Attendance;
