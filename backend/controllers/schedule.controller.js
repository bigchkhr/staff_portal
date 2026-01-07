const Schedule = require('../database/models/Schedule');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const User = require('../database/models/User');

class ScheduleController {
  // 取得排班列表
  async getSchedules(req, res) {
    try {
      const { department_group_id, user_id, start_date, end_date, schedule_date } = req.query;
      const userId = req.user.id;

      console.log('getSchedules called with params:', {
        department_group_id,
        user_id,
        start_date,
        end_date,
        schedule_date,
        userId
      });

      const filters = {};
      if (department_group_id) filters.department_group_id = parseInt(department_group_id, 10);
      if (user_id) filters.user_id = parseInt(user_id, 10);
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (schedule_date) filters.schedule_date = schedule_date;

      console.log('Filters:', filters);

      // 如果指定了群組，檢查用戶是否有權限查看
      if (department_group_id) {
        const groupId = parseInt(department_group_id, 10);
        const canView = await this.canViewGroupSchedule(userId, groupId, req.user.is_system_admin);
        console.log(`Permission check for group ${groupId}:`, canView);
        if (!canView) {
          return res.status(403).json({ message: '您沒有權限查看此群組的排班表' });
        }
      } else {
        // 如果沒有指定群組，只返回用戶所屬群組的排班
        const userGroups = await DepartmentGroup.findByUserId(userId);
        if (userGroups.length === 0) {
          return res.json({ schedules: [] });
        }
        // 只查詢用戶所屬群組的排班
        const groupIds = userGroups.map(g => g.id);
        const allSchedules = await Schedule.findAll({});
        const filteredSchedules = allSchedules.filter(s => 
          groupIds.includes(s.department_group_id)
        );
        return res.json({ schedules: filteredSchedules });
      }

      console.log('Querying schedules with filters:', filters);
      const schedules = await Schedule.findAll(filters);
      console.log(`Found ${schedules.length} schedules`);
      if (schedules.length > 0) {
        console.log('Sample schedule:', schedules[0]);
      }
      res.json({ schedules });
    } catch (error) {
      console.error('Get schedules error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint
      });
      res.status(500).json({ 
        message: '取得排班表失敗', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        hint: error.detail || error.hint || '請確認資料庫 migration 是否已執行'
      });
    }
  }

  // 取得單一排班記錄
  async getSchedule(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const schedule = await Schedule.findById(id);
      if (!schedule) {
        return res.status(404).json({ message: '排班記錄不存在' });
      }

      // 檢查權限
      const canView = await this.canViewGroupSchedule(userId, schedule.department_group_id, req.user.is_system_admin);
      if (!canView) {
        return res.status(403).json({ message: '您沒有權限查看此排班記錄' });
      }

      res.json({ schedule });
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ message: '取得排班記錄失敗', error: error.message });
    }
  }

  // 建立排班記錄（單筆）
  async createSchedule(req, res) {
    try {
      const { user_id, department_group_id, schedule_date, start_time, end_time, leave_type_id, is_morning_leave, is_afternoon_leave } = req.body;
      const userId = req.user.id;

      // 驗證必填欄位
      if (!user_id || !department_group_id || !schedule_date) {
        return res.status(400).json({ message: '缺少必填欄位' });
      }

      // 檢查編輯權限
      const canEdit = await Schedule.canEditSchedule(userId, department_group_id);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限編輯此群組的排班表' });
      }

      // 檢查用戶是否屬於該群組
      const isInGroup = await Schedule.isUserInGroup(user_id, department_group_id);
      if (!isInGroup) {
        return res.status(400).json({ message: '該用戶不屬於指定的群組' });
      }

      const scheduleData = {
        user_id,
        department_group_id,
        schedule_date,
        start_time: start_time || null,
        end_time: end_time || null,
        leave_type_id: leave_type_id || null,
        is_morning_leave: is_morning_leave || false,
        is_afternoon_leave: is_afternoon_leave || false,
        created_by_id: userId,
        updated_by_id: userId
      };

      const schedule = await Schedule.create(scheduleData);
      res.status(201).json({ schedule, message: '排班記錄建立成功' });
    } catch (error) {
      console.error('Create schedule error:', error);
      res.status(500).json({ message: '建立排班記錄失敗', error: error.message });
    }
  }

  // 批量建立排班記錄
  async createBatchSchedules(req, res) {
    try {
      const { schedules } = req.body; // schedules 是一個數組
      const userId = req.user.id;

      if (!Array.isArray(schedules) || schedules.length === 0) {
        return res.status(400).json({ message: '請提供有效的排班資料' });
      }

      // 驗證所有記錄的群組是否相同，並檢查權限
      const departmentGroupIds = [...new Set(schedules.map(s => s.department_group_id))];
      if (departmentGroupIds.length > 1) {
        return res.status(400).json({ message: '批量排班只能針對單一群組' });
      }

      const departmentGroupId = departmentGroupIds[0];
      const canEdit = await Schedule.canEditSchedule(userId, departmentGroupId);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限編輯此群組的排班表' });
      }

      // 驗證所有用戶是否屬於該群組
      for (const schedule of schedules) {
        if (!schedule.user_id || !schedule.schedule_date) {
          return res.status(400).json({ message: '每筆排班記錄必須包含 user_id 和 schedule_date' });
        }

        const isInGroup = await Schedule.isUserInGroup(schedule.user_id, departmentGroupId);
        if (!isInGroup) {
          return res.status(400).json({ 
            message: `用戶 ID ${schedule.user_id} 不屬於指定的群組` 
          });
        }
      }

      // 準備批量資料
      const schedulesData = schedules.map(s => ({
        user_id: s.user_id,
        department_group_id: departmentGroupId,
        schedule_date: s.schedule_date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        leave_type_id: s.leave_type_id || null,
        is_morning_leave: s.is_morning_leave || false,
        is_afternoon_leave: s.is_afternoon_leave || false,
        created_by_id: userId,
        updated_by_id: userId
      }));

      const createdSchedules = await Schedule.createBatch(schedulesData);
      res.status(201).json({ 
        schedules: createdSchedules, 
        message: `成功建立 ${createdSchedules.length} 筆排班記錄` 
      });
    } catch (error) {
      console.error('Create batch schedules error:', error);
      res.status(500).json({ message: '批量建立排班記錄失敗', error: error.message });
    }
  }

  // 更新排班記錄
  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { start_time, end_time, leave_type_id, is_morning_leave, is_afternoon_leave } = req.body;
      const userId = req.user.id;

      const schedule = await Schedule.findById(id);
      if (!schedule) {
        return res.status(404).json({ message: '排班記錄不存在' });
      }

      // 檢查編輯權限
      const canEdit = await Schedule.canEditSchedule(userId, schedule.department_group_id);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限編輯此排班記錄' });
      }

      const updateData = {
        updated_by_id: userId
      };
      if (start_time !== undefined) updateData.start_time = start_time || null;
      if (end_time !== undefined) updateData.end_time = end_time || null;
      if (leave_type_id !== undefined) updateData.leave_type_id = leave_type_id || null;
      if (is_morning_leave !== undefined) updateData.is_morning_leave = is_morning_leave;
      if (is_afternoon_leave !== undefined) updateData.is_afternoon_leave = is_afternoon_leave;

      const updatedSchedule = await Schedule.update(id, updateData);
      res.json({ schedule: updatedSchedule, message: '排班記錄更新成功' });
    } catch (error) {
      console.error('Update schedule error:', error);
      res.status(500).json({ message: '更新排班記錄失敗', error: error.message });
    }
  }

  // 刪除排班記錄
  async deleteSchedule(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const schedule = await Schedule.findById(id);
      if (!schedule) {
        return res.status(404).json({ message: '排班記錄不存在' });
      }

      // 檢查編輯權限
      const canEdit = await Schedule.canEditSchedule(userId, schedule.department_group_id);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限刪除此排班記錄' });
      }

      await Schedule.delete(id);
      res.json({ message: '排班記錄刪除成功' });
    } catch (error) {
      console.error('Delete schedule error:', error);
      res.status(500).json({ message: '刪除排班記錄失敗', error: error.message });
    }
  }

  // 批量刪除排班記錄
  async deleteBatchSchedules(req, res) {
    try {
      const { department_group_id, user_id, start_date, end_date, schedule_date } = req.body;
      const userId = req.user.id;

      if (!department_group_id) {
        return res.status(400).json({ message: '必須指定群組ID' });
      }

      // 檢查編輯權限
      const canEdit = await Schedule.canEditSchedule(userId, department_group_id);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限刪除此群組的排班記錄' });
      }

      const filters = { department_group_id };
      if (user_id) filters.user_id = user_id;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (schedule_date) filters.schedule_date = schedule_date;

      const deletedCount = await Schedule.deleteBatch(filters);
      res.json({ 
        deleted_count: deletedCount, 
        message: `成功刪除 ${deletedCount} 筆排班記錄` 
      });
    } catch (error) {
      console.error('Delete batch schedules error:', error);
      res.status(500).json({ message: '批量刪除排班記錄失敗', error: error.message });
    }
  }

  // 輔助方法：檢查用戶是否可以查看群組排班
  async canViewGroupSchedule(userId, departmentGroupId, isSystemAdmin = false) {
    // 系統管理員可以查看所有群組
    if (isSystemAdmin) {
      return true;
    }

    // 檢查是否為群組成員
    const isMember = await Schedule.isUserInGroup(userId, departmentGroupId);
    if (isMember) {
      return true;
    }

    // 檢查是否為批核成員
    const canEdit = await Schedule.canEditSchedule(userId, departmentGroupId);
    if (canEdit) {
      return true;
    }

    return false;
  }
}

module.exports = new ScheduleController();
