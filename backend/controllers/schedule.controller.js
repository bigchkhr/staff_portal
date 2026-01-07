const Schedule = require('../database/models/Schedule');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const User = require('../database/models/User');
const LeaveApplication = require('../database/models/LeaveApplication');
const knex = require('../config/database');

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
        
        // 獲取所有群組的成員
        const allMembers = [];
        for (const groupId of groupIds) {
          const members = await DepartmentGroup.getMembers(groupId);
          allMembers.push(...members);
        }
        // 去重
        const uniqueMembers = Array.from(new Map(allMembers.map(m => [m.id, m])).values());
        
        // 獲取所有群組成員的假期申請
        const leaveApplications = await this.getLeaveApplicationsForGroups(
          groupIds,
          filters.start_date,
          filters.end_date
        );
        
        // 生成完整的排班資料（使用第一個群組ID作為默認值）
        const schedulesWithLeave = this.generateSchedulesForMembersAndDates(
          uniqueMembers,
          filters.start_date,
          filters.end_date,
          groupIds[0], // 使用第一個群組ID
          filteredSchedules,
          leaveApplications
        );
        
        return res.json({ schedules: schedulesWithLeave });
      }

      console.log('Querying schedules with filters:', filters);
      const schedules = await Schedule.findAll(filters);
      console.log(`Found ${schedules.length} schedules`);
      
      // 獲取群組所有成員
      const members = await DepartmentGroup.getMembers(filters.department_group_id);
      console.log(`Group has ${members.length} members`);
      
      // 獲取群組所有成員的假期申請
      const leaveApplications = await this.getLeaveApplicationsForGroup(
        filters.department_group_id,
        filters.start_date,
        filters.end_date
      );
      console.log(`Found ${leaveApplications.length} leave applications for group`);
      
      // 生成完整的排班資料：為每個成員、每個日期創建記錄
      const schedulesWithLeave = this.generateSchedulesForMembersAndDates(
        members,
        filters.start_date,
        filters.end_date,
        filters.department_group_id,
        schedules,
        leaveApplications
      );
      
      if (schedulesWithLeave.length > 0) {
        // 找出有假期且有 session 的記錄作為示例
        const sampleWithSession = schedulesWithLeave.find(s => s.leave_session);
        if (sampleWithSession) {
          console.log('Sample schedule with leave session:', {
            id: sampleWithSession.id,
            user_id: sampleWithSession.user_id,
            schedule_date: sampleWithSession.schedule_date,
            leave_type_name_zh: sampleWithSession.leave_type_name_zh,
            leave_session: sampleWithSession.leave_session
          });
        }
        console.log('Sample schedule with leave:', schedulesWithLeave[0]);
      }
      res.json({ schedules: schedulesWithLeave });
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

  // 輔助方法：為每個成員、每個日期生成排班記錄，並合併假期資料
  generateSchedulesForMembersAndDates(members, startDate, endDate, departmentGroupId, existingSchedules, leaveApplications) {
    if (!members || members.length === 0 || !startDate || !endDate) {
      return existingSchedules || [];
    }
    
    // 生成日期範圍
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }
    
    // 為每個成員、每個日期創建排班記錄
    const allSchedules = [];
    
    for (const member of members) {
      for (const dateStr of dates) {
        // 查找是否已有排班記錄
        const existingSchedule = existingSchedules.find(s => {
          const sUserId = Number(s.user_id);
          const sDate = this.formatDateString(s.schedule_date);
          return sUserId === Number(member.id) && sDate === dateStr;
        });
        
        if (existingSchedule) {
          // 如果已有記錄，合併假期資料
          const scheduleWithLeave = this.mergeLeaveForSchedule(existingSchedule, dateStr, leaveApplications);
          allSchedules.push(scheduleWithLeave);
        } else {
          // 如果沒有記錄，創建新記錄（僅包含假期資料）
          const scheduleWithLeave = this.createScheduleFromLeave(member, dateStr, departmentGroupId, leaveApplications);
          if (scheduleWithLeave) {
            allSchedules.push(scheduleWithLeave);
          }
        }
      }
    }
    
    return allSchedules;
  }
  
  // 輔助方法：格式化日期為字符串
  formatDateString(date) {
    if (!date) return null;
    if (date instanceof Date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    if (typeof date === 'string') {
      return date.split('T')[0].substring(0, 10);
    }
    return date;
  }
  
  // 輔助方法：為現有排班記錄合併假期資料
  mergeLeaveForSchedule(schedule, scheduleDateStr, leaveApplications) {
    const userId = schedule.user_id;
    
    // 找到該用戶在該日期的假期申請
    const leaveForDate = this.findLeaveForUserAndDate(userId, scheduleDateStr, leaveApplications);
    
    if (leaveForDate) {
      // 判斷是上午假還是下午假
      const leaveSession = this.getLeaveSessionForDate(scheduleDateStr, leaveForDate);
      console.log('mergeLeaveForSchedule - leaveSession:', leaveSession, 'for schedule date:', scheduleDateStr);
      
      return {
        ...schedule,
        leave_type_id: leaveForDate.leave_type_id,
        leave_type_code: leaveForDate.leave_type_code,
        leave_type_name: leaveForDate.leave_type_name,
        leave_type_name_zh: leaveForDate.leave_type_name_zh,
        leave_session: leaveSession // 'AM', 'PM', 或 null（全天假）
      };
    }
    
    return schedule;
  }
  
  // 輔助方法：從假期資料創建排班記錄
  createScheduleFromLeave(member, scheduleDateStr, departmentGroupId, leaveApplications) {
    const userId = member.id;
    
    // 找到該用戶在該日期的假期申請
    const leaveForDate = this.findLeaveForUserAndDate(userId, scheduleDateStr, leaveApplications);
    
    if (leaveForDate) {
      // 判斷是上午假還是下午假
      const leaveSession = this.getLeaveSessionForDate(scheduleDateStr, leaveForDate);
      
      // 創建一個虛擬的排班記錄（沒有 id，只有假期資料）
      return {
        id: null,
        user_id: userId,
        department_group_id: departmentGroupId,
        schedule_date: scheduleDateStr,
        start_time: null,
        end_time: null,
        user_name: member.display_name || member.name,
        user_name_zh: member.name_zh,
        employee_number: member.employee_number,
        leave_type_id: leaveForDate.leave_type_id,
        leave_type_code: leaveForDate.leave_type_code,
        leave_type_name: leaveForDate.leave_type_name,
        leave_type_name_zh: leaveForDate.leave_type_name_zh,
        leave_session: leaveSession // 'AM', 'PM', 或 null（全天假）
      };
    }
    
    return null;
  }
  
  // 輔助方法：獲取指定日期的假期時段（AM/PM/null）
  // 使用 LeaveApplication model 的靜態方法來計算
  getLeaveSessionForDate(scheduleDateStr, leaveForDate) {
    return LeaveApplication.getSessionForDate(leaveForDate, scheduleDateStr);
  }
  
  // 輔助方法：查找用戶在指定日期的假期申請
  findLeaveForUserAndDate(userId, scheduleDateStr, leaveApplications) {
    return leaveApplications.find(leave => {
      // 檢查用戶是否匹配
      if (Number(leave.user_id) !== Number(userId)) {
        return false;
      }
      
      // 確保日期格式一致
      let leaveStart = this.formatDateString(leave.start_date);
      let leaveEnd = this.formatDateString(leave.end_date);
      
      // 檢查日期是否在假期範圍內
      if (scheduleDateStr >= leaveStart && scheduleDateStr <= leaveEnd) {
        return true;
      }
      
      return false;
    });
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
      const { user_id, department_group_id, schedule_date, start_time, end_time } = req.body;
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
      const { start_time, end_time } = req.body;
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

  // 輔助方法：獲取指定群組所有成員的假期申請
  async getLeaveApplicationsForGroup(departmentGroupId, startDate, endDate) {
    if (!departmentGroupId) {
      return [];
    }
    
    if (!startDate || !endDate) {
      return [];
    }
    
    // 獲取群組的所有成員
    const members = await DepartmentGroup.getMembers(departmentGroupId);
    if (!members || members.length === 0) {
      return [];
    }
    
    const userIds = members.map(m => m.id);
    console.log(`Group ${departmentGroupId} has ${userIds.length} members`);
    
    // 查詢已批核的假期申請（排除已銷假的）
    const allLeaveApplications = await LeaveApplication.findAll({
      status: 'approved',
      start_date_from: startDate,
      end_date_to: endDate
    });
    
    // 過濾出群組成員的假期申請，並排除已銷假的
    const leaveApplications = allLeaveApplications.filter(leave => {
      // 檢查用戶是否為群組成員
      if (!userIds.includes(Number(leave.user_id))) {
        return false;
      }
      // 排除已銷假的假期
      if (leave.is_reversed) {
        return false;
      }
      // 排除銷假交易本身
      if (leave.is_reversal_transaction) {
        return false;
      }
      return true;
    });
    
    return leaveApplications;
  }

  // 輔助方法：獲取多個群組所有成員的假期申請
  async getLeaveApplicationsForGroups(departmentGroupIds, startDate, endDate) {
    if (!departmentGroupIds || departmentGroupIds.length === 0) {
      return [];
    }
    
    if (!startDate || !endDate) {
      return [];
    }
    
    // 獲取所有群組的成員
    const allUserIds = new Set();
    for (const groupId of departmentGroupIds) {
      const members = await DepartmentGroup.getMembers(groupId);
      if (members && members.length > 0) {
        members.forEach(m => allUserIds.add(m.id));
      }
    }
    
    if (allUserIds.size === 0) {
      return [];
    }
    
    const userIds = Array.from(allUserIds);
    console.log(`Groups have ${userIds.length} total members`);
    
    // 查詢已批核的假期申請（排除已銷假的）
    const allLeaveApplications = await LeaveApplication.findAll({
      status: 'approved',
      start_date_from: startDate,
      end_date_to: endDate
    });
    
    // 過濾出群組成員的假期申請，並排除已銷假的
    const leaveApplications = allLeaveApplications.filter(leave => {
      // 檢查用戶是否為群組成員
      if (!userIds.includes(Number(leave.user_id))) {
        return false;
      }
      // 排除已銷假的假期
      if (leave.is_reversed) {
        return false;
      }
      // 排除銷假交易本身
      if (leave.is_reversal_transaction) {
        return false;
      }
      return true;
    });
    
    return leaveApplications;
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
