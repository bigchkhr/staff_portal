const Schedule = require('../database/models/Schedule');
const ScheduleChange = require('../database/models/ScheduleChange');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const User = require('../database/models/User');
const LeaveApplication = require('../database/models/LeaveApplication');
const OutdoorWorkApplication = require('../database/models/OutdoorWorkApplication');
const knex = require('../config/database');
const monthlyAttendanceSummaryController = require('./monthlyAttendanceSummary.controller');

class ScheduleController {
  // 將日期轉換為香港 UTC+8 日曆的 YYYY-MM-DD
  formatDateToUTC8(date) {
    return Schedule._normalizeDateStr(date);
  }

  // 取得原本群組的排班列表（原舖），或員工自己嘅更表（/my-roster）
  async getSchedules(req, res) {
    try {
      const { department_group_id, user_id, start_date, end_date } = req.query;
      
      console.log('=== 📥 收到排班查詢請求 ===');
      console.log('📋 前端請求參數:', {
        department_group_id,
        user_id,
        start_date,
        end_date
      });
      
      // 「我的更表」模式：當傳入 user_id 時，只允許查自己嘅更表
      if (user_id) {
        const targetUserId = parseInt(user_id, 10);
        const currentUserId = req.user?.id ? parseInt(req.user.id, 10) : null;
        
        if (currentUserId !== targetUserId) {
          return res.status(403).json({ message: '只能查看自己的更表' });
        }
        
        if (!start_date || !end_date) {
          return res.status(400).json({ message: '查詢自己更表時必須指定 start_date 和 end_date' });
        }
        
        return await this.getMyRosterSchedules(res, targetUserId, start_date, end_date);
      }
      
      if (!department_group_id) {
        return res.status(400).json({ message: '必須指定群組ID' });
      }
      
      const groupId = parseInt(department_group_id, 10);
      const knex = require('../config/database');
      
      // 根據 department_group_id 查詢，並 JOIN stores 表獲取店舖信息
      let query = knex('schedules')
        .leftJoin('stores', 'schedules.store_id', 'stores.id')
        .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
        .where('schedules.department_group_id', groupId)
        .select(
          'schedules.*',
          'stores.id as store_id',
          'stores.store_code as store_code',
          'stores.store_short_name_ as store_short_name',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh'
        );
      
      // 如果指定了日期範圍，進行篩選
      if (start_date && end_date) {
        query = query.whereBetween('schedules.schedule_date', [start_date, end_date]);
        console.log(`📅 日期範圍篩選: ${start_date} 至 ${end_date}`);
      } else if (start_date) {
        query = query.where('schedules.schedule_date', '>=', start_date);
        console.log(`📅 開始日期篩選: >= ${start_date}`);
      } else if (end_date) {
        query = query.where('schedules.schedule_date', '<=', end_date);
        console.log(`📅 結束日期篩選: <= ${end_date}`);
      }
      
      const schedules = await query;
      
      console.log('=== 📊 查詢結果 ===');
      console.log(`✅ 找到 ${schedules.length} 條排班記錄`);
      
      // 獲取已批核的假期申請
      let leaveApplications = [];
      if (start_date && end_date) {
        try {
          leaveApplications = await this.getLeaveApplicationsForGroup(groupId, start_date, end_date);
          console.log(`✅ 找到 ${leaveApplications.length} 條已批核假期申請`);
        } catch (error) {
          console.error('獲取假期申請時發生錯誤:', error);
          // 如果獲取假期失敗，不影響排班記錄的返回
        }
      }
      
      // 將假期合併到排班記錄中
      const schedulesWithLeaves = schedules.map(schedule => {
        const scheduleDateStr = this.formatDateString(schedule.schedule_date);
        return this.mergeLeaveForSchedule(schedule, scheduleDateStr, leaveApplications);
      });
      
      // 獲取群組成員，以便為沒有排班記錄但有假期的日期創建記錄
      let groupMembers = [];
      try {
        groupMembers = await DepartmentGroup.getMembers(groupId);
      } catch (error) {
        console.error('獲取群組成員時發生錯誤:', error);
      }
      
      // 為沒有排班記錄但有假期的日期創建記錄
      const leaveOnlySchedules = [];
      if (start_date && end_date && groupMembers.length > 0) {
        // 創建一個以 user_id + schedule_date 為鍵的 Set，用於快速查找已有排班記錄
        const existingScheduleKeys = new Set();
        schedulesWithLeaves.forEach(s => {
          const userId = Number(s.user_id);
          const dateStr = this.formatDateString(s.schedule_date);
          existingScheduleKeys.add(`${userId}_${dateStr}`);
        });
        
        // 為每個成員和每個日期檢查是否有假期但沒有排班記錄
        const { eachHKCalendarDate } = require('../utils/hkDate');
        for (const dateStr of eachHKCalendarDate(start_date, end_date)) {
          for (const member of groupMembers) {
            const userId = Number(member.id);
            const key = `${userId}_${dateStr}`;
            
            // 如果該日期沒有排班記錄
            if (!existingScheduleKeys.has(key)) {
              // 檢查是否有假期
              const leaveSchedule = this.createScheduleFromLeave(member, dateStr, groupId, leaveApplications);
              if (leaveSchedule) {
                leaveOnlySchedules.push(leaveSchedule);
              }
            }
          }
        }
      }
      
      // 合併排班記錄和只有假期的記錄
      const allSchedules = [...schedulesWithLeaves, ...leaveOnlySchedules];
      
      console.log(`✅ 合併後總共 ${allSchedules.length} 條記錄（${schedulesWithLeaves.length} 條排班記錄 + ${leaveOnlySchedules.length} 條假期記錄）`);

      const canViewRemarks = await Schedule.canViewScheduleRemarks(req.user.id, groupId, req.user.is_system_admin);
      const sanitizedSchedules = allSchedules.map(s => this._sanitizeScheduleRemarks(s, canViewRemarks));

      let outdoor_work_by_cell = {};
      if (start_date && end_date && groupMembers.length > 0) {
        try {
          outdoor_work_by_cell = await OutdoorWorkApplication.buildApprovedOutdoorWorkCellMap(
            groupMembers.map(m => m.id),
            start_date,
            end_date
          );
        } catch (owErr) {
          console.error('獲取已批核外勤工作時發生錯誤:', owErr);
        }
      }
      
      const groupRow = await knex('department_groups').where('id', groupId).first();
      const actorRole = await Schedule.getActorRole(req.user.id, groupId, req.user.is_system_admin);
      let schedule_change_submissions = [];
      if (actorRole.isAdmin || actorRole.isApprover || actorRole.isChecker) {
        try {
          schedule_change_submissions = await ScheduleChange.listForGroup(groupId, {
            startDate: start_date || null,
            endDate: end_date || null,
            viewerUserId: req.user.id,
            isApprover: actorRole.isApprover,
            isAdmin: actorRole.isAdmin
          });
        } catch (changeErr) {
          console.error('獲取編更呈交時發生錯誤:', changeErr);
        }
      }

      res.json({ 
        schedules: sanitizedSchedules,
        outdoor_work_by_cell,
        schedule_change_submissions,
        require_checker_schedule_approval: groupRow
          ? groupRow.require_checker_schedule_approval === true
          : false
      });
    } catch (error) {
      console.error('Get schedules error:', error);
      res.status(500).json({ 
        message: '取得排班表失敗', 
        error: error.message
      });
    }
  }

