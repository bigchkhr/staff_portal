const knex = require('../../config/database');

class ClockRecord {
  // 取得所有打卡記錄（可選篩選條件）
  static async findAll(filters = {}) {
    try {
      let query = knex('clock_records')
        .leftJoin('users', 'clock_records.created_by_id', 'users.id')
        .select(
          'clock_records.*',
          'users.employee_number as user_employee_number',
          'users.display_name'
        );

      if (filters.employee_number) {
        query = query.where('clock_records.employee_number', filters.employee_number);
      }

      if (filters.attendance_date) {
        query = query.where('clock_records.attendance_date', filters.attendance_date);
      }

      if (filters.start_date) {
        query = query.where('clock_records.attendance_date', '>=', filters.start_date);
      }

      if (filters.end_date) {
        query = query.where('clock_records.attendance_date', '<=', filters.end_date);
      }

      if (filters.branch_code) {
        query = query.where('clock_records.branch_code', filters.branch_code);
      }

      if (filters.is_valid !== undefined) {
        query = query.where('clock_records.is_valid', filters.is_valid);
      }

      return await query
        .orderBy('clock_records.attendance_date', 'asc')
        .orderBy('clock_records.clock_time', 'asc');
    } catch (error) {
      console.error('ClockRecord.findAll error:', error);
      throw error;
    }
  }

  // 根據ID取得單一記錄
  static async findById(id) {
    try {
      const result = await knex('clock_records')
        .leftJoin('users', 'clock_records.created_by_id', 'users.id')
        .select(
          'clock_records.*',
          'users.employee_number',
          'users.display_name'
        )
        .where('clock_records.id', id)
        .first();

      return result;
    } catch (error) {
      console.error('ClockRecord.findById error:', error);
      throw error;
    }
  }

  // 建立打卡記錄
  static async create(clockRecordData) {
    try {
      const [clockRecord] = await knex('clock_records')
        .insert(clockRecordData)
        .returning('*');
      return await this.findById(clockRecord.id);
    } catch (error) {
      console.error('ClockRecord.create error:', error);
      throw error;
    }
  }

  // 批量建立打卡記錄
  static async createBatch(clockRecordsData) {
    try {
      if (!clockRecordsData || clockRecordsData.length === 0) {
        return [];
      }
      
      // 分批插入，每批最多 1000 條記錄，避免 PostgreSQL 參數限制
      const batchSize = 1000;
      const allRecords = [];
      
      for (let i = 0; i < clockRecordsData.length; i += batchSize) {
        const batch = clockRecordsData.slice(i, i + batchSize);
        const inserted = await knex('clock_records')
          .insert(batch)
          .returning('*');
        allRecords.push(...inserted);
      }
      
      return allRecords;
    } catch (error) {
      console.error('ClockRecord.createBatch error:', error);
      throw error;
    }
  }

  // 更新打卡記錄
  static async update(id, clockRecordData) {
    try {
      await knex('clock_records')
        .where('id', id)
        .update({
          ...clockRecordData,
          updated_at: knex.fn.now()
        });
      return await this.findById(id);
    } catch (error) {
      console.error('ClockRecord.update error:', error);
      throw error;
    }
  }

  // 刪除打卡記錄
  static async delete(id) {
    try {
      return await knex('clock_records')
        .where('id', id)
        .delete();
    } catch (error) {
      console.error('ClockRecord.delete error:', error);
      throw error;
    }
  }


  // 根據員工編號和日期取得所有打卡記錄
  static async findByEmployeeAndDate(employeeNumber, attendanceDate) {
    try {
      return await knex('clock_records')
        .where('employee_number', employeeNumber)
        .where('attendance_date', attendanceDate)
        .orderBy('clock_time', 'asc');
    } catch (error) {
      console.error('ClockRecord.findByEmployeeAndDate error:', error);
      throw error;
    }
  }

  // 根據員工編號和日期範圍取得打卡記錄
  static async findByEmployeeAndDateRange(employeeNumber, startDate, endDate) {
    try {
      return await knex('clock_records')
        .where('employee_number', employeeNumber)
        .where('attendance_date', '>=', startDate)
        .where('attendance_date', '<=', endDate)
        .orderBy('attendance_date', 'asc')
        .orderBy('clock_time', 'asc');
    } catch (error) {
      console.error('ClockRecord.findByEmployeeAndDateRange error:', error);
      throw error;
    }
  }

}

module.exports = ClockRecord;
