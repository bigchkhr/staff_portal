const knex = require('../../config/database');

class MonthlyAttendanceReport {
  // 取得所有月報記錄
  static async findAll(filters = {}) {
    try {
      let query = knex('monthly_attendance_reports')
        .leftJoin('users', 'monthly_attendance_reports.user_id', 'users.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .leftJoin('users as creator', 'monthly_attendance_reports.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'monthly_attendance_reports.updated_by_id', 'updater.id')
        .select(
          'monthly_attendance_reports.*',
          'users.employee_number',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'positions.employment_mode as position_employment_mode',
          'creator.display_name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.display_name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        );

      if (filters.user_id) {
        query = query.where('monthly_attendance_reports.user_id', filters.user_id);
      }
      if (filters.year) {
        query = query.where('monthly_attendance_reports.year', filters.year);
      }
      if (filters.month) {
        query = query.where('monthly_attendance_reports.month', filters.month);
      }

      const results = await query.orderBy('monthly_attendance_reports.year', 'desc')
        .orderBy('monthly_attendance_reports.month', 'desc')
        .orderBy('users.employee_number', 'asc');

      return results.map(row => ({
        id: row.id,
        user_id: row.user_id,
        year: row.year,
        month: row.month,
        // 假期統計
        annual_leave_days: parseFloat(row.annual_leave_days) || 0,
        birthday_leave_days: parseFloat(row.birthday_leave_days) || 0,
        compensatory_leave_days: parseFloat(row.compensatory_leave_days) || 0,
        full_paid_sick_leave_days: parseFloat(row.full_paid_sick_leave_days) || 0,
        sick_leave_with_allowance_days: parseFloat(row.sick_leave_with_allowance_days) || 0,
        no_pay_sick_leave_days: parseFloat(row.no_pay_sick_leave_days) || 0,
        work_injury_leave_days: parseFloat(row.work_injury_leave_days) || 0,
        marriage_leave_days: parseFloat(row.marriage_leave_days) || 0,
        maternity_leave_days: parseFloat(row.maternity_leave_days) || 0,
        paternity_leave_days: parseFloat(row.paternity_leave_days) || 0,
        jury_service_leave_days: parseFloat(row.jury_service_leave_days) || 0,
        compassionate_leave_days: parseFloat(row.compassionate_leave_days) || 0,
        no_pay_personal_leave_days: parseFloat(row.no_pay_personal_leave_days) || 0,
        special_leave_days: parseFloat(row.special_leave_days) || 0,
        current_rest_days_days: parseFloat(row.current_rest_days_days) || 0,
        accumulated_rest_days_days: parseFloat(row.accumulated_rest_days_days) || 0,
        statutory_holiday_days: parseFloat(row.statutory_holiday_days) || 0,
        absent_days: parseFloat(row.absent_days) || 0,
        // 工作統計
        work_days: parseFloat(row.work_days) || 0,
        late_count: parseInt(row.late_count) || 0,
        late_total_minutes: parseFloat(row.late_total_minutes) || 0,
        // FT/PT
        ft_overtime_hours: parseFloat(row.ft_overtime_hours) || 0,
        pt_work_hours: parseFloat(row.pt_work_hours) || 0,
        // 津貼
        store_manager_allowance: parseFloat(row.store_manager_allowance) || 0,
        attendance_bonus: parseFloat(row.attendance_bonus) || 0,
        location_allowance: parseFloat(row.location_allowance) || 0,
        incentive: parseFloat(row.incentive) || 0,
        special_allowance: parseFloat(row.special_allowance) || 0,
        remarks: row.remarks,
        created_by_id: row.created_by_id,
        updated_by_id: row.updated_by_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: {
          employee_number: row.employee_number,
          display_name: row.user_name,
          name_zh: row.user_name_zh,
          position_employment_mode: row.position_employment_mode
        },
        created_by: row.created_by_name || row.created_by_name_zh,
        updated_by: row.updated_by_name || row.updated_by_name_zh
      }));
    } catch (error) {
      console.error('Find all monthly attendance reports error:', error);
      throw error;
    }
  }

  // 根據ID取得單一月報記錄
  static async findById(id) {
    try {
      const result = await knex('monthly_attendance_reports')
        .leftJoin('users', 'monthly_attendance_reports.user_id', 'users.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .leftJoin('users as creator', 'monthly_attendance_reports.created_by_id', 'creator.id')
        .leftJoin('users as updater', 'monthly_attendance_reports.updated_by_id', 'updater.id')
        .select(
          'monthly_attendance_reports.*',
          'users.employee_number',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'positions.employment_mode as position_employment_mode',
          'creator.display_name as created_by_name',
          'creator.name_zh as created_by_name_zh',
          'updater.display_name as updated_by_name',
          'updater.name_zh as updated_by_name_zh'
        )
        .where('monthly_attendance_reports.id', id)
        .first();

      if (!result) return null;

      return {
        id: result.id,
        user_id: result.user_id,
        year: result.year,
        month: result.month,
        // 假期統計
        annual_leave_days: parseFloat(result.annual_leave_days) || 0,
        birthday_leave_days: parseFloat(result.birthday_leave_days) || 0,
        compensatory_leave_days: parseFloat(result.compensatory_leave_days) || 0,
        full_paid_sick_leave_days: parseFloat(result.full_paid_sick_leave_days) || 0,
        sick_leave_with_allowance_days: parseFloat(result.sick_leave_with_allowance_days) || 0,
        no_pay_sick_leave_days: parseFloat(result.no_pay_sick_leave_days) || 0,
        work_injury_leave_days: parseFloat(result.work_injury_leave_days) || 0,
        marriage_leave_days: parseFloat(result.marriage_leave_days) || 0,
        maternity_leave_days: parseFloat(result.maternity_leave_days) || 0,
        paternity_leave_days: parseFloat(result.paternity_leave_days) || 0,
        jury_service_leave_days: parseFloat(result.jury_service_leave_days) || 0,
        compassionate_leave_days: parseFloat(result.compassionate_leave_days) || 0,
        no_pay_personal_leave_days: parseFloat(result.no_pay_personal_leave_days) || 0,
        special_leave_days: parseFloat(result.special_leave_days) || 0,
        current_rest_days_days: parseFloat(result.current_rest_days_days) || 0,
        accumulated_rest_days_days: parseFloat(result.accumulated_rest_days_days) || 0,
        statutory_holiday_days: parseFloat(result.statutory_holiday_days) || 0,
        absent_days: parseFloat(result.absent_days) || 0,
        // 工作統計
        work_days: parseFloat(result.work_days) || 0,
        late_count: parseInt(result.late_count) || 0,
        late_total_minutes: parseFloat(result.late_total_minutes) || 0,
        // FT/PT
        ft_overtime_hours: parseFloat(result.ft_overtime_hours) || 0,
        pt_work_hours: parseFloat(result.pt_work_hours) || 0,
        // 津貼
        store_manager_allowance: parseFloat(result.store_manager_allowance) || 0,
        attendance_bonus: parseFloat(result.attendance_bonus) || 0,
        location_allowance: parseFloat(result.location_allowance) || 0,
        incentive: parseFloat(result.incentive) || 0,
        special_allowance: parseFloat(result.special_allowance) || 0,
        remarks: result.remarks,
        created_by_id: result.created_by_id,
        updated_by_id: result.updated_by_id,
        created_at: result.created_at,
        updated_at: result.updated_at,
        user: {
          employee_number: result.employee_number,
          display_name: result.user_name,
          name_zh: result.user_name_zh,
          position_employment_mode: result.position_employment_mode
        },
        created_by: result.created_by_name || result.created_by_name_zh,
        updated_by: result.updated_by_name || result.updated_by_name_zh
      };
    } catch (error) {
      console.error('Find monthly attendance report by id error:', error);
      throw error;
    }
  }

  // 根據用戶、年份、月份取得月報記錄
  static async findByUserAndMonth(userId, year, month) {
    try {
      const result = await knex('monthly_attendance_reports')
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
        annual_leave_days: parseFloat(result.annual_leave_days) || 0,
        birthday_leave_days: parseFloat(result.birthday_leave_days) || 0,
        compensatory_leave_days: parseFloat(result.compensatory_leave_days) || 0,
        full_paid_sick_leave_days: parseFloat(result.full_paid_sick_leave_days) || 0,
        sick_leave_with_allowance_days: parseFloat(result.sick_leave_with_allowance_days) || 0,
        no_pay_sick_leave_days: parseFloat(result.no_pay_sick_leave_days) || 0,
        work_injury_leave_days: parseFloat(result.work_injury_leave_days) || 0,
        marriage_leave_days: parseFloat(result.marriage_leave_days) || 0,
        maternity_leave_days: parseFloat(result.maternity_leave_days) || 0,
        paternity_leave_days: parseFloat(result.paternity_leave_days) || 0,
        jury_service_leave_days: parseFloat(result.jury_service_leave_days) || 0,
        compassionate_leave_days: parseFloat(result.compassionate_leave_days) || 0,
        no_pay_personal_leave_days: parseFloat(result.no_pay_personal_leave_days) || 0,
        special_leave_days: parseFloat(result.special_leave_days) || 0,
        current_rest_days_days: parseFloat(result.current_rest_days_days) || 0,
        accumulated_rest_days_days: parseFloat(result.accumulated_rest_days_days) || 0,
        statutory_holiday_days: parseFloat(result.statutory_holiday_days) || 0,
        absent_days: parseFloat(result.absent_days) || 0,
        work_days: parseFloat(result.work_days) || 0,
        late_count: parseInt(result.late_count) || 0,
        late_total_minutes: parseFloat(result.late_total_minutes) || 0,
        ft_overtime_hours: parseFloat(result.ft_overtime_hours) || 0,
        pt_work_hours: parseFloat(result.pt_work_hours) || 0,
        store_manager_allowance: parseFloat(result.store_manager_allowance) || 0,
        attendance_bonus: parseFloat(result.attendance_bonus) || 0,
        location_allowance: parseFloat(result.location_allowance) || 0,
        incentive: parseFloat(result.incentive) || 0,
        special_allowance: parseFloat(result.special_allowance) || 0,
        remarks: result.remarks,
        created_by_id: result.created_by_id,
        updated_by_id: result.updated_by_id,
        created_at: result.created_at,
        updated_at: result.updated_at
      };
    } catch (error) {
      console.error('Find monthly attendance report by user and month error:', error);
      throw error;
    }
  }

  // 建立月報記錄
  static async create(data) {
    try {
      const result = await knex('monthly_attendance_reports').insert({
        user_id: data.user_id,
        year: data.year,
        month: data.month,
        annual_leave_days: data.annual_leave_days || 0,
        birthday_leave_days: data.birthday_leave_days || 0,
        compensatory_leave_days: data.compensatory_leave_days || 0,
        full_paid_sick_leave_days: data.full_paid_sick_leave_days || 0,
        sick_leave_with_allowance_days: data.sick_leave_with_allowance_days || 0,
        no_pay_sick_leave_days: data.no_pay_sick_leave_days || 0,
        work_injury_leave_days: data.work_injury_leave_days || 0,
        marriage_leave_days: data.marriage_leave_days || 0,
        maternity_leave_days: data.maternity_leave_days || 0,
        paternity_leave_days: data.paternity_leave_days || 0,
        jury_service_leave_days: data.jury_service_leave_days || 0,
        compassionate_leave_days: data.compassionate_leave_days || 0,
        no_pay_personal_leave_days: data.no_pay_personal_leave_days || 0,
        special_leave_days: data.special_leave_days || 0,
        current_rest_days_days: data.current_rest_days_days || 0,
        accumulated_rest_days_days: data.accumulated_rest_days_days || 0,
        statutory_holiday_days: data.statutory_holiday_days || 0,
        absent_days: data.absent_days || 0,
        work_days: data.work_days || 0,
        late_count: data.late_count || 0,
        late_total_minutes: data.late_total_minutes || 0,
        ft_overtime_hours: data.ft_overtime_hours || 0,
        pt_work_hours: data.pt_work_hours || 0,
        store_manager_allowance: data.store_manager_allowance || 0,
        attendance_bonus: data.attendance_bonus || 0,
        location_allowance: data.location_allowance || 0,
        incentive: data.incentive || 0,
        special_allowance: data.special_allowance || 0,
        remarks: data.remarks,
        created_by_id: data.created_by_id,
        updated_by_id: data.updated_by_id
      }).returning('id');

      let id;
      if (Array.isArray(result) && result.length > 0) {
        id = typeof result[0] === 'object' && result[0] !== null ? result[0].id : result[0];
      } else if (result && typeof result === 'object' && result.id) {
        id = result.id;
      } else {
        id = result;
      }

      id = typeof id === 'number' ? id : parseInt(id, 10);

      return await this.findById(id);
    } catch (error) {
      console.error('Create monthly attendance report error:', error);
      throw error;
    }
  }

  // 更新月報記錄
  static async update(id, data) {
    try {
      const updateData = {};
      
      if (data.annual_leave_days !== undefined) updateData.annual_leave_days = data.annual_leave_days;
      if (data.birthday_leave_days !== undefined) updateData.birthday_leave_days = data.birthday_leave_days;
      if (data.compensatory_leave_days !== undefined) updateData.compensatory_leave_days = data.compensatory_leave_days;
      if (data.full_paid_sick_leave_days !== undefined) updateData.full_paid_sick_leave_days = data.full_paid_sick_leave_days;
      if (data.sick_leave_with_allowance_days !== undefined) updateData.sick_leave_with_allowance_days = data.sick_leave_with_allowance_days;
      if (data.no_pay_sick_leave_days !== undefined) updateData.no_pay_sick_leave_days = data.no_pay_sick_leave_days;
      if (data.work_injury_leave_days !== undefined) updateData.work_injury_leave_days = data.work_injury_leave_days;
      if (data.marriage_leave_days !== undefined) updateData.marriage_leave_days = data.marriage_leave_days;
      if (data.maternity_leave_days !== undefined) updateData.maternity_leave_days = data.maternity_leave_days;
      if (data.paternity_leave_days !== undefined) updateData.paternity_leave_days = data.paternity_leave_days;
      if (data.jury_service_leave_days !== undefined) updateData.jury_service_leave_days = data.jury_service_leave_days;
      if (data.compassionate_leave_days !== undefined) updateData.compassionate_leave_days = data.compassionate_leave_days;
      if (data.no_pay_personal_leave_days !== undefined) updateData.no_pay_personal_leave_days = data.no_pay_personal_leave_days;
      if (data.special_leave_days !== undefined) updateData.special_leave_days = data.special_leave_days;
      if (data.current_rest_days_days !== undefined) updateData.current_rest_days_days = data.current_rest_days_days;
      if (data.accumulated_rest_days_days !== undefined) updateData.accumulated_rest_days_days = data.accumulated_rest_days_days;
      if (data.statutory_holiday_days !== undefined) updateData.statutory_holiday_days = data.statutory_holiday_days;
      if (data.absent_days !== undefined) updateData.absent_days = data.absent_days;
      if (data.work_days !== undefined) updateData.work_days = data.work_days;
      if (data.late_count !== undefined) updateData.late_count = data.late_count;
      if (data.late_total_minutes !== undefined) updateData.late_total_minutes = data.late_total_minutes;
      if (data.ft_overtime_hours !== undefined) updateData.ft_overtime_hours = data.ft_overtime_hours;
      if (data.pt_work_hours !== undefined) updateData.pt_work_hours = data.pt_work_hours;
      if (data.store_manager_allowance !== undefined) updateData.store_manager_allowance = data.store_manager_allowance;
      if (data.attendance_bonus !== undefined) updateData.attendance_bonus = data.attendance_bonus;
      if (data.location_allowance !== undefined) updateData.location_allowance = data.location_allowance;
      if (data.incentive !== undefined) updateData.incentive = data.incentive;
      if (data.special_allowance !== undefined) updateData.special_allowance = data.special_allowance;
      if (data.remarks !== undefined) updateData.remarks = data.remarks;
      if (data.updated_by_id !== undefined) updateData.updated_by_id = data.updated_by_id;

      await knex('monthly_attendance_reports')
        .where('id', id)
        .update(updateData);

      return await this.findById(id);
    } catch (error) {
      console.error('Update monthly attendance report error:', error);
      throw error;
    }
  }

  // 更新或建立月報記錄（upsert）
  static async upsert(data) {
    try {
      const existing = await this.findByUserAndMonth(data.user_id, data.year, data.month);
      
      if (existing) {
        return await this.update(existing.id, {
          ...data,
          updated_by_id: data.updated_by_id
        });
      } else {
        return await this.create(data);
      }
    } catch (error) {
      console.error('Upsert monthly attendance report error:', error);
      throw error;
    }
  }

  // 刪除月報記錄
  static async delete(id) {
    try {
      await knex('monthly_attendance_reports').where('id', id).del();
      return true;
    } catch (error) {
      console.error('Delete monthly attendance report error:', error);
      throw error;
    }
  }
}

module.exports = MonthlyAttendanceReport;