  // 以員工編號 + 日期範圍查詢單一員工排班（只限 approver1 / approver2 / approver3 或系統管理員）
  async getUserSchedulesForApprover(req, res) {
    try {
      const { employee_number, start_date, end_date } = req.query;
      const currentUser = req.user;

      if (!employee_number || !start_date || !end_date) {
        return res.status(400).json({ message: '必須提供 employee_number、start_date 和 end_date' });
      }

      // 檢查日期範圍最多 31 日
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: '日期格式不正確，請使用 YYYY-MM-DD' });
      }
      const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (diffDays <= 0) {
        return res.status(400).json({ message: 'end_date 必須大於或等於 start_date' });
      }
      if (diffDays > 31) {
        return res.status(400).json({ message: '日期範圍最長只可以 31 日' });
      }

      // 找出目標員工
      const targetUser = await User.findByEmployeeNumber(employee_number);
      if (!targetUser) {
        return res.status(404).json({ message: '找不到此員工編號的用戶' });
      }

      // 系統管理員可以直接查看
      let isAllowed = currentUser.is_system_admin;

      if (!isAllowed) {
        // 取得目前登入用戶所屬的授權群組 ID
        const userDelegationGroupIds = (currentUser.delegation_groups || [])
          .map(g => Number(g.id))
          .filter(id => !Number.isNaN(id));

        if (userDelegationGroupIds.length > 0) {
          // 取得目標員工所屬的部門群組
          const targetGroups = await DepartmentGroup.findByUserId(targetUser.id);

          // 只要在任何一個目標員工群組入面充當 approver1/2/3 即可（不包括 checker）
          isAllowed = targetGroups.some(group => {
            const approver1Id = group.approver_1_id ? Number(group.approver_1_id) : null;
            const approver2Id = group.approver_2_id ? Number(group.approver_2_id) : null;
            const approver3Id = group.approver_3_id ? Number(group.approver_3_id) : null;

            return (approver1Id !== null && userDelegationGroupIds.includes(approver1Id)) ||
                   (approver2Id !== null && userDelegationGroupIds.includes(approver2Id)) ||
                   (approver3Id !== null && userDelegationGroupIds.includes(approver3Id));
          });
        }
      }

      if (!isAllowed) {
        return res.status(403).json({ message: '只有 approver1、approver2、approver3 或系統管理員可以查看此員工的更表' });
      }

      // 查詢此員工在日期範圍內的所有排班
      const db = require('../config/database');
      const schedules = await db('schedules')
        .leftJoin('stores', 'schedules.store_id', 'stores.id')
        .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
        .where('schedules.user_id', targetUser.id)
        .whereBetween('schedules.schedule_date', [start_date, end_date])
        .select(
          'schedules.*',
          'stores.id as store_id',
          'stores.store_code as store_code',
          'stores.store_short_name_ as store_short_name',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh'
        )
        .orderBy('schedules.schedule_date', 'asc');

      // 將 schedule_date 格式化為 YYYY-MM-DD（UTC+8）
      const formattedSchedules = schedules.map(s => ({
        ...s,
        schedule_date: this.formatDateToUTC8(s.schedule_date) || s.schedule_date
      }));

      return res.json({
        user: {
          id: targetUser.id,
          employee_number: targetUser.employee_number,
          display_name: targetUser.display_name,
          name_zh: targetUser.name_zh
        },
        schedules: formattedSchedules
      });
    } catch (error) {
      console.error('Get user schedules for approver error:', error);
      return res.status(500).json({
        message: '取得員工排班表失敗',
        error: error.message
      });
    }
  }

  // 取得員工自己嘅更表（用於 /my-roster 頁面）
  async getMyRosterSchedules(res, userId, startDate, endDate) {
    try {
      const db = require('../config/database');
      
      // 查詢該用戶嘅排班記錄（可能屬於多個群組，如原舖 + 幫舖）
      let query = db('schedules')
        .leftJoin('stores', 'schedules.store_id', 'stores.id')
        .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
        .where('schedules.user_id', userId)
        .whereBetween('schedules.schedule_date', [startDate, endDate])
        .select(
          'schedules.*',
          'stores.id as store_id',
          'stores.store_code as store_code',
          'stores.store_short_name_ as store_short_name',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh'
        )
        .orderBy('schedules.schedule_date', 'asc');
      
      const schedules = await query;
      
      // 獲取該用戶所屬嘅部門群組（用於取得假期申請）
      const userGroups = await DepartmentGroup.findByUserId(userId);
      const groupIds = userGroups.map(g => g.id);
      
      // 獲取已批核嘅假期申請
      let leaveApplications = [];
      if (groupIds.length > 0) {
        try {
          leaveApplications = await this.getLeaveApplicationsForGroups(groupIds, startDate, endDate);
        } catch (error) {
          console.error('獲取我的更表假期申請時發生錯誤:', error);
        }
      }
      
      // 過濾出只係該用戶嘅假期
      leaveApplications = leaveApplications.filter(leave => Number(leave.user_id) === Number(userId));
      
      // 將假期合併到排班記錄中
      const schedulesWithLeaves = schedules.map(schedule => {
        const scheduleDateStr = this.formatDateString(schedule.schedule_date);
        return this.mergeLeaveForSchedule(schedule, scheduleDateStr, leaveApplications);
      });
      
      // 為沒有排班記錄但有假期嘅日期創建記錄
      const userMember = await User.findById(userId);
      if (!userMember) {
        const sanitized = schedulesWithLeaves.map(s => this._sanitizeScheduleRemarks(s, false));
        return res.json({ schedules: sanitized });
      }
      
      const member = {
        id: userMember.id,
        display_name: userMember.display_name,
        name_zh: userMember.name_zh,
        employee_number: userMember.employee_number
      };
      
      const existingScheduleKeys = new Set();
      schedulesWithLeaves.forEach(s => {
        const dateStr = this.formatDateString(s.schedule_date);
        existingScheduleKeys.add(dateStr);
      });
      
      const leaveOnlySchedules = [];
      // 純字符串疊代日期（YYYY-MM-DD），避免 Date 對象時區轉換導致星期日 miss
      let [y, m, d] = startDate.split('-').map(Number);
      const [endY, endM, endD] = endDate.split('-').map(Number);
      
      while (true) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (dateStr > endDate) break;
        
        if (!existingScheduleKeys.has(dateStr)) {
          const primaryGroupId = groupIds[0] || null;
          const leaveSchedule = this.createScheduleFromLeave(member, dateStr, primaryGroupId, leaveApplications);
          if (leaveSchedule) {
            leaveOnlySchedules.push(leaveSchedule);
          }
        }
        
        d++;
        const daysInMonth = new Date(y, m, 0).getDate();
        if (d > daysInMonth) {
          d = 1;
          m++;
          if (m > 12) {
            m = 1;
            y++;
          }
        }
      }
      
      const allSchedules = [...schedulesWithLeaves, ...leaveOnlySchedules];
      
      // 將 schedule_date 格式化為 YYYY-MM-DD 字串（UTC+8），確保前端不受伺服器時區影響
      const formattedSchedules = allSchedules.map(s => ({
        ...this._sanitizeScheduleRemarks(s, false),
        schedule_date: this.formatDateToUTC8(s.schedule_date) || s.schedule_date
      }));
      
      res.json({ schedules: formattedSchedules });
    } catch (error) {
      console.error('Get my roster schedules error:', error);
      res.status(500).json({
        message: '取得我的更表失敗',
        error: error.message
      });
    }
  }

  // 取得幫舖排班列表（helper schedules）
  async getHelperSchedules(req, res) {
    try {
      const { department_group_id, store_id, start_date, end_date } = req.query;
      const userId = req.user.id;

      console.log('getHelperSchedules (幫舖) called with params:', {
        department_group_id,
        store_id,
        start_date,
        end_date,
        userId
      });

      // 驗證必填參數
      if (!department_group_id) {
        return res.status(400).json({ message: '必須指定群組ID' });
      }
      if (!store_id) {
        return res.status(400).json({ message: '必須指定店舖ID' });
      }
      if (!start_date || !end_date) {
        return res.status(400).json({ message: '必須指定日期範圍' });
      }

      const groupId = parseInt(department_group_id, 10);
      const storeId = parseInt(store_id, 10);

      // 檢查用戶是否有權限查看該群組
      const canView = await this.canViewGroupSchedule(userId, groupId, req.user.is_system_admin);
      if (!canView) {
        return res.status(403).json({ message: '您沒有權限查看此群組的排班表' });
      }

      // 查詢其他群組中選擇了指定店舖的排班記錄
      // PostgreSQL DATE 類型不包含時區信息，直接用字符串比較即可
      const helperSchedulesQuery = await knex('schedules')
        .leftJoin('users', 'schedules.user_id', 'users.id')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .leftJoin('department_groups', 'schedules.department_group_id', 'department_groups.id')
        .leftJoin('leave_types', 'schedules.leave_type_id', 'leave_types.id')
        .leftJoin('stores', 'schedules.store_id', 'stores.id')
        .whereNot('schedules.department_group_id', groupId)
        .where('schedules.store_id', storeId)
        // 使用 whereBetween 確保日期範圍查詢正確
        .whereBetween('schedules.schedule_date', [start_date, end_date])
        .select(
          'schedules.*',
          'users.display_name as user_name',
          'users.name_zh as user_name_zh',
          'users.employee_number',
          'users.termination_date as user_termination_date',
          'positions.employment_mode as position_employment_mode',
          'positions.name as position_name',
          'positions.name_zh as position_name_zh',
          'department_groups.name as group_name',
          'department_groups.name_zh as group_name_zh',
          'leave_types.code as leave_type_code',
          'leave_types.name as leave_type_name',
          'leave_types.name_zh as leave_type_name_zh',
          'stores.id as store_id',
          'stores.store_code as store_code',
          'stores.store_short_name_ as store_short_name'
        )
        .orderBy('schedules.schedule_date', 'asc')
        .orderBy('users.employee_number', 'asc');
      
      // 格式化日期和時間
      const helperSchedules = helperSchedulesQuery.map(schedule => {
        if (schedule.schedule_date) {
          schedule.schedule_date = this.formatDateToUTC8(schedule.schedule_date) || schedule.schedule_date;
        }
        // 格式化時間
        if (schedule.start_time instanceof Date) {
          const hours = String(schedule.start_time.getHours()).padStart(2, '0');
          const minutes = String(schedule.start_time.getMinutes()).padStart(2, '0');
          schedule.start_time = `${hours}:${minutes}:00`;
        } else if (schedule.start_time && typeof schedule.start_time === 'string') {
          schedule.start_time = schedule.start_time.substring(0, 8);
        }
        return schedule;
      });
      
      console.log(`Found ${helperSchedules.length} helper schedules for store ${storeId} and group ${groupId}`);

      const canViewRemarks = await Schedule.canViewScheduleRemarks(userId, groupId, req.user.is_system_admin);
      const sanitizedHelperSchedules = helperSchedules.map(s =>
        this._sanitizeScheduleRemarks(s, canViewRemarks)
      );
      
      res.json({ 
        helperSchedules: sanitizedHelperSchedules
      });
    } catch (error) {
      console.error('Get helper schedules error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '取得幫舖排班表失敗', 
        error: error.message
      });
    }
  }

  // 輔助方法：為每個成員、每個日期生成排班記錄，並合併假期資料
  generateSchedulesForMembersAndDates(members, startDate, endDate, departmentGroupId, existingSchedules, leaveApplications) {
    if (!members || members.length === 0 || !startDate || !endDate) {
      return existingSchedules || [];
    }
    
    console.log(`generateSchedulesForMembersAndDates called with:`, {
      membersCount: members.length,
      startDate,
      endDate,
      departmentGroupId,
      existingSchedulesCount: existingSchedules?.length || 0,
      leaveApplicationsCount: leaveApplications?.length || 0
    });
    
    // 調試：顯示前幾個現有排班記錄
    if (existingSchedules && existingSchedules.length > 0) {
      console.log('First few existing schedules:', existingSchedules.slice(0, 3).map(s => ({
        id: s.id,
        user_id: s.user_id,
        schedule_date: s.schedule_date,
        schedule_date_formatted: this.formatDateString(s.schedule_date),
        start_time: s.start_time,
        end_time: s.end_time
      })));
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
    
    console.log(`Generated ${dates.length} dates from ${startDate} to ${endDate}:`, dates.slice(0, 5), '...');
    
    // 為每個成員、每個日期創建排班記錄
    const allSchedules = [];
    
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    for (const member of members) {
      for (const dateStr of dates) {
        // 查找是否已有排班記錄
        const existingSchedule = existingSchedules.find(s => {
          const sUserId = Number(s.user_id);
          const sDate = this.formatDateString(s.schedule_date);
          const memberId = Number(member.id);
          const matches = sUserId === memberId && sDate === dateStr;
          
          // 調試：記錄匹配過程
          if (sUserId === memberId) {
            if (sDate !== dateStr) {
              console.log(`Date mismatch for user ${memberId} (${member.employee_number || member.display_name}): schedule date "${sDate}" vs target date "${dateStr}"`);
            } else {
              matchedCount++;
            }
          }
          
          return matches;
        });
        
        if (!existingSchedule) {
          unmatchedCount++;
          // 調試：檢查是否有該用戶的其他排班記錄
          const userSchedules = existingSchedules.filter(s => Number(s.user_id) === Number(member.id));
          if (userSchedules.length > 0) {
            console.log(`No match found for user ${member.id} (${member.employee_number || member.display_name}) on ${dateStr}, but user has ${userSchedules.length} schedules:`, 
              userSchedules.slice(0, 3).map(s => ({ date: this.formatDateString(s.schedule_date), id: s.id })));
          }
        }
        
        if (existingSchedule) {
          // 如果已有記錄，合併假期資料
          const scheduleWithLeave = this.mergeLeaveForSchedule(existingSchedule, dateStr, leaveApplications);
          allSchedules.push(scheduleWithLeave);
        } else {
          // 如果沒有記錄，檢查是否有假期申請
          const scheduleWithLeave = this.createScheduleFromLeave(member, dateStr, departmentGroupId, leaveApplications);
          if (scheduleWithLeave) {
            allSchedules.push(scheduleWithLeave);
          } else {
            // 即使沒有排班記錄也沒有假期申請，也要創建一個空的排班記錄
            // 這樣前端才能顯示所有成員的所有日期
            const emptySchedule = this.createEmptySchedule(member, dateStr, departmentGroupId);
            allSchedules.push(emptySchedule);
          }
        }
      }
    }
    
    console.log(`generateSchedulesForMembersAndDates result: ${matchedCount} matched, ${unmatchedCount} unmatched, total: ${allSchedules.length}`);
    
    return allSchedules;
  }
  
  // 輔助方法：格式化日期為字符串（使用 UTC+8 時區）
  formatDateString(date) {
    return this.formatDateToUTC8(date);
  }
  
  // 輔助方法：為現有排班記錄合併假期資料
  mergeLeaveForSchedule(schedule, scheduleDateStr, leaveApplications) {
    const userId = schedule.user_id;
    
    // 如果排班記錄已經有手動輸入的假期類型，優先保留排班表中的假期
    // 只有在排班記錄沒有假期類型時，才用已批核的假期申請覆蓋
    if (schedule.leave_type_id) {
      return schedule;
    }
    
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
        store_id: null,
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
  
  // 輔助方法：創建空的排班記錄（用於顯示沒有排班記錄也沒有假期申請的情況）
  createEmptySchedule(member, scheduleDateStr, departmentGroupId) {
    return {
      id: null,
      user_id: member.id,
      department_group_id: departmentGroupId,
      schedule_date: scheduleDateStr,
      start_time: null,
      end_time: null,
      store_id: null,
      leave_type_id: null,
      leave_session: null,
      user_name: member.display_name || member.name,
      user_name_zh: member.name_zh,
      employee_number: member.employee_number,
      leave_type_code: null,
      leave_type_name: null,
      leave_type_name_zh: null
    };
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

      const canViewRemarks = await Schedule.canViewScheduleRemarks(
        userId,
        schedule.department_group_id,
        req.user.is_system_admin
      );

      res.json({ schedule: this._sanitizeScheduleRemarks(schedule, canViewRemarks) });
    } catch (error) {
      console.error('Get schedule error:', error);
      res.status(500).json({ message: '取得排班記錄失敗', error: error.message });
    }
  }

  // 建立排班記錄（單筆）
  async createSchedule(req, res) {
    try {
      const { user_id, department_group_id, schedule_date, start_time, end_time, leave_type_id, leave_session, store_id, remarks } = req.body;
      const userId = req.user.id;

      // 驗證必填欄位
      if (!user_id || !department_group_id || !schedule_date) {
        return res.status(400).json({ message: '缺少必填欄位' });
      }

      // 檢查編輯權限（checker 時會檢查 schedule_date 是否在可編輯範圍內，UTC+8）
      const canEdit = await Schedule.canEditSchedule(userId, department_group_id, schedule_date);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限編輯此群組的排班表，或該日期不在 Checker 可編輯範圍內' });
      }

      const actorRole = await Schedule.getActorRole(userId, department_group_id, req.user.is_system_admin);

      // 檢查用戶是否屬於該群組
      const isInGroup = await Schedule.isUserInGroup(user_id, department_group_id);
      if (!isInGroup) {
        return res.status(400).json({ message: '該用戶不屬於指定的群組' });
      }

      // 如果提供了leave_type_id，驗證該假期類型是否允許在排班表中輸入
      if (leave_type_id) {
        const LeaveType = require('../database/models/LeaveType');
        const leaveType = await LeaveType.findById(leave_type_id);
        if (!leaveType) {
          return res.status(400).json({ message: '無效的假期類型' });
        }
        if (!leaveType.allow_schedule_input) {
          return res.status(400).json({ message: '此假期類型不允許在排班表中手動輸入' });
        }
        // 驗證leave_session（如果提供）
        if (leave_session && leave_session !== 'AM' && leave_session !== 'PM') {
          return res.status(400).json({ message: '假期時段必須是 AM 或 PM' });
        }
      }

      // 如果提供了store_id，驗證該店舖是否存在
      let validStoreId = null;
      if (store_id !== undefined && store_id !== null && store_id !== '') {
        const knex = require('../config/database');
        const storeIdNum = Number(store_id);
        if (isNaN(storeIdNum)) {
          return res.status(400).json({ message: `無效的店舖ID格式: ${store_id}` });
        }
        const store = await knex('stores').where('id', storeIdNum).first();
        if (!store) {
          return res.status(400).json({ message: `無效的店舖ID: ${storeIdNum}` });
        }
        validStoreId = store.id; // 使用查詢返回的 store.id 確保類型正確
      }

      const scheduleData = {
        user_id,
        department_group_id,
        schedule_date,
        start_time: start_time || null,
        end_time: end_time || null,
        leave_type_id: leave_type_id || null,
        leave_session: leave_session || null,
        store_id: validStoreId,
        remarks: remarks !== undefined && remarks !== null && String(remarks).trim() !== '' ? String(remarks).trim() : null,
        created_by_id: userId,
        updated_by_id: userId
      };

      if (actorRole.requireApproval) {
        return await this._respondCheckerDraft(req, res, department_group_id, [{
          user_id,
          schedule_date,
          action: 'upsert',
          department_group_id,
          start_time: scheduleData.start_time,
          end_time: scheduleData.end_time,
          leave_type_id: scheduleData.leave_type_id,
          leave_session: scheduleData.leave_session,
          store_id: scheduleData.store_id,
          remarks: scheduleData.remarks
        }]);
      }

      const schedule = await Schedule.create(scheduleData);
      await this._logDirectScheduleChange(department_group_id, userId, user_id, schedule_date, null, schedule);
      await this._syncOfficialSchedule(schedule);
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

      const departmentGroupIds = [...new Set(schedules.map(s => s.department_group_id))];
      if (departmentGroupIds.length > 1) {
        return res.status(400).json({ message: '批量排班只能針對單一群組' });
      }

      const departmentGroupId = departmentGroupIds[0];
      const actorRole = await Schedule.getActorRole(userId, departmentGroupId, req.user.is_system_admin);
      const knex = require('../config/database');
      const group = actorRole.group || await knex('department_groups').where('id', departmentGroupId).first();

      const canEditGroup = !!(
        actorRole.isAdmin ||
        actorRole.isApprover ||
        (actorRole.isChecker && group && group.allow_checker_edit !== false)
      );
      if (!canEditGroup) {
        return res.status(403).json({
          message: '您沒有權限編輯此群組的排班表，或日期不在 Checker 可編輯範圍內（UTC+8）'
        });
      }

      const restrictCheckerDates = !actorRole.isAdmin && !actorRole.isApprover && actorRole.isChecker;
      const memberIdSet = new Set(Schedule.parseGroupUserIds(group));

      for (const schedule of schedules) {
        if (!schedule.user_id || !schedule.schedule_date) {
          return res.status(400).json({ message: '每筆排班記錄必須包含 user_id 和 schedule_date' });
        }
        if (restrictCheckerDates && !Schedule.isDateInCheckerEditableRange(group, schedule.schedule_date)) {
          return res.status(403).json({
            message: `您沒有權限編輯此群組的排班表，或日期 ${schedule.schedule_date} 不在 Checker 可編輯範圍內（UTC+8）`
          });
        }
        if (!memberIdSet.has(Number(schedule.user_id))) {
          return res.status(400).json({
            message: `用戶 ID ${schedule.user_id} 不屬於指定的群組`
          });
        }
      }

      if (actorRole.requireApproval) {
        return await this._respondCheckerDraft(req, res, departmentGroupId, schedules.map(s => ({
          user_id: s.user_id,
          schedule_date: s.schedule_date,
          action: 'upsert',
          department_group_id: departmentGroupId,
          start_time: s.start_time || null,
          end_time: s.end_time || null,
          leave_type_id: s.leave_type_id !== undefined && s.leave_type_id !== null && s.leave_type_id !== '' ? Number(s.leave_type_id) : null,
          leave_session: s.leave_session !== undefined && s.leave_session !== null && s.leave_session !== '' ? s.leave_session : null,
          store_id: s.store_id !== undefined && s.store_id !== null && s.store_id !== '' ? Number(s.store_id) : null
        })));
      }

      const storeIds = [...new Set(schedules.map(s => s.store_id).filter(id => id !== undefined && id !== null && id !== ''))];
      if (storeIds.length > 0) {
        const validStores = await knex('stores').whereIn('id', storeIds).select('id');
        const validStoreIds = validStores.map(s => s.id);
        const invalidStoreIds = storeIds.filter(id => !validStoreIds.includes(Number(id)));
        if (invalidStoreIds.length > 0) {
          return res.status(400).json({
            message: `無效的店舖ID: ${invalidStoreIds.join(', ')}`
          });
        }
      }

      const schedulesData = schedules.map(s => ({
        user_id: s.user_id,
        department_group_id: departmentGroupId,
        schedule_date: s.schedule_date,
        start_time: s.start_time || null,
        end_time: s.end_time || null,
        leave_type_id: s.leave_type_id !== undefined && s.leave_type_id !== null && s.leave_type_id !== '' ? Number(s.leave_type_id) : null,
        leave_session: s.leave_session !== undefined && s.leave_session !== null && s.leave_session !== '' ? s.leave_session : null,
        store_id: s.store_id !== undefined && s.store_id !== null && s.store_id !== '' ? Number(s.store_id) : null,
        created_by_id: userId,
        updated_by_id: userId
      }));

      const createdSchedules = await Schedule.createBatch(schedulesData);
      await this._logDirectScheduleChangesBatch(departmentGroupId, userId, createdSchedules);

      res.status(201).json({
        schedules: createdSchedules,
        message: `成功建立 ${createdSchedules.length} 筆排班記錄`
      });

      Promise.all(createdSchedules.map((s) => this._syncOfficialSchedule(s))).catch((error) => {
        console.error('Batch sync official schedule error:', error);
      });
    } catch (error) {
      console.error('Create batch schedules error:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: '批量建立排班記錄失敗', error: error.message });
      }
    }
  }

  // 更新排班記錄
  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { start_time, end_time, leave_type_id, leave_session, store_id, department_group_id, remarks } = req.body;
      const userId = req.user.id;

      const schedule = await Schedule.findById(id);
      if (!schedule) {
        return res.status(404).json({ message: '排班記錄不存在' });
      }

      // 檢查編輯權限（checker 時會檢查 schedule_date 是否在可編輯範圍內，UTC+8）
      const canEdit = await Schedule.canEditSchedule(userId, schedule.department_group_id, schedule.schedule_date);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限編輯此排班記錄，或該日期不在 Checker 可編輯範圍內' });
      }

      const actorRole = await Schedule.getActorRole(userId, schedule.department_group_id, req.user.is_system_admin);

      // 如果提供了leave_type_id，驗證該假期類型是否允許在排班表中輸入
      if (leave_type_id !== undefined) {
        if (leave_type_id) {
          const LeaveType = require('../database/models/LeaveType');
          const leaveType = await LeaveType.findById(leave_type_id);
          if (!leaveType) {
            return res.status(400).json({ message: '無效的假期類型' });
          }
          if (!leaveType.allow_schedule_input) {
            return res.status(400).json({ message: '此假期類型不允許在排班表中手動輸入' });
          }
          // 驗證leave_session（如果提供）
          if (leave_session && leave_session !== 'AM' && leave_session !== 'PM') {
            return res.status(400).json({ message: '假期時段必須是 AM 或 PM' });
          }
        }
      }

      // 如果提供了store_id，驗證該店舖是否存在
      let validStoreId = null;
      if (store_id !== undefined) {
        if (store_id !== null && store_id !== '') {
          const knex = require('../config/database');
          const storeIdNum = Number(store_id);
          if (isNaN(storeIdNum)) {
            return res.status(400).json({ message: `無效的店舖ID格式: ${store_id}` });
          }
          const store = await knex('stores').where('id', storeIdNum).first();
          if (!store) {
            return res.status(400).json({ message: `無效的店舖ID: ${storeIdNum}` });
          }
          validStoreId = store.id; // 使用查詢返回的 store.id 確保類型正確
        }
      }

      const updateData = {
        updated_by_id: userId
      };
      if (start_time !== undefined) updateData.start_time = start_time || null;
      if (end_time !== undefined) updateData.end_time = end_time || null;
      if (leave_type_id !== undefined) updateData.leave_type_id = leave_type_id || null;
      if (leave_session !== undefined) updateData.leave_session = leave_session || null;
      if (store_id !== undefined) updateData.store_id = validStoreId;
      if (department_group_id !== undefined && department_group_id !== null && department_group_id !== '') {
        updateData.department_group_id = Number(department_group_id);
      }
      if (remarks !== undefined) {
        updateData.remarks = remarks !== null && String(remarks).trim() !== '' ? String(remarks).trim() : null;
      }

      if (actorRole.requireApproval) {
        return await this._respondCheckerDraft(req, res, schedule.department_group_id, [{
          user_id: schedule.user_id,
          schedule_date: schedule.schedule_date,
          action: 'upsert',
          department_group_id: updateData.department_group_id || schedule.department_group_id,
          start_time: updateData.start_time !== undefined ? updateData.start_time : schedule.start_time,
          end_time: updateData.end_time !== undefined ? updateData.end_time : schedule.end_time,
          leave_type_id: updateData.leave_type_id !== undefined ? updateData.leave_type_id : schedule.leave_type_id,
          leave_session: updateData.leave_session !== undefined ? updateData.leave_session : schedule.leave_session,
          store_id: updateData.store_id !== undefined ? updateData.store_id : schedule.store_id,
          remarks: updateData.remarks !== undefined ? updateData.remarks : schedule.remarks
        }]);
      }

      const updatedSchedule = await Schedule.update(id, updateData);
      await this._logDirectScheduleChange(
        updatedSchedule.department_group_id,
        userId,
        updatedSchedule.user_id,
        updatedSchedule.schedule_date,
        schedule,
        updatedSchedule
      );
      await this._syncOfficialSchedule(updatedSchedule);
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

      // 檢查編輯權限（checker 時會檢查 schedule_date 是否在可編輯範圍內，UTC+8）
      const canEdit = await Schedule.canEditSchedule(userId, schedule.department_group_id, schedule.schedule_date);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限刪除此排班記錄，或該日期不在 Checker 可編輯範圍內' });
      }

      const actorRole = await Schedule.getActorRole(userId, schedule.department_group_id, req.user.is_system_admin);
      if (actorRole.requireApproval) {
        return await this._respondCheckerDraft(req, res, schedule.department_group_id, [{
          user_id: schedule.user_id,
          schedule_date: schedule.schedule_date,
          action: 'delete',
          department_group_id: schedule.department_group_id,
          start_time: null,
          end_time: null,
          leave_type_id: null,
          leave_session: null,
          store_id: null,
          remarks: null
        }]);
      }

      await Schedule.delete(id);
      await this._logDirectScheduleChange(
        schedule.department_group_id,
        userId,
        schedule.user_id,
        schedule.schedule_date,
        schedule,
        { action: 'delete' }
      );
      await this._syncOfficialSchedule({
        user_id: schedule.user_id,
        schedule_date: schedule.schedule_date,
        id: null,
        store_id: null,
        start_time: null,
        end_time: null,
        leave_type_name_zh: null,
        leave_session: null
      });
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

      // 檢查編輯權限（若為單一 schedule_date 則檢查 checker 可編輯範圍 UTC+8）
      const canEdit = await Schedule.canEditSchedule(userId, department_group_id, schedule_date || null);
      if (!canEdit) {
        return res.status(403).json({ message: '您沒有權限刪除此群組的排班記錄，或該日期不在 Checker 可編輯範圍內' });
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
    
    // 查詢已批核的假期申請（LeaveApplication.findAll 會回傳物件：{ applications, total, ... }）
    const leaveResult = await LeaveApplication.findAll({
      status: 'approved',
      start_date_from: startDate,
      end_date_to: endDate
    });
    const allLeaveApplications = Array.isArray(leaveResult?.applications) ? leaveResult.applications : [];
    
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
    
    // 查詢已批核的假期申請（LeaveApplication.findAll 會回傳物件：{ applications, total, ... }）
    const leaveResult = await LeaveApplication.findAll({
      status: 'approved',
      start_date_from: startDate,
      end_date_to: endDate
    });
    const allLeaveApplications = Array.isArray(leaveResult?.applications) ? leaveResult.applications : [];
    
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

  _sanitizeScheduleRemarks(schedule, canViewRemarks) {
    if (!schedule || canViewRemarks) {
      return schedule;
    }
    const { remarks, ...rest } = schedule;
    return rest;
  }

  // 將 DB 的 DATE 欄位格式為 YYYY-MM-DD 再回傳。node-pg 在 UTC+8 會回傳當地午夜（即 UTC 前一日），
  // 所以用「當地」年月日 (getFullYear/getMonth/getDate) 還原日曆日，唔好用 getUTC*
  _formatDateForResponse(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
    }
    if (val && typeof val.getFullYear === 'function') {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  _formatGroupDateFields(group) {
    if (!group) return group;
    const out = { ...group };
    if (out.checker_editable_start_date != null) {
      out.checker_editable_start_date = this._formatDateForResponse(out.checker_editable_start_date);
    }
    if (out.checker_editable_end_date != null) {
      out.checker_editable_end_date = this._formatDateForResponse(out.checker_editable_end_date);
    }
    return out;
  }

  async _attachPendingItemCounts(groups, userId, isSystemAdmin) {
    const counts = await ScheduleChange.countPendingItemsByGroupForUser(userId, isSystemAdmin);
    return (groups || []).map((group) => ({
      ...group,
      pending_item_count: counts[Number(group.id)] || 0
    }));
  }

  // 獲取用戶有權限查看的排班群組列表（包括直接所屬和通過授權群組關聯的）
  async getAccessibleScheduleGroups(req, res) {
    try {
      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const User = require('../database/models/User');
      const DepartmentGroup = require('../database/models/DepartmentGroup');
      
      // 系統管理員可以查看所有群組
      if (isSystemAdmin) {
        const allGroups = await DepartmentGroup.findAll({ closed: false });
        const groupsWithDateStr = await this._attachPendingItemCounts(
          allGroups.map(g => this._formatGroupDateFields(g)),
          userId,
          true
        );
        return res.json({ groups: groupsWithDateStr });
      }

      // 獲取用戶直接所屬的部門群組（群組成員可以查看）
      const directDepartmentGroups = await User.getDepartmentGroups(userId);
      
      // 獲取用戶所屬的授權群組
      const userDelegationGroups = await User.getDelegationGroups(userId);
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));
      
      // 獲取所有未關閉的部門群組
      const allDepartmentGroups = await DepartmentGroup.findAll({ closed: false });
      
      // 過濾出用戶通過授權群組可以訪問的部門群組（approver1, approver2, approver3, checker）
      const accessibleViaDelegation = allDepartmentGroups.filter(deptGroup => {
        const checkerId = deptGroup.checker_id ? Number(deptGroup.checker_id) : null;
        const approver1Id = deptGroup.approver_1_id ? Number(deptGroup.approver_1_id) : null;
        const approver2Id = deptGroup.approver_2_id ? Number(deptGroup.approver_2_id) : null;
        const approver3Id = deptGroup.approver_3_id ? Number(deptGroup.approver_3_id) : null;

        return userDelegationGroupIds.includes(checkerId) ||
               userDelegationGroupIds.includes(approver1Id) ||
               userDelegationGroupIds.includes(approver2Id) ||
               userDelegationGroupIds.includes(approver3Id);
      });
      
      // 合併並去重（使用 id 作為唯一標識），並將 DATE 欄位格式為 YYYY-MM-DD 再回傳
      const directGroupIds = directDepartmentGroups.map(g => g.id);
      const allAccessibleGroups = [...directDepartmentGroups.filter(g => !g.closed)].map(g => this._formatGroupDateFields(g));
      
      accessibleViaDelegation.forEach(group => {
        if (!directGroupIds.includes(group.id)) {
          allAccessibleGroups.push(this._formatGroupDateFields(group));
        }
      });
      
      res.json({
        groups: await this._attachPendingItemCounts(allAccessibleGroups, userId, false)
      });
    } catch (error) {
      console.error('Get accessible schedule groups error:', error);
      res.status(500).json({ message: '獲取可訪問的排班群組列表時發生錯誤', error: error.message });
    }
  }

  // 將前端傳入的日期正規化為 YYYY-MM-DD（純日期，用 UTC 解讀避免伺服器時區影響；前端以 UTC+8 送來）
  _normalizeCheckerDate(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'string') {
      const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
    }
    if (val && typeof val.toISOString === 'function') {
      const d = new Date(val);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return null;
  }

  // 更新群組的 checker 編輯權限設置（只有 approver1, approver2, approver3 可以操作）
  async updateCheckerEditPermission(req, res) {
    try {
      const { department_group_id } = req.params;
      const { allow_checker_edit, checker_editable_start_date, checker_editable_end_date, require_checker_schedule_approval } = req.body;
      const userId = req.user.id;

      if (allow_checker_edit === undefined && require_checker_schedule_approval === undefined) {
        return res.status(400).json({ message: '缺少必填欄位 allow_checker_edit 或 require_checker_schedule_approval' });
      }

      // 檢查用戶是否為 approver1, approver2 或 approver3
      const group = await DepartmentGroup.findById(department_group_id);
      if (!group) {
        return res.status(404).json({ message: '群組不存在' });
      }

      // 取得用戶所屬的授權群組
      const User = require('../database/models/User');
      const userDelegationGroups = await User.getDelegationGroups(userId);
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
      const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
      const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

      // 系統管理員也可以操作
      if (!req.user.is_system_admin && !isApprover1 && !isApprover2 && !isApprover3) {
        return res.status(403).json({ message: '您沒有權限修改此設置' });
      }

      const updatePayload = {};
      if (allow_checker_edit !== undefined) {
        updatePayload.allow_checker_edit = Boolean(allow_checker_edit);
      }
      if (require_checker_schedule_approval !== undefined) {
        updatePayload.require_checker_schedule_approval = Boolean(require_checker_schedule_approval);
      }
      if (checker_editable_start_date !== undefined) {
        updatePayload.checker_editable_start_date = this._normalizeCheckerDate(checker_editable_start_date);
      }
      if (checker_editable_end_date !== undefined) {
        updatePayload.checker_editable_end_date = this._normalizeCheckerDate(checker_editable_end_date);
      }

      // 更新設置
      const updatedGroup = await DepartmentGroup.update(department_group_id, updatePayload);

      res.json({ 
        message: '設置更新成功',
        group: updatedGroup
      });
    } catch (error) {
      console.error('Update checker edit permission error:', error);
      res.status(500).json({ message: '更新設置失敗', error: error.message });
    }
  }

  // 批量更新所有群組的 checker 編輯權限設置（只有 approver1, approver2, approver3 可以操作）
  // allow_checker_edit 可選；若只傳 checker_editable_start_date / checker_editable_end_date，則只更新「可編輯範圍」並套用到所有群組
  async batchUpdateCheckerEditPermission(req, res) {
    try {
      const { allow_checker_edit, checker_editable_start_date, checker_editable_end_date, require_checker_schedule_approval } = req.body;
      const userId = req.user.id;

      const updatePayload = {};
      if (allow_checker_edit !== undefined) updatePayload.allow_checker_edit = Boolean(allow_checker_edit);
      if (require_checker_schedule_approval !== undefined) updatePayload.require_checker_schedule_approval = Boolean(require_checker_schedule_approval);
      if (checker_editable_start_date !== undefined) updatePayload.checker_editable_start_date = (checker_editable_start_date === null || checker_editable_start_date === '') ? null : this._normalizeCheckerDate(checker_editable_start_date);
      if (checker_editable_end_date !== undefined) updatePayload.checker_editable_end_date = (checker_editable_end_date === null || checker_editable_end_date === '') ? null : this._normalizeCheckerDate(checker_editable_end_date);

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ message: '請提供 allow_checker_edit、require_checker_schedule_approval 或 checker_editable_start_date / checker_editable_end_date' });
      }

      // 獲取用戶所屬的授權群組
      const User = require('../database/models/User');
      const userDelegationGroups = await User.getDelegationGroups(userId);
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      // 獲取所有未關閉的部門群組
      const allGroups = await DepartmentGroup.findAll({ closed: false });

      // 過濾出用戶有權限操作的群組（用戶是該群組的 approver1, approver2 或 approver3）
      const groupsToUpdate = allGroups.filter(group => {
        if (req.user.is_system_admin) {
          return true; // 系統管理員可以操作所有群組
        }

        const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
        const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
        const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

        return isApprover1 || isApprover2 || isApprover3;
      });

      if (groupsToUpdate.length === 0) {
        return res.status(403).json({ message: '您沒有權限修改任何群組的設置' });
      }

      // 批量更新所有有權限的群組
      const groupIds = groupsToUpdate.map(g => g.id);
      await knex('department_groups')
        .whereIn('id', groupIds)
        .update(updatePayload);

      res.json({ 
        message: `成功更新 ${groupsToUpdate.length} 個群組的設置`,
        updated_count: groupsToUpdate.length,
        ...(updatePayload.allow_checker_edit !== undefined && { allow_checker_edit: updatePayload.allow_checker_edit }),
        ...(updatePayload.require_checker_schedule_approval !== undefined && { require_checker_schedule_approval: updatePayload.require_checker_schedule_approval })
      });
    } catch (error) {
      console.error('Batch update checker edit permission error:', error);
      res.status(500).json({ message: '批量更新設置失敗', error: error.message });
    }
  }

  _handleChangeError(error, res) {
    const messages = {
      PENDING_SUBMISSION_EXISTS: { status: 409, message: '已有待批核呈交，請等待 Approver 批核或退回後再修改' },
      ITEM_NOT_EDITABLE: { status: 409, message: '此草稿項目目前不可修改' },
      FORBIDDEN: { status: 403, message: '您沒有權限執行此操作' },
      INVALID_STATUS: { status: 409, message: '呈交狀態不正確，無法執行此操作' },
      EMPTY_SUBMISSION: { status: 400, message: '沒有可呈交的改動' }
    };
    const mapped = messages[error.code];
    if (mapped) {
      res.status(mapped.status).json({ message: mapped.message });
      return true;
    }
    return false;
  }

  async _respondCheckerDraft(req, res, departmentGroupId, items) {
    try {
      const submission = await ScheduleChange.upsertDraftItems(
        departmentGroupId,
        req.user.id,
        items,
        req.user.id
      );
      return res.status(200).json({
        requires_approval: true,
        submission,
        message: '已存入草稿，請呈交後待 Approver 批核方會生效'
      });
    } catch (error) {
      if (this._handleChangeError(error, res)) return;
      throw error;
    }
  }

  async _logDirectScheduleChange(departmentGroupId, actorId, userId, scheduleDate, before, after) {
    try {
      await ScheduleChange.addLog({
        department_group_id: departmentGroupId,
        user_id: userId,
        schedule_date: Schedule._normalizeDateStr(scheduleDate),
        actor_id: actorId,
        action: after && after.action === 'delete' ? 'direct_delete' : 'direct_edit',
        before_payload: before ? Schedule.snapshot(before) : null,
        after_payload: after && after.action === 'delete' ? { action: 'delete' } : Schedule.snapshot(after)
      });
    } catch (error) {
      console.error('Log direct schedule change error:', error);
    }
  }

  async _logDirectScheduleChangesBatch(departmentGroupId, actorId, createdSchedules) {
    if (!createdSchedules || createdSchedules.length === 0) return;
    try {
      await ScheduleChange.addLogs(createdSchedules.map((s) => ({
        department_group_id: departmentGroupId,
        user_id: s.user_id,
        schedule_date: Schedule._normalizeDateStr(s.schedule_date),
        actor_id: actorId,
        action: 'direct_edit',
        before_payload: null,
        after_payload: Schedule.snapshot(s)
      })));
    } catch (error) {
      console.error('Log direct schedule changes batch error:', error);
    }
  }

  async _syncOfficialSchedule(schedule) {
    if (!schedule) return;
    await monthlyAttendanceSummaryController.syncScheduleToMonthlySummary(
      schedule.user_id,
      schedule.schedule_date,
      {
        id: schedule.id || null,
        store_id: schedule.store_id || null,
        start_time: schedule.start_time || null,
        end_time: schedule.end_time || null,
        leave_type_name_zh: schedule.leave_type_name_zh || null,
        leave_session: schedule.leave_session || null,
        is_approved_leave: false
      }
    );
  }

  async _assertCanReviewSubmission(req, submission) {
    if (!submission) return false;
    const role = await Schedule.getActorRole(req.user.id, submission.department_group_id, req.user.is_system_admin);
    return role.isAdmin || role.isApprover;
  }

  async submitScheduleChange(req, res) {
    try {
      const submission = await ScheduleChange.findSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: '呈交記錄不存在' });
      }
      const submitted = await ScheduleChange.submit(req.params.id, req.user.id);
      res.json({ submission: submitted, message: '已呈交，等待 Approver 批核' });
    } catch (error) {
      if (this._handleChangeError(error, res)) return;
      console.error('Submit schedule change error:', error);
      res.status(500).json({ message: '呈交失敗', error: error.message });
    }
  }

  async approveScheduleChange(req, res) {
    try {
      const submission = await ScheduleChange.findSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: '呈交記錄不存在' });
      }
      const canReview = await this._assertCanReviewSubmission(req, submission);
      if (!canReview) {
        return res.status(403).json({ message: '只有 Approver 可以批核編更' });
      }

      const { submission: approved, applied } = await ScheduleChange.approve(req.params.id, req.user.id);
      for (const { item, result } of applied) {
        if (result && result.deleted) {
          await this._syncOfficialSchedule({
            user_id: item.user_id,
            schedule_date: item.schedule_date,
            id: null,
            store_id: null,
            start_time: null,
            end_time: null,
            leave_type_name_zh: null,
            leave_session: null
          });
        } else if (result) {
          const official = await Schedule.findById(result.id);
          await this._syncOfficialSchedule(official || result);
        }
      }
      res.json({
        submission: approved,
        applied: applied.map(({ item, result }) => ({
          user_id: item.user_id,
          schedule_date: item.schedule_date,
          deleted: !!(result && result.deleted),
          schedule: result && !result.deleted ? result : null,
          item
        })),
        message: '已批核，編更已生效'
      });
    } catch (error) {
      if (this._handleChangeError(error, res)) return;
      console.error('Approve schedule change error:', error);
      res.status(500).json({ message: '批核失敗', error: error.message });
    }
  }

  async returnScheduleChange(req, res) {
    try {
      const submission = await ScheduleChange.findSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: '呈交記錄不存在' });
      }
      const canReview = await this._assertCanReviewSubmission(req, submission);
      if (!canReview) {
        return res.status(403).json({ message: '只有 Approver 可以退回編更' });
      }

      const returned = await ScheduleChange.returnSubmission(
        req.params.id,
        req.user.id,
        req.body?.reason || req.body?.return_reason || null
      );
      res.json({ submission: returned, message: '已退回，草稿已保留供 Checker 修改後再呈交' });
    } catch (error) {
      if (this._handleChangeError(error, res)) return;
      console.error('Return schedule change error:', error);
      res.status(500).json({ message: '退回失敗', error: error.message });
    }
  }

  async deleteScheduleChangeItem(req, res) {
    try {
      const submission = await ScheduleChange.removeDraftItem(req.params.itemId, req.user.id);
      if (!submission) {
        return res.status(404).json({ message: '草稿項目不存在' });
      }
      res.json({ submission, message: '已從草稿移除' });
    } catch (error) {
      if (this._handleChangeError(error, res)) return;
      console.error('Delete schedule change item error:', error);
      res.status(500).json({ message: '移除草稿項目失敗', error: error.message });
    }
  }

  async getPendingChangeCount(req, res) {
    try {
      const pending_count = await ScheduleChange.countPendingItemsForUser(
        req.user.id,
        req.user.is_system_admin
      );
      res.json({ pending_count });
    } catch (error) {
      console.error('Get pending schedule change count error:', error);
      res.status(500).json({ message: '取得待批核編更數量失敗', error: error.message });
    }
  }

  async getScheduleChangeLogs(req, res) {
    try {
      const { department_group_id, user_id, schedule_date, start_date, end_date } = req.query;
      if (!department_group_id) {
        return res.status(400).json({ message: '必須指定群組ID' });
      }
      const role = await Schedule.getActorRole(req.user.id, department_group_id, req.user.is_system_admin);
      if (!role.isAdmin && !role.isApprover && !role.isChecker) {
        return res.status(403).json({ message: '您沒有權限查看編更紀錄' });
      }
      const logs = await ScheduleChange.findLogs({
        departmentGroupId: department_group_id,
        userId: user_id || null,
        scheduleDate: schedule_date || null,
        startDate: start_date || null,
        endDate: end_date || null
      });
      res.json({ logs });
    } catch (error) {
      console.error('Get schedule change logs error:', error);
      res.status(500).json({ message: '取得編更紀錄失敗', error: error.message });
    }
  }
}

module.exports = new ScheduleController();
