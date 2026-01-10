const Attendance = require('../database/models/Attendance');
const Schedule = require('../database/models/Schedule');
const DepartmentGroup = require('../database/models/DepartmentGroup');
const ClockRecord = require('../database/models/ClockRecord');
const User = require('../database/models/User');
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

      // 更新打卡記錄到 clock_records 表
      if (clock_in_time !== undefined || clock_out_time !== undefined || 
          time_off_start !== undefined || time_off_end !== undefined) {
        // 只刪除手動創建的記錄（created_by_id 不為 null）
        // 保留從 CSV 導入的記錄
        await knex('clock_records')
          .where('employee_number', user.employee_number)
          .where('attendance_date', finalAttendanceDate)
          .whereNotNull('created_by_id')
          .delete();
        
        // 創建新的打卡記錄
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
              knex.raw("to_char(clock_records.clock_time, 'HH24:MI:SS') as clock_time"),
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

          comparison.push({
            user_id: member.id,
            employee_number: member.employee_number,
            display_name: member.display_name || member.name_zh || member.name,
            position_code: member.position_code || null,
            position_name: member.position_name || null,
            position_name_zh: member.position_name_zh || null,
            attendance_date: date,
            schedule: schedule ? {
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              leave_type_name_zh: schedule.leave_type_name_zh,
              leave_session: schedule.leave_session
            } : null,
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
              
              return {
                clock_in_time: clockInRecord?.clock_time || null,
                clock_out_time: clockOutRecord?.clock_time || null,
                time_off_start: timeOffStartRecord?.clock_time || null,
                time_off_end: timeOffEndRecord?.clock_time || null,
                status: null, // 可以根據需要計算狀態
                late_minutes: null, // 可以根據需要計算遲到分鐘數
                remarks: null
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
      const csvData = req.body.data; // 期望格式: [{employee_number, name, branch_code, date, clock_time, in_out}, ...]

      if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
        return res.status(400).json({ message: '請提供有效的CSV數據' });
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
      const updates = [];
      const errors = [];

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
}

module.exports = new AttendanceController();
