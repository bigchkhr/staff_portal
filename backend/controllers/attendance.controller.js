const Attendance = require('../database/models/Attendance');
const Schedule = require('../database/models/Schedule');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const ClockRecord = require('../database/models/ClockRecord');
const User = require('../database/models/User');
const LeaveApplication = require('../database/models/LeaveApplication');
const knex = require('../config/database');

class AttendanceController {
  // 取得考勤列表
  // 注意：attendances 表已移除，現在使用 clock_records 表
  async getAttendances(req, res) {
    try {
      // 由於 attendances 表已移除，返回空數組
      // 實際的考勤數據應該從 clock_records 表獲取
      res.json({ attendances: [] });
    } catch (error) {
      console.error('Get attendances error:', error);
      res.status(500).json({ message: '獲取考勤記錄失敗', error: error.message });
    }
  }

  // 取得單一考勤記錄
  // 注意：attendances 表已移除，現在使用 clock_records 表
  async getAttendance(req, res) {
    try {
      // 由於 attendances 表已移除，返回 404
      return res.status(404).json({ message: '考勤記錄不存在（attendances 表已移除，請使用 clock_records）' });
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ message: '獲取考勤記錄失敗', error: error.message });
    }
  }

  // 建立考勤記錄
  // 注意：attendances 表已移除，現在直接創建 clock_records
  async createAttendance(req, res) {
    try {
      const userId = req.user.id;
      const {
        user_id,
        employee_number,
        department_group_id,
        attendance_date,
        clock_in_time,
        clock_out_time,
        time_off_start,
        time_off_end,
        remarks
      } = req.body;

      console.log('createAttendance - req.body:', req.body);
      console.log('createAttendance - attendance_date:', attendance_date);
      console.log('createAttendance - attendance_date type:', typeof attendance_date);

      if (!attendance_date) {
        return res.status(400).json({ message: '請提供考勤日期' });
      }

      // 處理 attendance_date：可能是字符串、Date 對象或空值
      let finalAttendanceDate = attendance_date;
      
      // 如果是 Date 對象，轉換為 YYYY-MM-DD 格式字符串
      if (finalAttendanceDate instanceof Date) {
        const year = finalAttendanceDate.getFullYear();
        const month = String(finalAttendanceDate.getMonth() + 1).padStart(2, '0');
        const day = String(finalAttendanceDate.getDate()).padStart(2, '0');
        finalAttendanceDate = `${year}-${month}-${day}`;
      } else if (typeof finalAttendanceDate === 'string') {
        // 如果是字符串，移除時間部分（如果有）
        finalAttendanceDate = finalAttendanceDate.split('T')[0].split(' ')[0];
        // 驗證格式是否為 YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalAttendanceDate)) {
          console.error('createAttendance - invalid date format:', finalAttendanceDate);
          return res.status(400).json({ message: `attendance_date 格式不正確: ${finalAttendanceDate}，應為 YYYY-MM-DD` });
        }
      }

      console.log('createAttendance - finalAttendanceDate:', finalAttendanceDate);

      // 獲取用戶信息：優先使用 employee_number，如果沒有則使用 user_id
      let user;
      if (employee_number) {
        user = await User.findByEmployeeNumber(employee_number);
        if (!user) {
          return res.status(400).json({ message: `找不到員工編號為 ${employee_number} 的用戶` });
        }
      } else if (user_id) {
        user = await User.findById(user_id);
        if (!user) {
          return res.status(400).json({ message: '找不到指定的用戶' });
        }
      } else {
        return res.status(400).json({ message: '請提供 user_id 或 employee_number' });
      }

      if (!user.employee_number) {
        return res.status(400).json({ message: '用戶沒有員工編號，無法創建打卡記錄' });
      }

      // 如果有打卡時間，創建打卡記錄到 clock_records 表
      if (clock_in_time || clock_out_time || time_off_start || time_off_end) {
        const clockRecords = [];
        
        if (clock_in_time) {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: clock_in_time,
            in_out: 'IN1',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (time_off_start) {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: time_off_start,
            in_out: 'OUT1',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (time_off_end) {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: time_off_end,
            in_out: 'IN2',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (clock_out_time) {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: clock_out_time,
            in_out: 'OUT2',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        
        if (clockRecords.length > 0) {
          await ClockRecord.createBatch(clockRecords);
        }
      }
      
      res.status(201).json({ 
        message: '考勤記錄建立成功（已創建到 clock_records 表）',
        clock_records_created: clock_in_time || clock_out_time || time_off_start || time_off_end ? true : false
      });
    } catch (error) {
      console.error('Create attendance error:', error);
      res.status(500).json({ message: '建立考勤記錄失敗', error: error.message });
    }
  }

  // 更新考勤記錄
  // 注意：attendances 表已移除，現在直接更新 clock_records 表
  async updateAttendance(req, res) {
    try {
      const userId = req.user.id;
      // id 參數不再使用（因為 attendances 表已移除），但保留以兼容現有路由
      const {
        user_id,
        employee_number,
        attendance_date,
        clock_in_time,
        clock_out_time,
        time_off_start,
        time_off_end,
        remarks
      } = req.body;

      console.log('updateAttendance - req.body:', req.body);
      console.log('updateAttendance - attendance_date:', attendance_date);
      console.log('updateAttendance - attendance_date type:', typeof attendance_date);

      // 需要提供 attendance_date，以及 user_id 或 employee_number
      // 處理 attendance_date：可能是字符串、Date 對象或空值
      let finalAttendanceDate = attendance_date;
      
      if (!finalAttendanceDate) {
        console.error('updateAttendance - attendance_date is missing or empty');
        return res.status(400).json({ message: '請提供 attendance_date' });
      }

      // 如果是 Date 對象，轉換為 YYYY-MM-DD 格式字符串
      if (finalAttendanceDate instanceof Date) {
        const year = finalAttendanceDate.getFullYear();
        const month = String(finalAttendanceDate.getMonth() + 1).padStart(2, '0');
        const day = String(finalAttendanceDate.getDate()).padStart(2, '0');
        finalAttendanceDate = `${year}-${month}-${day}`;
      } else if (typeof finalAttendanceDate === 'string') {
        // 如果是字符串，移除時間部分（如果有）
        finalAttendanceDate = finalAttendanceDate.split('T')[0].split(' ')[0];
        // 驗證格式是否為 YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalAttendanceDate)) {
          console.error('updateAttendance - invalid date format:', finalAttendanceDate);
          return res.status(400).json({ message: `attendance_date 格式不正確: ${finalAttendanceDate}，應為 YYYY-MM-DD` });
        }
      }

      console.log('updateAttendance - finalAttendanceDate:', finalAttendanceDate);

      let user;
      if (employee_number) {
        // 如果提供了 employee_number，根據它查找用戶
        user = await User.findByEmployeeNumber(employee_number);
        if (!user) {
          return res.status(400).json({ message: `找不到員工編號為 ${employee_number} 的用戶` });
        }
      } else if (user_id) {
        // 如果提供了 user_id，直接查找用戶
        user = await User.findById(user_id);
        if (!user) {
          return res.status(400).json({ message: '找不到指定的用戶' });
        }
      } else {
        return res.status(400).json({ message: '請提供 user_id 或 employee_number' });
      }

      if (!user.employee_number) {
        return res.status(400).json({ message: '用戶沒有員工編號，無法更新打卡記錄' });
      }

      // 檢查用戶是否有權限更新此用戶的考勤記錄
      const currentUserId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const userGroups = await DepartmentGroup.findByUserId(user.id);
      if (userGroups.length === 0) {
        return res.status(403).json({ message: '該用戶不屬於任何群組，無法更新考勤記錄' });
      }
      // 檢查當前用戶是否至少是該用戶所屬群組之一的批核成員
      let hasPermission = isSystemAdmin;
      if (!hasPermission) {
        for (const group of userGroups) {
          const canView = await this.canViewGroupAttendance(currentUserId, group.id, false);
          if (canView) {
            hasPermission = true;
            break;
          }
        }
      }
      if (!hasPermission) {
        return res.status(403).json({ message: '您沒有權限更新此用戶的考勤記錄（必須是該用戶所屬群組的 checker、approver1、approver2 或 approver3）' });
      }

      // 更新打卡記錄到 clock_records 表
      // 只有在有實際的時間值（不是 null 或空字符串）時才處理
      const hasActualTimeInput = (clock_in_time && clock_in_time.trim() !== '') ||
                                  (clock_out_time && clock_out_time.trim() !== '') ||
                                  (time_off_start && time_off_start.trim() !== '') ||
                                  (time_off_end && time_off_end.trim() !== '');
      
      if (hasActualTimeInput) {
        // 只刪除手動創建的記錄（created_by_id 不為 null）
        // 保留從 CSV 導入的記錄
        await knex('clock_records')
          .where('employee_number', user.employee_number)
          .where('attendance_date', finalAttendanceDate)
          .whereNotNull('created_by_id')
          .delete();
        
        // 創建新的打卡記錄
        const clockRecords = [];
        
        if (clock_in_time && clock_in_time.trim() !== '') {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: clock_in_time,
            in_out: 'IN1',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (time_off_start && time_off_start.trim() !== '') {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: time_off_start,
            in_out: 'OUT1',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (time_off_end && time_off_end.trim() !== '') {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: time_off_end,
            in_out: 'IN2',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        if (clock_out_time && clock_out_time.trim() !== '') {
          clockRecords.push({
            employee_number: user.employee_number,
            name: user.display_name || user.name_zh || user.name || '',
            branch_code: '',
            attendance_date: finalAttendanceDate,
            clock_time: clock_out_time,
            in_out: 'OUT2',
            is_valid: true,
            created_by_id: userId,
            updated_by_id: userId
          });
        }
        
        if (clockRecords.length > 0) {
          await ClockRecord.createBatch(clockRecords);
        }
      }
      
      res.json({ message: '考勤記錄更新成功（已更新到 clock_records 表）' });
    } catch (error) {
      console.error('Update attendance error:', error);
      res.status(500).json({ message: '更新考勤記錄失敗', error: error.message });
    }
  }

  // 刪除考勤記錄
  // 注意：attendances 表已移除，現在刪除 clock_records
  async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      const { user_id, attendance_date } = req.body;

      // 由於 attendances 表已移除，需要提供 user_id 和 attendance_date
      if (!user_id || !attendance_date) {
        return res.status(400).json({ message: '請提供 user_id 和 attendance_date（attendances 表已移除）' });
      }

      const user = await User.findById(user_id);
      if (!user || !user.employee_number) {
        return res.status(400).json({ message: '用戶沒有員工編號，無法刪除打卡記錄' });
      }

      // 檢查用戶是否有權限刪除此用戶的考勤記錄
      const currentUserId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const userGroups = await DepartmentGroup.findByUserId(user.id);
      if (userGroups.length === 0) {
        return res.status(403).json({ message: '該用戶不屬於任何群組，無法刪除考勤記錄' });
      }
      // 檢查當前用戶是否至少是該用戶所屬群組之一的批核成員
      let hasPermission = isSystemAdmin;
      if (!hasPermission) {
        for (const group of userGroups) {
          const canView = await this.canViewGroupAttendance(currentUserId, group.id, false);
          if (canView) {
            hasPermission = true;
            break;
          }
        }
      }
      if (!hasPermission) {
        return res.status(403).json({ message: '您沒有權限刪除此用戶的考勤記錄（必須是該用戶所屬群組的 checker、approver1、approver2 或 approver3）' });
      }

      // 刪除該員工該日期的所有打卡記錄
      await knex('clock_records')
        .where('employee_number', user.employee_number)
        .where('attendance_date', attendance_date)
        .delete();

      res.json({ message: '考勤記錄刪除成功（已從 clock_records 表刪除）' });
    } catch (error) {
      console.error('Delete attendance error:', error);
      res.status(500).json({ message: '刪除考勤記錄失敗', error: error.message });
    }
  }

  // 獲取考勤統計（對比排班表）
  async getAttendanceComparison(req, res) {
    try {
      const {
        department_group_id,
        start_date,
        end_date
      } = req.query;

      if (!department_group_id || !start_date || !end_date) {
        return res.status(400).json({ message: '請提供部門群組ID、開始日期和結束日期' });
      }

      // 檢查用戶是否有權限查看此群組的考勤
      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const canView = await this.canViewGroupAttendance(userId, department_group_id, isSystemAdmin);
      if (!canView) {
        return res.status(403).json({ message: '您沒有權限查看此群組的考勤記錄' });
      }

      // 獲取群組成員
      const members = await DepartmentGroup.getMembers(department_group_id);

      // 獲取日期範圍內的所有排班記錄
      const allSchedules = await Schedule.findAll({
        department_group_id,
        start_date,
        end_date
      });
      
      // 將排班記錄轉換為按用戶和日期索引的格式
      const schedules = {};
      allSchedules.forEach(schedule => {
        const key = `${schedule.user_id}_${schedule.schedule_date}`;
        schedules[key] = schedule;
      });

      // 獲取所有群組成員在日期範圍內已批准的假期申請
      const approvedLeaves = {};
      try {
        const memberIds = members.map(m => m.id);
        if (memberIds.length > 0) {
          // 查詢所有已批准的假期申請（不指定user_id，因為findAll不支持多個user_id）
          const allLeaveApplications = await LeaveApplication.findAll({
            status: 'approved',
            start_date_from: start_date,
            end_date_to: end_date
          });

          console.log(`Found ${allLeaveApplications.length} approved leave applications in date range`);

          // 過濾出群組成員的假期申請，並排除已取消或已銷假的申請
          const validApplications = allLeaveApplications.filter(app => {
            // 檢查用戶是否為群組成員（確保類型匹配）
            const appUserId = Number(app.user_id);
            const isMember = memberIds.some(id => Number(id) === appUserId);
            // 排除已取消的申請
            const notCancelled = !app.is_cancellation_request;
            // 排除已銷假的申請
            const notReversed = !app.is_reversed;
            // 排除銷假交易本身
            const notReversalTransaction = !app.is_reversal_transaction;
            
            return isMember && notCancelled && notReversed && notReversalTransaction;
          });

          console.log(`Filtered to ${validApplications.length} valid leave applications for group members`);

          // 將假期申請轉換為按用戶和日期索引的格式
          validApplications.forEach(app => {
            // 確保日期格式正確
            let startDateStr = app.start_date;
            let endDateStr = app.end_date;
            
            // 如果日期是Date對象，轉換為字符串
            if (startDateStr instanceof Date) {
              const year = startDateStr.getFullYear();
              const month = String(startDateStr.getMonth() + 1).padStart(2, '0');
              const day = String(startDateStr.getDate()).padStart(2, '0');
              startDateStr = `${year}-${month}-${day}`;
            } else if (typeof startDateStr === 'string') {
              startDateStr = startDateStr.split('T')[0].split(' ')[0];
            }
            
            if (endDateStr instanceof Date) {
              const year = endDateStr.getFullYear();
              const month = String(endDateStr.getMonth() + 1).padStart(2, '0');
              const day = String(endDateStr.getDate()).padStart(2, '0');
              endDateStr = `${year}-${month}-${day}`;
            } else if (typeof endDateStr === 'string') {
              endDateStr = endDateStr.split('T')[0].split(' ')[0];
            }

            const startDate = new Date(startDateStr + 'T00:00:00');
            const endDate = new Date(endDateStr + 'T23:59:59');
            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
              const year = currentDate.getFullYear();
              const month = String(currentDate.getMonth() + 1).padStart(2, '0');
              const day = String(currentDate.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;
              // 確保 user_id 是數字類型，以便匹配
              const userId = Number(app.user_id);
              const key = `${userId}_${dateStr}`;

              // 初始化數組（如果不存在）
              if (!approvedLeaves[key]) {
                approvedLeaves[key] = [];
              }
              
              // 避免重複添加相同的假期申請
              const existing = approvedLeaves[key].find(l => l.id === app.id);
              if (!existing) {
                // 使用 LeaveApplication.getSessionForDate 來計算該日期的時段
                const leaveSession = LeaveApplication.getSessionForDate(app, dateStr);
                approvedLeaves[key].push({
                  id: app.id,
                  leave_type_name_zh: app.leave_type_name_zh || app.leave_type_name || '',
                  leave_session: leaveSession, // 使用正確的邏輯計算時段
                  start_date: startDateStr,
                  end_date: endDateStr
                });
              }

              currentDate.setDate(currentDate.getDate() + 1);
            }
          });

          console.log(`Mapped to ${Object.keys(approvedLeaves).length} date keys`);
        }
      } catch (error) {
        console.error('Get approved leaves error:', error);
        console.error('Error stack:', error.stack);
        // 如果獲取假期失敗，不影響其他功能，繼續執行
      }

      // 生成日期列表（避免時區轉換問題，直接使用字符串日期）
      const dates = [];
      const start = new Date(start_date + 'T00:00:00'); // 明確指定為本地時間
      const end = new Date(end_date + 'T23:59:59'); // 明確指定為本地時間
      
      // 使用日期字符串直接處理，避免時區轉換
      let currentDate = new Date(start);
      const endDate = new Date(end);
      
      while (currentDate <= endDate) {
        // 使用本地時間的年份、月份、日期，避免UTC轉換
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 批量獲取所有打卡記錄（從 clock_records 表）
      // 獲取基於 employee_number 的打卡記錄（從CSV導入的原始數據）
      const clockRecordsByEmployee = {};
      try {
        // 獲取群組成員的 employee_number 列表，確保轉換為字符串
        const employeeNumbers = members
          .map(m => m.employee_number ? String(m.employee_number).trim() : null)
          .filter(Boolean);
        
        console.log('Fetching clock records for employee_numbers:', employeeNumbers);
        console.log('Date range:', start_date, 'to', end_date);
        
        if (employeeNumbers.length > 0) {
          const rawClockRecords = await knex('clock_records')
            .select(
              'clock_records.id',
              'clock_records.employee_number',
              'clock_records.name',
              'clock_records.branch_code',
              'clock_records.attendance_date',
              'clock_records.clock_time', // 現在是 VARCHAR 類型，直接使用
              'clock_records.in_out',
              'clock_records.is_valid',
              'clock_records.remarks',
              'clock_records.created_by_id',
              'clock_records.updated_by_id',
              'clock_records.created_at',
              'clock_records.updated_at'
            )
            .whereIn('clock_records.employee_number', employeeNumbers)
            .where('clock_records.attendance_date', '>=', start_date)
            .where('clock_records.attendance_date', '<=', end_date)
            .orderBy('clock_records.attendance_date', 'asc')
            .orderBy('clock_records.clock_time', 'asc');
          
          console.log(`Found ${rawClockRecords.length} clock records`);
          
          // 調試：檢查第一條記錄的 clock_time
          if (rawClockRecords.length > 0) {
            console.log('Sample clock record:', JSON.stringify(rawClockRecords[0], null, 2));
          }
          
          rawClockRecords.forEach(record => {
            // 確保 employee_number 和 attendance_date 都是字符串格式
            const empNum = String(record.employee_number).trim();
            let dateStr;
            if (record.attendance_date instanceof Date) {
              // 使用本地時間的年份、月份、日期，避免UTC轉換
              const year = record.attendance_date.getFullYear();
              const month = String(record.attendance_date.getMonth() + 1).padStart(2, '0');
              const day = String(record.attendance_date.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            } else {
              // 已經是字符串格式，直接使用（移除時間部分）
              dateStr = String(record.attendance_date).split('T')[0].split(' ')[0];
            }
            const key = `${empNum}_${dateStr}`;
            
            if (!clockRecordsByEmployee[key]) {
              clockRecordsByEmployee[key] = [];
            }
            clockRecordsByEmployee[key].push(record);
          });
          
          console.log('Clock records grouped by key:', Object.keys(clockRecordsByEmployee).length, 'keys');
        }
      } catch (error) {
        // 如果 clock_records 表不存在，忽略錯誤（遷移尚未運行）
        if (error.code !== '42P01') {
          console.error('Get clock records by employee error:', error);
        }
      }

      // 構建對比數據
      const comparison = [];
      for (const member of members) {
        for (const date of dates) {
          const scheduleKey = `${member.id}_${date}`;
          const schedule = schedules[scheduleKey] || null;
          // 確保 user_id 類型匹配（member.id 可能是字符串或數字）
          const memberId = Number(member.id);
          const leaveKey = `${memberId}_${date}`;
          const approvedLeave = approvedLeaves[leaveKey] || null;

          // 優先使用已批准的假期信息，如果沒有則使用排班信息
          let finalSchedule = null;
          if (approvedLeave && approvedLeave.length > 0) {
            // 如果有已批准的假期，使用假期信息
            // 如果有多個假期，取第一個（通常一個日期只有一個假期）
            const leave = approvedLeave[0];
            finalSchedule = {
              start_time: schedule?.start_time || null,
              end_time: schedule?.end_time || null,
              leave_type_name_zh: leave.leave_type_name_zh || schedule?.leave_type_name_zh || null,
              leave_session: leave.leave_session || schedule?.leave_session || null,
              is_approved_leave: true // 標記這是已批准的假期
            };
            console.log(`Found approved leave for user ${member.id} (${member.employee_number}) on ${date}: ${leave.leave_type_name_zh}`);
          } else if (schedule) {
            // 如果沒有已批准的假期，但有排班信息，使用排班信息
            finalSchedule = {
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              leave_type_name_zh: schedule.leave_type_name_zh,
              leave_session: schedule.leave_session,
              is_approved_leave: false
            };
          }

          comparison.push({
            user_id: member.id,
            employee_number: member.employee_number,
            display_name: member.display_name || member.name_zh || member.name,
            position_code: member.position_code || null,
            position_name: member.position_name || null,
            position_name_zh: member.position_name_zh || null,
            attendance_date: date,
            schedule: finalSchedule,
            attendance: (() => {
              // 從 clock_records 構建考勤信息
              // 確保 employee_number 和 date 都是字符串格式
              const empNum = member.employee_number ? String(member.employee_number).trim() : '';
              let dateStr;
              if (date instanceof Date) {
                // 使用本地時間的年份、月份、日期，避免UTC轉換
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
              } else {
                // 已經是字符串格式，直接使用（移除時間部分）
                dateStr = String(date).split('T')[0].split(' ')[0];
              }
              const employeeKey = `${empNum}_${dateStr}`;
              
              const records = clockRecordsByEmployee[employeeKey] || [];
              
              if (records.length === 0) {
                return null;
              }
              
              // 獲取有效的打卡記錄，按時間排序
              const validRecords = records
                .filter(r => r.is_valid === true)
                .sort((a, b) => {
                  const timeA = a.clock_time || '';
                  const timeB = b.clock_time || '';
                  return timeA.localeCompare(timeB);
                });
              
              // 如果沒有有效的記錄，使用所有記錄（按時間排序），取最早的4個
              const allRecordsSorted = records.sort((a, b) => {
                const timeA = a.clock_time || '';
                const timeB = b.clock_time || '';
                return timeA.localeCompare(timeB);
              });
              
              // 構建考勤對象
              // 優先使用有效的記錄，如果沒有則使用所有記錄中最早的
              const clockInRecord = validRecords.length > 0 ? validRecords[0] : 
                (allRecordsSorted.length > 0 ? allRecordsSorted[0] : null);
              const timeOffStartRecord = validRecords.length > 1 ? validRecords[1] : 
                (allRecordsSorted.length > 1 ? allRecordsSorted[1] : null);
              const timeOffEndRecord = validRecords.length > 2 ? validRecords[2] : 
                (allRecordsSorted.length > 2 ? allRecordsSorted[2] : null);
              const clockOutRecord = validRecords.length > 3 ? validRecords[3] : 
                (allRecordsSorted.length > 3 ? allRecordsSorted[3] : null);
              
              // 獲取備註：優先從第一條有效記錄中獲取，如果沒有則從第一條記錄中獲取
              const remarksRecord = validRecords.length > 0 ? validRecords[0] : 
                (allRecordsSorted.length > 0 ? allRecordsSorted[0] : null);
              const remarks = remarksRecord?.remarks || null;
              
              return {
                clock_in_time: clockInRecord?.clock_time || null,
                clock_out_time: clockOutRecord?.clock_time || null,
                time_off_start: timeOffStartRecord?.clock_time || null,
                time_off_end: timeOffEndRecord?.clock_time || null,
                status: null, // 可以根據需要計算狀態
                late_minutes: null, // 可以根據需要計算遲到分鐘數
                remarks: remarks
              };
            })(),
            clock_records: (() => {
              // 使用基於 employee_number 的打卡記錄
              // 確保 employee_number 和 date 都是字符串格式
              const empNum = member.employee_number ? String(member.employee_number).trim() : '';
              let dateStr;
              if (date instanceof Date) {
                // 使用本地時間的年份、月份、日期，避免UTC轉換
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
              } else {
                // 已經是字符串格式，直接使用（移除時間部分）
                dateStr = String(date).split('T')[0].split(' ')[0];
              }
              const employeeKey = `${empNum}_${dateStr}`;
              
              return clockRecordsByEmployee[employeeKey] || [];
            })()
          });
        }
      }

      res.json({ comparison });
    } catch (error) {
      console.error('Get attendance comparison error:', error);
      res.status(500).json({ message: '獲取考勤對比失敗', error: error.message });
    }
  }

  // 從CSV導入打卡記錄
  async importClockRecordsFromCSV(req, res) {
    try {
      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const csvData = req.body.data; // 期望格式: [{employee_number, name, branch_code, date, clock_time, in_out}, ...]

      if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
        return res.status(400).json({ message: '請提供有效的CSV數據' });
      }

      // 檢查用戶是否有權限匯入考勤（必須是系統管理員或批核成員）
      // 注意：CSV 匯入不特定於某個群組，所以我們檢查用戶是否至少是一個群組的批核成員
      if (!isSystemAdmin) {
        // 獲取所有未關閉的群組，檢查用戶是否至少是一個群組的批核成員
        const allGroups = await DepartmentGroup.findAll({ closed: false });
        let hasPermission = false;
        for (const group of allGroups) {
          const canView = await this.canViewGroupAttendance(userId, group.id, false);
          if (canView) {
            hasPermission = true;
            break;
          }
        }
        if (!hasPermission) {
          return res.status(403).json({ message: '您沒有權限匯入考勤記錄（必須是群組的 checker、approver1、approver2 或 approver3）' });
        }
      }

      const clockRecords = [];
      const errors = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNum = i + 1;

        // 驗證必要欄位
        if (!row.employee_number || !row.date || !row.clock_time || !row.in_out) {
          errors.push(`第 ${rowNum} 行：缺少必要欄位（employee_number, date, clock_time, in_out）`);
          continue;
        }

        // 格式化日期和時間
        let attendanceDate;
        try {
          // 支持多種日期格式：YYYY-MM-DD, DD/MM/YYYY
          // 注意：香港通常使用 DD/MM/YYYY 格式
          const dateStr = row.date.toString().trim();
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // 判斷日期格式
              if (parts[0].length === 4) {
                // YYYY/MM/DD
                attendanceDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parseInt(parts[0]) > 12) {
                // DD/MM/YYYY (日期部分 > 12，肯定是 DD/MM/YYYY)
                attendanceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else if (parseInt(parts[1]) > 12) {
                // MM/DD/YYYY (月份部分 > 12，肯定是 MM/DD/YYYY)
                attendanceDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
              } else {
                // 兩者都 <= 12，默認使用 DD/MM/YYYY（香港格式）
                // parts[0] = 日期, parts[1] = 月份, parts[2] = 年份
                attendanceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else {
              throw new Error('日期格式不正確');
            }
          } else {
            // 已經是 YYYY-MM-DD 格式
            attendanceDate = dateStr;
          }
          
          // 驗證日期格式是否正確（YYYY-MM-DD）
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(attendanceDate)) {
            throw new Error('日期格式驗證失敗');
          }
        } catch (error) {
          errors.push(`第 ${rowNum} 行：日期格式錯誤 (${row.date}) - ${error.message}`);
          continue;
        }

        // 格式化時間
        let clockTime;
        try {
          const timeStr = row.clock_time.toString().trim();
          if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            if (parts.length >= 2) {
              clockTime = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
            } else {
              throw new Error('時間格式不正確');
            }
          } else if (timeStr.length === 4) {
            // HHMM 格式
            clockTime = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:00`;
          } else {
            throw new Error('時間格式不正確');
          }
        } catch (error) {
          errors.push(`第 ${rowNum} 行：時間格式錯誤 (${row.clock_time})`);
          continue;
        }

        clockRecords.push({
          employee_number: row.employee_number.toString().trim(),
          name: row.name ? row.name.toString().trim() : '',
          branch_code: row.branch_code ? row.branch_code.toString().trim() : '',
          attendance_date: attendanceDate,
          clock_time: clockTime,
          in_out: row.in_out.toString().trim().toUpperCase(),
          is_valid: false,
          created_by_id: userId,
          updated_by_id: userId
        });
      }

      if (clockRecords.length === 0) {
        return res.status(400).json({ 
          message: '沒有有效的打卡記錄可以導入',
          errors: errors
        });
      }

      // 批量插入打卡記錄
      const insertedRecords = await ClockRecord.createBatch(clockRecords);

      res.status(201).json({
        message: 'CSV導入成功',
        imported_count: insertedRecords.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Import clock records from CSV error:', error);
      res.status(500).json({ message: '導入CSV失敗', error: error.message });
    }
  }

  // 更新打卡記錄的有效性
  async updateClockRecordsValidity(req, res) {
    try {
      const { clock_records } = req.body; // [{id, is_valid}, ...]

      console.log('updateClockRecordsValidity - received data:', clock_records);

      if (!clock_records || !Array.isArray(clock_records)) {
        return res.status(400).json({ message: '請提供有效的打卡記錄數據' });
      }

      if (clock_records.length === 0) {
        return res.status(400).json({ message: '打卡記錄數組不能為空' });
      }

      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const updates = [];
      const errors = [];

      // 先獲取所有要更新的記錄，檢查權限
      const recordIds = clock_records.map(r => r.id).filter(id => id);
      if (recordIds.length === 0) {
        return res.status(400).json({ message: '請提供有效的記錄 ID' });
      }

      const existingRecords = await knex('clock_records')
        .whereIn('id', recordIds)
        .select('id', 'employee_number');

      // 檢查權限：獲取所有涉及的員工編號，檢查用戶是否有權限
      if (!isSystemAdmin) {
        const employeeNumbers = [...new Set(existingRecords.map(r => r.employee_number))];
        for (const empNum of employeeNumbers) {
          const user = await User.findByEmployeeNumber(empNum);
          if (!user) continue;
          const userGroups = await DepartmentGroup.findByUserId(user.id);
          let hasPermission = false;
          for (const group of userGroups) {
            const canView = await this.canViewGroupAttendance(userId, group.id, false);
            if (canView) {
              hasPermission = true;
              break;
            }
          }
          if (!hasPermission) {
            return res.status(403).json({ message: `您沒有權限更新員工編號 ${empNum} 的考勤記錄（必須是該員工所屬群組的 checker、approver1、approver2 或 approver3）` });
          }
        }
      }

      for (const record of clock_records) {
        if (!record.id) {
          errors.push(`記錄缺少 id: ${JSON.stringify(record)}`);
          continue;
        }

        // 確保 is_valid 是 boolean 類型
        const isValid = record.is_valid === true || record.is_valid === 'true';

        try {
          // 更新單個打卡記錄的有效性
          const updated = await knex('clock_records')
            .where('id', record.id)
            .update({
              is_valid: isValid,
              updated_by_id: userId,
              updated_at: knex.fn.now()
            });

          if (updated > 0) {
            updates.push({
              id: record.id,
              is_valid: isValid
            });
          } else {
            errors.push(`記錄不存在或更新失敗: id=${record.id}`);
          }
        } catch (error) {
          console.error(`Error updating record ${record.id}:`, error);
          errors.push(`更新記錄失敗: id=${record.id}, error=${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.warn('Update clock records errors:', errors);
      }

      if (updates.length === 0) {
        return res.status(400).json({ 
          message: '沒有成功更新任何記錄',
          errors: errors.length > 0 ? errors : undefined
        });
      }

      res.json({ 
        message: '打卡記錄更新成功',
        updated_count: updates.length,
        updates,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Update clock records validity error:', error);
      res.status(500).json({ message: '更新打卡記錄失敗', error: error.message });
    }
  }

  // 更新打卡記錄的時間
  async updateClockRecordsTime(req, res) {
    try {
      const { clock_records } = req.body; // [{id, clock_time}, ...]

      console.log('updateClockRecordsTime - received data:', clock_records);

      if (!clock_records || !Array.isArray(clock_records)) {
        return res.status(400).json({ message: '請提供有效的打卡記錄數據' });
      }

      if (clock_records.length === 0) {
        return res.status(400).json({ message: '打卡記錄數組不能為空' });
      }

      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const updates = [];
      const errors = [];

      // 先獲取所有要更新的記錄，檢查權限
      const recordIds = clock_records.map(r => r.id).filter(id => id);
      if (recordIds.length === 0) {
        return res.status(400).json({ message: '請提供有效的記錄 ID' });
      }

      const existingRecords = await knex('clock_records')
        .whereIn('id', recordIds)
        .select('id', 'employee_number');

      // 檢查權限：獲取所有涉及的員工編號，檢查用戶是否有權限
      if (!isSystemAdmin) {
        const employeeNumbers = [...new Set(existingRecords.map(r => r.employee_number))];
        for (const empNum of employeeNumbers) {
          const user = await User.findByEmployeeNumber(empNum);
          if (!user) continue;
          const userGroups = await DepartmentGroup.findByUserId(user.id);
          let hasPermission = false;
          for (const group of userGroups) {
            const canView = await this.canViewGroupAttendance(userId, group.id, false);
            if (canView) {
              hasPermission = true;
              break;
            }
          }
          if (!hasPermission) {
            return res.status(403).json({ message: `您沒有權限更新員工編號 ${empNum} 的考勤記錄（必須是該員工所屬群組的 checker、approver1、approver2 或 approver3）` });
          }
        }
      }

      for (const record of clock_records) {
        if (!record.id) {
          errors.push(`記錄缺少 id: ${JSON.stringify(record)}`);
          continue;
        }

        if (!record.clock_time) {
          errors.push(`記錄缺少 clock_time: id=${record.id}`);
          continue;
        }

        // 驗證時間格式 (HH:mm:ss)，支援 0-32 小時
        const timeRegex = /^([0-2][0-9]|3[0-2]):[0-5][0-9]:[0-5][0-9]$/;
        if (!timeRegex.test(record.clock_time)) {
          errors.push(`時間格式不正確: id=${record.id}, clock_time=${record.clock_time}，應為 HH:mm:ss 格式（小時範圍：0-32）`);
          continue;
        }

        try {
          // 更新單個打卡記錄的時間
          const updated = await knex('clock_records')
            .where('id', record.id)
            .update({
              clock_time: record.clock_time,
              updated_by_id: userId,
              updated_at: knex.fn.now()
            });

          if (updated > 0) {
            updates.push({
              id: record.id,
              clock_time: record.clock_time
            });
          } else {
            errors.push(`記錄不存在或更新失敗: id=${record.id}`);
          }
        } catch (error) {
          console.error(`Error updating record ${record.id}:`, error);
          errors.push(`更新記錄失敗: id=${record.id}, error=${error.message}`);
        }
      }

      if (errors.length > 0) {
        console.warn('Update clock records time errors:', errors);
      }

      if (updates.length === 0) {
        return res.status(400).json({ 
          message: '沒有成功更新任何記錄',
          errors: errors.length > 0 ? errors : undefined
        });
      }

      res.json({ 
        message: '打卡記錄時間更新成功',
        updated_count: updates.length,
        updates,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Update clock records time error:', error);
      res.status(500).json({ message: '更新打卡記錄時間失敗', error: error.message });
    }
  }

  // 更新考勤備註
  async updateAttendanceRemarks(req, res) {
    try {
      const userId = req.user.id;
      const {
        user_id,
        employee_number,
        attendance_date,
        remarks
      } = req.body;

      // 需要提供 attendance_date，以及 user_id 或 employee_number
      if (!attendance_date) {
        return res.status(400).json({ message: '請提供 attendance_date' });
      }

      let user;
      if (employee_number) {
        user = await User.findByEmployeeNumber(employee_number);
        if (!user) {
          return res.status(400).json({ message: `找不到員工編號為 ${employee_number} 的用戶` });
        }
      } else if (user_id) {
        user = await User.findById(user_id);
        if (!user) {
          return res.status(400).json({ message: '找不到指定的用戶' });
        }
      } else {
        return res.status(400).json({ message: '請提供 user_id 或 employee_number' });
      }

      if (!user.employee_number) {
        return res.status(400).json({ message: '用戶沒有員工編號，無法更新備註' });
      }

      // 檢查用戶是否有權限更新此用戶的考勤備註
      const currentUserId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      const userGroups = await DepartmentGroup.findByUserId(user.id);
      if (userGroups.length === 0) {
        return res.status(403).json({ message: '該用戶不屬於任何群組，無法更新備註' });
      }
      // 檢查當前用戶是否至少是該用戶所屬群組之一的批核成員
      let hasPermission = isSystemAdmin;
      if (!hasPermission) {
        for (const group of userGroups) {
          const canView = await this.canViewGroupAttendance(currentUserId, group.id, false);
          if (canView) {
            hasPermission = true;
            break;
          }
        }
      }
      if (!hasPermission) {
        return res.status(403).json({ message: '您沒有權限更新此用戶的考勤備註（必須是該用戶所屬群組的 checker、approver1、approver2 或 approver3）' });
      }

      // 處理 attendance_date：確保是 YYYY-MM-DD 格式
      let finalAttendanceDate = attendance_date;
      if (finalAttendanceDate instanceof Date) {
        const year = finalAttendanceDate.getFullYear();
        const month = String(finalAttendanceDate.getMonth() + 1).padStart(2, '0');
        const day = String(finalAttendanceDate.getDate()).padStart(2, '0');
        finalAttendanceDate = `${year}-${month}-${day}`;
      } else if (typeof finalAttendanceDate === 'string') {
        finalAttendanceDate = finalAttendanceDate.split('T')[0].split(' ')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(finalAttendanceDate)) {
          return res.status(400).json({ message: `attendance_date 格式不正確: ${finalAttendanceDate}，應為 YYYY-MM-DD` });
        }
      }

      // 查找該日期和員工的所有打卡記錄
      const records = await knex('clock_records')
        .where('employee_number', user.employee_number)
        .where('attendance_date', finalAttendanceDate)
        .orderBy('clock_time', 'asc');

      if (records.length === 0) {
        return res.status(404).json({ message: '找不到該日期的打卡記錄' });
      }

      // 優先更新第一條有效記錄的備註，如果沒有有效記錄則更新第一條記錄
      const validRecord = records.find(r => r.is_valid === true);
      const targetRecord = validRecord || records[0];

      // 更新備註
      await knex('clock_records')
        .where('id', targetRecord.id)
        .update({
          remarks: remarks || null,
          updated_by_id: userId,
          updated_at: knex.fn.now()
        });

      res.json({ 
        message: '備註更新成功',
        record_id: targetRecord.id
      });
    } catch (error) {
      console.error('Update attendance remarks error:', error);
      res.status(500).json({ message: '更新備註失敗', error: error.message });
    }
  }

  // 檢查用戶是否有權限訪問某個群組的考勤（必須是 checker、approver1、approver2 或 approver3）
  async canViewGroupAttendance(userId, departmentGroupId, isSystemAdmin = false) {
    // 系統管理員可以查看所有群組
    if (isSystemAdmin) {
      return true;
    }

    // 檢查是否為批核成員（checker, approver_1, approver_2, approver_3）
    const canEdit = await Schedule.canEditSchedule(userId, departmentGroupId);
    return canEdit;
  }

  // 獲取用戶有權限查看的考勤群組列表（僅顯示用戶作為 checker/approver 可以訪問的群組）
  async getAccessibleAttendanceGroups(req, res) {
    try {
      const userId = req.user.id;
      const isSystemAdmin = req.user.is_system_admin;
      
      // 系統管理員可以查看所有群組
      if (isSystemAdmin) {
        const allGroups = await DepartmentGroup.findAll({ closed: false });
        return res.json({ groups: allGroups });
      }

      // 獲取所有未關閉的部門群組
      const allGroups = await DepartmentGroup.findAll({ closed: false });
      
      // 過濾出用戶作為 checker/approver 可以訪問的群組
      const accessibleGroups = [];
      for (const group of allGroups) {
        const canView = await this.canViewGroupAttendance(userId, group.id, false);
        if (canView) {
          accessibleGroups.push(group);
        }
      }
      
      res.json({ groups: accessibleGroups });
    } catch (error) {
      console.error('Get accessible attendance groups error:', error);
      res.status(500).json({ message: '獲取可訪問的考勤群組列表時發生錯誤', error: error.message });
    }
  }

  // 獲取當前用戶的打卡記錄（用於 My Attendance 頁面）
  async getMyClockRecords(req, res) {
    try {
      const userId = req.user.id;
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ message: '請提供開始日期和結束日期' });
      }

      // 獲取當前用戶信息
      const currentUser = await User.findById(userId);
      if (!currentUser || !currentUser.employee_number) {
        return res.status(400).json({ message: '用戶沒有員工編號' });
      }

      // 獲取打卡記錄
      const clockRecords = await ClockRecord.findByEmployeeAndDateRange(
        currentUser.employee_number,
        start_date,
        end_date
      );

      // 獲取排班數據
      const schedules = await Schedule.findAll({
        user_id: userId,
        start_date,
        end_date
      });

      // 按日期組織數據
      const dateMap = new Map();
      
      // 初始化日期範圍內的所有日期（使用本地日期格式，避免時區問題）
      const start = new Date(start_date + 'T00:00:00');
      const end = new Date(end_date + 'T23:59:59');
      let currentDate = new Date(start);
      while (currentDate <= end) {
        // 使用本地時間的年份、月份、日期，避免UTC轉換
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        dateMap.set(dateStr, {
          attendance_date: dateStr,
          schedule: null,
          clock_records: [],
          attendance: null
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 添加排班數據
      schedules.forEach(schedule => {
        let dateStr;
        if (schedule.schedule_date instanceof Date) {
          // 使用本地時間的年份、月份、日期
          const year = schedule.schedule_date.getFullYear();
          const month = String(schedule.schedule_date.getMonth() + 1).padStart(2, '0');
          const day = String(schedule.schedule_date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          // 已經是字符串格式，直接使用（移除時間部分）
          dateStr = String(schedule.schedule_date).split('T')[0].split(' ')[0];
        }
        
        if (dateMap.has(dateStr)) {
          dateMap.get(dateStr).schedule = {
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            leave_type_name_zh: schedule.leave_type_name_zh,
            leave_type_name: schedule.leave_type_name,
            leave_type_code: schedule.leave_type_code,
            leave_session: schedule.leave_session
          };
        } else {
          // 如果日期不在範圍內，也添加（可能是數據問題，但應該顯示）
          dateMap.set(dateStr, {
            attendance_date: dateStr,
            schedule: {
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              leave_type_name_zh: schedule.leave_type_name_zh,
              leave_type_name: schedule.leave_type_name,
              leave_type_code: schedule.leave_type_code,
              leave_session: schedule.leave_session
            },
            clock_records: [],
            attendance: null
          });
        }
      });

      // 添加打卡記錄
      clockRecords.forEach(record => {
        let dateStr;
        if (record.attendance_date instanceof Date) {
          // 使用本地時間的年份、月份、日期
          const year = record.attendance_date.getFullYear();
          const month = String(record.attendance_date.getMonth() + 1).padStart(2, '0');
          const day = String(record.attendance_date.getDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        } else {
          // 已經是字符串格式，直接使用（移除時間部分）
          dateStr = String(record.attendance_date).split('T')[0].split(' ')[0];
        }
        
        if (dateMap.has(dateStr)) {
          dateMap.get(dateStr).clock_records.push(record);
        } else {
          // 如果日期不在範圍內，也添加（可能是數據問題，但應該顯示）
          if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, {
              attendance_date: dateStr,
              schedule: null,
              clock_records: [],
              attendance: null
            });
          }
          dateMap.get(dateStr).clock_records.push(record);
        }
      });

      // 構建考勤信息（從打卡記錄）
      dateMap.forEach((item, dateStr) => {
        if (item.clock_records.length > 0) {
          const validRecords = item.clock_records
            .filter(r => r.is_valid === true)
            .sort((a, b) => {
              const timeA = a.clock_time || '';
              const timeB = b.clock_time || '';
              return timeA.localeCompare(timeB);
            });
          
          const allRecordsSorted = item.clock_records.sort((a, b) => {
            const timeA = a.clock_time || '';
            const timeB = b.clock_time || '';
            return timeA.localeCompare(timeB);
          });

          const clockInRecord = validRecords.length > 0 ? validRecords[0] : 
            (allRecordsSorted.length > 0 ? allRecordsSorted[0] : null);
          const timeOffStartRecord = validRecords.length > 1 ? validRecords[1] : 
            (allRecordsSorted.length > 1 ? allRecordsSorted[1] : null);
          const timeOffEndRecord = validRecords.length > 2 ? validRecords[2] : 
            (allRecordsSorted.length > 2 ? allRecordsSorted[2] : null);
          const clockOutRecord = validRecords.length > 3 ? validRecords[3] : 
            (allRecordsSorted.length > 3 ? allRecordsSorted[3] : null);
          
          const remarksRecord = validRecords.length > 0 ? validRecords[0] : 
            (allRecordsSorted.length > 0 ? allRecordsSorted[0] : null);
          
          item.attendance = {
            clock_in_time: clockInRecord?.clock_time || null,
            clock_out_time: clockOutRecord?.clock_time || null,
            time_off_start: timeOffStartRecord?.clock_time || null,
            time_off_end: timeOffEndRecord?.clock_time || null,
            remarks: remarksRecord?.remarks || null
          };
        }
      });

      // 轉換為數組並按日期排序
      const result = Array.from(dateMap.values()).sort((a, b) => {
        return new Date(a.attendance_date) - new Date(b.attendance_date);
      });

      res.json({ 
        attendance: result,
        user: {
          id: currentUser.id,
          employee_number: currentUser.employee_number,
          display_name: currentUser.display_name || currentUser.name_zh || currentUser.name
        }
      });
    } catch (error) {
      console.error('Get my clock records error:', error);
      res.status(500).json({ message: '獲取打卡記錄失敗', error: error.message });
    }
  }
}

module.exports = new AttendanceController();
