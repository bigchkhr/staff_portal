const MonthlyAttendanceSummary = require('../database/models/MonthlyAttendanceSummary');
const Schedule = require('../database/models/Schedule');
const ClockRecord = require('../database/models/ClockRecord');
const User = require('../database/models/User');
const knex = require('../config/database');

class MonthlyAttendanceSummaryController {
  // 將日期轉換為 UTC+8 時區的 YYYY-MM-DD 格式
  formatDateToUTC8(date) {
    if (!date) return null;
    
    // 如果是字符串格式 YYYY-MM-DD，直接返回
    if (typeof date === 'string') {
      const dateStr = date.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
    }
    
    let dateObj;
    if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      return null;
    }
    
    // 獲取本地時區偏移（毫秒）
    const localOffset = dateObj.getTimezoneOffset() * 60 * 1000;
    // UTC+8 時區偏移（毫秒）
    const utc8Offset = 8 * 60 * 60 * 1000;
    // 計算 UTC+8 時區的時間
    const utc8Time = new Date(dateObj.getTime() - localOffset + utc8Offset);
    
    // 使用 UTC 方法獲取日期，這樣可以確保是 UTC+8 的日期
    const year = utc8Time.getUTCFullYear();
    const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Time.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // 獲取 UTC+8 時區的月份最後一天
  getLastDayOfMonthUTC8(year, month) {
    // 使用 Date.UTC 創建該月第一天的 UTC 時間（00:00:00 UTC）
    // 然後轉換為 UTC+8 時區
    // 注意：month 是 1-12，但 Date.UTC 的月份是 0-11
    const firstDayUTC = Date.UTC(year, month - 1, 1);
    // 獲取下個月的第一天
    const nextMonthUTC = Date.UTC(year, month, 1);
    // 減去一天得到該月最後一天
    const lastDayUTC = nextMonthUTC - 24 * 60 * 60 * 1000;
    // 轉換為 UTC+8 時區的日期
    const lastDayUTC8 = new Date(lastDayUTC + 8 * 60 * 60 * 1000);
    return lastDayUTC8.getUTCDate();
  }
  // 計算一天的考勤數據
  async calculateDailyAttendance(attendanceData, scheduleData, employmentMode = null) {
    // 確保日期使用 UTC+8 時區格式化
    const attendanceDate = attendanceData.attendance_date;
    const dateStr = this.formatDateToUTC8(attendanceDate);
    
    const result = {
      date: dateStr || attendanceDate, // 使用格式化後的日期（UTC+8）
      late_minutes: null,
      break_duration: null, // 分鐘數
      total_work_hours: null, // 小時數
      overtime_hours: null, // 小時數
      early_leave: false,
      is_late: false,
      is_absent: false,
      store_short_name: null, // 分店名稱（根據第一個有效打卡記錄的 branch_code 查找）
      // 保存完整的排班資料（包括放假資料）
      schedule: scheduleData && (scheduleData.start_time || scheduleData.end_time || scheduleData.leave_type_name_zh) ? {
        id: scheduleData.id || null,
        store_id: scheduleData.store_id || null,
        start_time: scheduleData.start_time || null,
        end_time: scheduleData.end_time || null,
        leave_type_name_zh: scheduleData.leave_type_name_zh || null,
        leave_session: scheduleData.leave_session || null,
        is_approved_leave: scheduleData.is_approved_leave || false
      } : null,
      // 保存所有有效的打卡記錄
      valid_clock_records: [],
      // 保存完整的考勤數據（包含所有打卡記錄）
      attendance_data: attendanceData
    };

    // 獲取有效的打卡記錄（按時間排序）
    // 確保正確識別有效的記錄（支援 boolean true、字符串 "true"、數字 1 等格式）
    const allClockRecords = attendanceData.clock_records || [];
    const validRecords = allClockRecords
      .filter(r => {
        // 檢查 is_valid 是否為 true（支援多種格式）
        const isValid = r.is_valid === true || 
                       r.is_valid === 'true' || 
                       r.is_valid === 1 || 
                       r.is_valid === '1';
        return isValid;
      })
      .sort((a, b) => {
        const timeA = a.clock_time || '';
        const timeB = b.clock_time || '';
        return timeA.localeCompare(timeB);
      });

    // 調試日誌
    if (allClockRecords.length > 0) {
      console.log(`[calculateDailyAttendance] Date ${dateStr}:`, {
        totalRecords: allClockRecords.length,
        validRecordsCount: validRecords.length,
        validRecords: validRecords.map(r => ({
          id: r.id,
          clock_time: r.clock_time,
          in_out: r.in_out,
          is_valid: r.is_valid,
          is_valid_type: typeof r.is_valid
        }))
      });
    }

    // 保存所有有效的打卡記錄
    result.valid_clock_records = validRecords.map(record => ({
      id: record.id || null,
      employee_number: record.employee_number || null,
      name: record.name || null,
      branch_code: record.branch_code || null,
      attendance_date: record.attendance_date || null,
      clock_time: record.clock_time || null,
      in_out: record.in_out || null,
      is_valid: true, // 確保保存為 true
      remarks: record.remarks || null
    }));

    // 根據第一個有效打卡記錄的 branch_code（實際上是 store_code）查找對應的 store_short_name_
    // 注意：clock_records.branch_code 的值就是 stores.store_code
    if (validRecords.length > 0) {
      // 從第一個有效記錄中獲取 store_code（存儲在 branch_code 欄位中）
      const storeCode = validRecords[0].branch_code ? String(validRecords[0].branch_code).trim() : null;
      
      if (storeCode) {
        try {
          console.log(`[calculateDailyAttendance] Looking up store for store_code: "${storeCode}" on date ${dateStr}`);
          
          // 先嘗試查找未關閉的店舖
          let store = await knex('stores')
            .where('store_code', storeCode)
            .where('is_closed', false)
            .select('store_short_name_ as store_short_name')
            .first();
          
          // 如果沒找到，再查找所有店舖（包括已關閉的）
          if (!store) {
            store = await knex('stores')
              .where('store_code', storeCode)
              .select('store_short_name_ as store_short_name')
              .first();
          }
          
          if (store && store.store_short_name) {
            result.store_short_name = store.store_short_name;
            console.log(`[calculateDailyAttendance] Found store_short_name: "${store.store_short_name}" for store_code: "${storeCode}"`);
          } else {
            console.log(`[calculateDailyAttendance] No store found for store_code: "${storeCode}"`);
            // 列出所有可用的 store_code 以便調試
            const allStores = await knex('stores').select('store_code', 'store_short_name_ as store_short_name').limit(10);
            console.log(`[calculateDailyAttendance] Available store_codes (first 10):`, allStores.map(s => `${s.store_code} -> ${s.store_short_name}`));
          }
        } catch (error) {
          console.error(`[calculateDailyAttendance] Error fetching store by store_code ${storeCode}:`, error);
          // 如果查找失敗，不影響其他功能，繼續執行
        }
      } else {
        console.log(`[calculateDailyAttendance] No store_code (branch_code) in first valid record on date ${dateStr}. First record:`, {
          id: validRecords[0].id,
          clock_time: validRecords[0].clock_time,
          in_out: validRecords[0].in_out,
          branch_code: validRecords[0].branch_code
        });
      }
    }

    if (validRecords.length === 0) {
      // 沒有有效打卡記錄，判斷是否缺勤
      if (scheduleData && scheduleData.start_time) {
        result.is_absent = true;
      }
      return result;
    }

    // 獲取排班時間
    const scheduleStartTime = scheduleData?.start_time;
    const scheduleEndTime = scheduleData?.end_time;

    // 第一個有效記錄作為上班時間
    const clockInTime = validRecords[0]?.clock_time;
    // 最後一個有效記錄作為下班時間
    const clockOutTime = validRecords[validRecords.length - 1]?.clock_time;

    // 計算遲到
    if (scheduleStartTime && clockInTime) {
      const scheduleStart = this.parseTime(scheduleStartTime);
      const actualStart = this.parseTime(clockInTime);
      
      if (actualStart !== null && scheduleStart !== null && actualStart > scheduleStart) {
        const diffMinutes = actualStart - scheduleStart;
        result.late_minutes = diffMinutes;
        result.is_late = true;
      }
    }

    // 計算Break時間（第三個有效時間減去第二個有效時間）
    if (validRecords.length >= 3) {
      const secondTime = this.parseTime(validRecords[1]?.clock_time);
      const thirdTime = this.parseTime(validRecords[2]?.clock_time);
      
      if (secondTime !== null && thirdTime !== null) {
        const breakMinutes = thirdTime - secondTime;
        result.break_duration = breakMinutes;
      }
    }

    // 計算總工作時數
    // 全日上班總時數 = 打卡最後時間 - 排班開始時間（如果有排班時間）
    // 如果沒有排班時間，則 = 打卡最後時間 - 當日首次打卡時間
    if (clockOutTime) {
      const end = this.parseTime(clockOutTime);
      
      if (end !== null) {
        let start = null;
        
        // 優先使用排班開始時間
        if (scheduleStartTime) {
          start = this.parseTime(scheduleStartTime);
        } 
        // 如果沒有排班開始時間，使用首次打卡時間
        else if (clockInTime) {
          start = this.parseTime(clockInTime);
        }
        
        if (start !== null) {
          let totalMinutes = end - start;
          // 如果有遲到時間，需要減去
          if (result.late_minutes !== null && result.late_minutes > 0) {
            totalMinutes -= result.late_minutes;
          }
          result.total_work_hours = (totalMinutes / 60).toFixed(2);
        }
      }
    }

    // 計算超時工作時間
    let overtimeMinutes = null;
    if (scheduleEndTime && clockOutTime) {
      const scheduleEnd = this.parseTime(scheduleEndTime);
      const actualEnd = this.parseTime(clockOutTime);
      
      if (actualEnd !== null && scheduleEnd !== null && actualEnd > scheduleEnd) {
        overtimeMinutes = actualEnd - scheduleEnd;
        result.overtime_hours = (overtimeMinutes / 60).toFixed(2);
      }
    }

    // 計算應計超時工作時數（approved_overtime_minutes）
    if (employmentMode) {
      const mode = employmentMode.toString().trim().toUpperCase();
      
      // 輔助函數：向下取整到指定間隔
      const floorMinutesToInterval = (minutes, interval) => {
        return Math.floor(minutes / interval) * interval;
      };
      
      if (mode === 'PT') {
        // PT員工：應計工作時數 = 全日上班總時數，向下取整到15分鐘
        if (result.total_work_hours !== null && result.total_work_hours !== undefined) {
          const totalWorkMinutes = parseFloat(result.total_work_hours) * 60; // 將小時轉換為分鐘
          result.approved_overtime_minutes = floorMinutesToInterval(totalWorkMinutes, 15);
        }
      } else if (mode === 'FT') {
        // FT員工：只在有超時工作時計算應計工作時數，向下取整到30分鐘
        if (overtimeMinutes !== null && overtimeMinutes >= 15) {
          result.approved_overtime_minutes = floorMinutesToInterval(overtimeMinutes, 30);
        }
      }
    }

    // 計算早退
    if (scheduleEndTime && clockOutTime) {
      const scheduleEnd = this.parseTime(scheduleEndTime);
      const actualEnd = this.parseTime(clockOutTime);
      
      if (actualEnd !== null && scheduleEnd !== null && actualEnd < scheduleEnd) {
        result.early_leave = true;
      }
    }

    return result;
  }

  // 解析時間字符串（HH:mm 或 HH:mm:ss）並返回分鐘數（從當天00:00開始）
  parseTime(timeStr) {
    if (!timeStr) return null;
    
    try {
      // 移除秒數部分（如果有）
      const timeOnly = timeStr.split(':').slice(0, 2).join(':');
      const [hours, minutes] = timeOnly.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) return null;
      
      // 返回從當天00:00開始的總分鐘數
      return hours * 60 + minutes;
    } catch (error) {
      console.error('Parse time error:', error, timeStr);
      return null;
    }
  }

  // 比較兩個時間（分鐘數），返回差值（分鐘）
  compareTimes(time1Minutes, time2Minutes) {
    if (time1Minutes === null || time2Minutes === null) return null;
    return time2Minutes - time1Minutes;
  }

  // 檢查用戶是否有權限存取月結表
  // 允許：HR 成員、系統管理員、申請人本人、以及任何作為 checker/approver1/approver2/approver3 的用戶
  async checkAccessPermission(userId, targetUserId = null) {
    try {
      // 檢查是否為 HR 成員或系統管理員
      const isHRMember = await User.isHRMember(userId);
      const user = await User.findById(userId);
      if (isHRMember || (user && user.is_system_admin)) {
        console.log(`[checkAccessPermission] 用戶 ${userId} 是 HR 成員或系統管理員，允許存取`);
        return true;
      }

      // 如果指定了目標用戶 ID，檢查是否為本人
      if (targetUserId && Number(userId) === Number(targetUserId)) {
        console.log(`[checkAccessPermission] 用戶 ${userId} 查看自己的月結表，允許存取`);
        return true;
      }

      // 檢查用戶是否是任何假期申請的批核者（checker、approver1、approver2、approver3）
      const userIdNum = Number(userId);
      
      // 方法1：檢查是否直接設置為批核者（在 leave_applications 表中）
      const hasDirectApproverRole = await knex('leave_applications')
        .where(function() {
          this.where('checker_id', userIdNum)
            .orWhere('approver_1_id', userIdNum)
            .orWhere('approver_2_id', userIdNum)
            .orWhere('approver_3_id', userIdNum);
        })
        .first();

      if (hasDirectApproverRole) {
        console.log(`[checkAccessPermission] 用戶 ${userId} 是直接批核者，允許存取`);
        return true;
      }

      // 方法2：檢查是否通過授權群組屬於批核者（使用 User.isApprovalMember）
      const isApprovalMember = await User.isApprovalMember(userId);
      if (isApprovalMember) {
        console.log(`[checkAccessPermission] 用戶 ${userId} 通過授權群組屬於批核者，允許存取`);
        return true;
      }

      console.log(`[checkAccessPermission] 用戶 ${userId} 沒有權限存取月結表`);
      return false;
    } catch (error) {
      console.error('[checkAccessPermission] 檢查權限時發生錯誤:', error);
      return false;
    }
  }

  // 取得月結記錄列表
  async getMonthlySummaries(req, res) {
    try {
      const { user_id, year, month } = req.query;
      const userId = req.user.id;
      const filters = {};
      
      if (user_id) filters.user_id = parseInt(user_id, 10);
      if (year) filters.year = parseInt(year, 10);
      if (month) filters.month = parseInt(month, 10);

      // 檢查權限：如果指定了 user_id，檢查是否有權限查看該用戶的月結表
      // 如果沒有指定 user_id，檢查用戶是否有權限存取月結表（允許查看所有記錄）
      const hasPermission = filters.user_id 
        ? await this.checkAccessPermission(userId, filters.user_id)
        : await this.checkAccessPermission(userId);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: filters.user_id 
            ? '無權限存取此月結記錄' 
            : '無權限存取月結表' 
        });
      }

      const summaries = await MonthlyAttendanceSummary.findAll(filters);
      
      // 為每個 summary 用「最新排班表」覆寫 daily_data 的排班顯示，令 /schedule 改動後月結表會及時顯示最新編更
      for (const summary of summaries) {
        // 確保 daily_data 為可變陣列（DB 可能回傳 JSON 字串或已解析陣列）
        let dailyData = summary.daily_data;
        if (typeof dailyData === 'string') {
          try {
            dailyData = JSON.parse(dailyData);
          } catch (e) {
            console.error('[getMonthlySummaries] Failed to parse daily_data:', e);
            dailyData = [];
          }
        }
        if (!Array.isArray(dailyData)) dailyData = [];
        summary.daily_data = dailyData;

        if (dailyData.length > 0) {
          // 獲取該月的日期範圍
          const startDate = `${summary.year}-${String(summary.month).padStart(2, '0')}-01`;
          const lastDay = this.getLastDayOfMonthUTC8(summary.year, summary.month);
          const endDate = `${summary.year}-${String(summary.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
          
          // 獲取該用戶該月的所有排班資料（即時從 schedules 表讀取，包含 /schedule 最新改動）
          const userSchedules = await Schedule.findAll({
            user_id: summary.user_id,
            start_date: startDate,
            end_date: endDate
          });
          
          // 獲取已批准的假期申請
          const LeaveApplication = require('../database/models/LeaveApplication');
          let approvedLeaves = [];
          try {
            const leaveResult = await LeaveApplication.findAll({
              user_id: summary.user_id,
              status: 'approved',
              start_date_from: startDate,
              end_date_to: endDate
            });
            approvedLeaves = Array.isArray(leaveResult?.applications) 
              ? leaveResult.applications.filter(leave => !leave.is_reversed && !leave.is_reversal_transaction)
              : [];
          } catch (error) {
            console.error('Get approved leaves error:', error);
          }
          
          // 將排班和假期資料轉換為按日期索引的格式
          const scheduleByDate = new Map();
          userSchedules.forEach(schedule => {
            const scheduleDateStr = this.formatDateToUTC8(schedule.schedule_date);
            if (scheduleDateStr) {
              scheduleByDate.set(scheduleDateStr, schedule);
            }
          });
          
          const leaveByDate = new Map();
          approvedLeaves.forEach(leave => {
            const leaveStartStr = this.formatDateToUTC8(leave.start_date);
            const leaveEndStr = this.formatDateToUTC8(leave.end_date);
            if (leaveStartStr && leaveEndStr) {
              const start = new Date(leaveStartStr);
              const end = new Date(leaveEndStr);
              let current = new Date(start);
              while (current <= end) {
                const dateStr = this.formatDateToUTC8(current);
                if (dateStr) {
                  if (!leaveByDate.has(dateStr)) {
                    leaveByDate.set(dateStr, leave);
                  }
                }
                current.setDate(current.getDate() + 1);
              }
            }
          });
          
          // 為每個日期用「最新排班表」覆寫 day.schedule，並同步到 attendance_data.schedule，確保前端顯示與詳情一致
          for (const day of dailyData) {
            if (day.date) {
              const scheduleRecord = scheduleByDate.get(day.date);
              const leaveRecord = leaveByDate.get(day.date);
              let newSchedule = null;
              
              if (leaveRecord) {
                newSchedule = {
                  id: scheduleRecord?.id || null,
                  store_id: scheduleRecord?.store_id || null,
                  start_time: scheduleRecord?.start_time || null,
                  end_time: scheduleRecord?.end_time || null,
                  leave_type_name_zh: leaveRecord.leave_type_name_zh || scheduleRecord?.leave_type_name_zh || null,
                  leave_session: LeaveApplication.getSessionForDate ? LeaveApplication.getSessionForDate(leaveRecord, day.date) : scheduleRecord?.leave_session || null,
                  is_approved_leave: true
                };
              } else if (scheduleRecord) {
                newSchedule = {
                  id: scheduleRecord.id || null,
                  store_id: scheduleRecord.store_id || null,
                  start_time: scheduleRecord.start_time || null,
                  end_time: scheduleRecord.end_time || null,
                  leave_type_name_zh: scheduleRecord.leave_type_name_zh || null,
                  leave_session: scheduleRecord.leave_session || null,
                  is_approved_leave: false
                };
              }
              day.schedule = newSchedule;
              if (day.attendance_data && typeof day.attendance_data === 'object') {
                day.attendance_data.schedule = newSchedule;
              }
            }
            
            // 填充缺失的分店資料：從第一個有效打卡記錄的 branch_code 查找 store_short_name
            if (!day.store_short_name && day.date) {
              // 優先從 valid_clock_records 獲取
              let firstValidRecord = null;
              if (day.valid_clock_records && Array.isArray(day.valid_clock_records) && day.valid_clock_records.length > 0) {
                firstValidRecord = day.valid_clock_records[0];
              } else if (day.attendance_data?.clock_records && Array.isArray(day.attendance_data.clock_records)) {
                // 如果沒有 valid_clock_records，從所有打卡記錄中過濾有效的
                const validRecords = day.attendance_data.clock_records.filter(r => {
                  const isValid = r.is_valid === true || 
                                r.is_valid === 'true' || 
                                r.is_valid === 1 || 
                                r.is_valid === '1' ||
                                r.is_valid === 'True' ||
                                (typeof r.is_valid === 'string' && r.is_valid.toLowerCase() === 'true');
                  return isValid && r.clock_time;
                }).sort((a, b) => {
                  const timeA = a.clock_time || '';
                  const timeB = b.clock_time || '';
                  return timeA.localeCompare(timeB);
                });
                if (validRecords.length > 0) {
                  firstValidRecord = validRecords[0];
                }
              }
              
              if (firstValidRecord && firstValidRecord.branch_code) {
                const storeCode = String(firstValidRecord.branch_code).trim();
                if (storeCode) {
                  try {
                    const knex = require('../config/database');
                    // 先嘗試查找未關閉的店舖
                    let store = await knex('stores')
                      .where('store_code', storeCode)
                      .where('is_closed', false)
                      .select('store_short_name_ as store_short_name')
                      .first();
                    
                    // 如果沒找到，再查找所有店舖（包括已關閉的）
                    if (!store) {
                      store = await knex('stores')
                        .where('store_code', storeCode)
                        .select('store_short_name_ as store_short_name')
                        .first();
                    }
                    
                    if (store && store.store_short_name) {
                      day.store_short_name = store.store_short_name;
                      console.log(`[getMonthlySummaries] Found store_short_name: "${store.store_short_name}" for store_code: "${storeCode}" on date ${day.date}`);
                    }
                  } catch (error) {
                    console.error(`[getMonthlySummaries] Error fetching store by store_code ${storeCode} for date ${day.date}:`, error);
                  }
                }
              }
            }
          }
        }
      }
      
      res.json({ summaries });
    } catch (error) {
      console.error('Get monthly summaries error:', error);
      res.status(500).json({ message: '取得月結記錄失敗', error: error.message });
    }
  }

  // 取得單一月結記錄
  async getMonthlySummary(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const summary = await MonthlyAttendanceSummary.findById(id);
      
      if (!summary) {
        return res.status(404).json({ message: '月結記錄不存在' });
      }

      // 檢查權限：檢查是否有權限查看該用戶的月結表
      const hasPermission = await this.checkAccessPermission(userId, summary.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月結記錄' });
      }

      // 填充缺失的分店資料
      if (summary.daily_data && Array.isArray(summary.daily_data)) {
        for (const day of summary.daily_data) {
          if (!day.store_short_name && day.date) {
            // 優先從 valid_clock_records 獲取
            let firstValidRecord = null;
            if (day.valid_clock_records && Array.isArray(day.valid_clock_records) && day.valid_clock_records.length > 0) {
              firstValidRecord = day.valid_clock_records[0];
            } else if (day.attendance_data?.clock_records && Array.isArray(day.attendance_data.clock_records)) {
              // 如果沒有 valid_clock_records，從所有打卡記錄中過濾有效的
              const validRecords = day.attendance_data.clock_records.filter(r => {
                const isValid = r.is_valid === true || 
                              r.is_valid === 'true' || 
                              r.is_valid === 1 || 
                              r.is_valid === '1' ||
                              r.is_valid === 'True' ||
                              (typeof r.is_valid === 'string' && r.is_valid.toLowerCase() === 'true');
                return isValid && r.clock_time;
              }).sort((a, b) => {
                const timeA = a.clock_time || '';
                const timeB = b.clock_time || '';
                return timeA.localeCompare(timeB);
              });
              if (validRecords.length > 0) {
                firstValidRecord = validRecords[0];
              }
            }
            
            if (firstValidRecord && firstValidRecord.branch_code) {
              const storeCode = String(firstValidRecord.branch_code).trim();
              if (storeCode) {
                try {
                  // 先嘗試查找未關閉的店舖
                  let store = await knex('stores')
                    .where('store_code', storeCode)
                    .where('is_closed', false)
                    .select('store_short_name_ as store_short_name')
                    .first();
                  
                  // 如果沒找到，再查找所有店舖（包括已關閉的）
                  if (!store) {
                    store = await knex('stores')
                      .where('store_code', storeCode)
                      .select('store_short_name_ as store_short_name')
                      .first();
                  }
                  
                  if (store && store.store_short_name) {
                    day.store_short_name = store.store_short_name;
                    console.log(`[getMonthlySummary] Found store_short_name: "${store.store_short_name}" for store_code: "${storeCode}" on date ${day.date}`);
                  }
                } catch (error) {
                  console.error(`[getMonthlySummary] Error fetching store by store_code ${storeCode} for date ${day.date}:`, error);
                }
              }
            }
          }
        }
      }

      res.json({ summary });
    } catch (error) {
      console.error('Get monthly summary error:', error);
      res.status(500).json({ message: '取得月結記錄失敗', error: error.message });
    }
  }

  // 從考勤數據複製並計算月結數據
  async copyFromAttendance(req, res) {
    try {
      const { user_id, year, month, attendance_date } = req.body;
      const userId = req.user.id;

      if (!user_id || !year || !month || !attendance_date) {
        return res.status(400).json({ message: '請提供用戶ID、年份、月份和日期' });
      }

      // 檢查權限：檢查是否有權限存取該用戶的月結表
      const hasPermission = await this.checkAccessPermission(userId, parseInt(user_id, 10));
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月結記錄' });
      }

      // 獲取用戶信息（用於獲取 employment_mode）
      const user = await User.findById(user_id);
      if (!user) {
        return res.status(404).json({ message: '找不到用戶' });
      }
      const employmentMode = (user.position_employment_mode || user.employment_mode || '').toString().trim().toUpperCase();

      // 獲取該用戶該月的考勤數據（使用 UTC+8 時區）
      // 確保使用 UTC+8 時區處理日期
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      // 計算該月的最後一天（UTC+8 時區）
      const lastDay = this.getLastDayOfMonthUTC8(year, month);
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      console.log(`[copyFromAttendance] Processing month ${year}-${month} for user ${user_id}`);
      console.log(`[copyFromAttendance] Date range: ${startDate} to ${endDate} (UTC+8)`);

      // 獲取該用戶的部門群組
      const DepartmentGroup = require('../database/models/DepartmentGroup');
      const userGroups = await DepartmentGroup.findByUserId(user_id);
      
      if (userGroups.length === 0) {
        return res.status(400).json({ message: '用戶不屬於任何部門群組' });
      }

      const departmentGroupId = userGroups[0].id;

      // 獲取考勤對比數據（直接調用attendance controller的方法）
      // attendance.controller 導出的是實例，不是類
      const attendanceController = require('./attendance.controller');
      
      // 創建模擬的req和res對象來調用getAttendanceComparison
      const mockReq = {
        query: {
          department_group_id: departmentGroupId,
          start_date: startDate,
          end_date: endDate
        },
        user: req.user
      };
      
      let comparisonData = [];
      let hasError = false;
      let errorMessage = '';
      
      const mockRes = {
        json: (data) => {
          comparisonData = data.comparison || [];
          return data;
        },
        status: (code) => ({
          json: (data) => {
            hasError = true;
            errorMessage = data.message || '獲取考勤數據失敗';
            return data;
          }
        })
      };

      try {
        await attendanceController.getAttendanceComparison(mockReq, mockRes);
        if (hasError) {
          return res.status(500).json({ message: errorMessage });
        }
      } catch (error) {
        console.error('Get attendance comparison error:', error);
        return res.status(500).json({ message: '獲取考勤數據失敗', error: error.message });
      }
      
      // 過濾出該用戶的數據
      const userAttendanceData = comparisonData.filter(item => 
        Number(item.user_id) === Number(user_id)
      );

      // 獲取現有的月結記錄
      let summary = await MonthlyAttendanceSummary.findByUserAndMonth(user_id, year, month);
      const dailyData = summary ? (summary.daily_data || []) : [];

      // 處理每一天的數據（使用 UTC+8 時區）
      // 先獲取該月的所有日期範圍，確保即使沒有打卡記錄也能保存排班資料
      const allDatesInMonth = [];
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        allDatesInMonth.push(dateStr);
      }
      
      // 創建一個以日期為鍵的映射，用於快速查找
      const dateDataMap = new Map();
      userAttendanceData.forEach(item => {
        const itemDate = item.attendance_date;
        // 使用 UTC+8 時區格式化日期
        const itemDateStr = this.formatDateToUTC8(itemDate);
        if (!itemDateStr) {
          console.warn('Invalid date format:', itemDate);
          return; // 跳過無效日期
        }
        dateDataMap.set(itemDateStr, item);
      });
      
      // 獲取該用戶該月的所有排班資料（即使沒有打卡記錄）
      const userSchedules = await Schedule.findAll({
        user_id: user_id,
        start_date: startDate,
        end_date: endDate
      });
      
      // 獲取已批准的假期申請
      const LeaveApplication = require('../database/models/LeaveApplication');
      let approvedLeaves = [];
      try {
        const leaveResult = await LeaveApplication.findAll({
          user_id: user_id,
          status: 'approved',
          start_date_from: startDate,
          end_date_to: endDate
        });
        approvedLeaves = Array.isArray(leaveResult?.applications) ? leaveResult.applications : [];
        // 過濾掉已銷假的假期
        approvedLeaves = approvedLeaves.filter(leave => !leave.is_reversed && !leave.is_reversal_transaction);
      } catch (error) {
        console.error('Get approved leaves error:', error);
      }
      
      // 將排班和假期資料轉換為按日期索引的格式
      const scheduleByDate = new Map();
      userSchedules.forEach(schedule => {
        const scheduleDateStr = this.formatDateToUTC8(schedule.schedule_date);
        if (scheduleDateStr) {
          scheduleByDate.set(scheduleDateStr, schedule);
        }
      });
      
      // 將假期資料轉換為按日期索引的格式
      const leaveByDate = new Map();
      approvedLeaves.forEach(leave => {
        const leaveStartStr = this.formatDateToUTC8(leave.start_date);
        const leaveEndStr = this.formatDateToUTC8(leave.end_date);
        if (leaveStartStr && leaveEndStr) {
          const start = new Date(leaveStartStr);
          const end = new Date(leaveEndStr);
          let current = new Date(start);
          while (current <= end) {
            const dateStr = this.formatDateToUTC8(current);
            if (dateStr) {
              if (!leaveByDate.has(dateStr)) {
                leaveByDate.set(dateStr, leave);
              }
            }
            current.setDate(current.getDate() + 1);
          }
        }
      });
      
      // 處理該月的每一天
      for (const dateStr of allDatesInMonth) {
        const item = dateDataMap.get(dateStr);
        const scheduleRecord = scheduleByDate.get(dateStr);
        const leaveRecord = leaveByDate.get(dateStr);
        
        // 構建排班資料（優先使用已批准的假期，否則使用排班記錄）
        let scheduleData = null;
        if (leaveRecord) {
          // 如果有已批准的假期，使用假期信息
          scheduleData = {
            id: scheduleRecord?.id || null,
            store_id: scheduleRecord?.store_id || null,
            start_time: scheduleRecord?.start_time || null,
            end_time: scheduleRecord?.end_time || null,
            leave_type_name_zh: leaveRecord.leave_type_name_zh || scheduleRecord?.leave_type_name_zh || null,
            leave_session: LeaveApplication.getSessionForDate ? LeaveApplication.getSessionForDate(leaveRecord, dateStr) : scheduleRecord?.leave_session || null,
            is_approved_leave: true
          };
        } else if (scheduleRecord) {
          // 如果沒有已批准的假期，但有排班記錄，使用排班記錄
          scheduleData = {
            id: scheduleRecord.id || null,
            store_id: scheduleRecord.store_id || null,
            start_time: scheduleRecord.start_time || null,
            end_time: scheduleRecord.end_time || null,
            leave_type_name_zh: scheduleRecord.leave_type_name_zh || null,
            leave_session: scheduleRecord.leave_session || null,
            is_approved_leave: false
          };
        } else if (item?.schedule) {
          // 如果從 attendance comparison 中有排班資料，使用它
          scheduleData = item.schedule;
        }
        
        const attendanceData = item || {
          attendance_date: dateStr,
          clock_records: []
        };
        
        if (item) {
          console.log(`Processing date ${dateStr} for user ${user_id}:`, {
            hasSchedule: !!item.schedule,
            hasScheduleRecord: !!scheduleRecord,
            hasLeaveRecord: !!leaveRecord,
            scheduleStartTime: scheduleData?.start_time,
            scheduleEndTime: scheduleData?.end_time,
            leaveType: scheduleData?.leave_type_name_zh,
            clockRecordsCount: item.clock_records?.length || 0
          });
        } else if (scheduleData) {
          // 即使沒有打卡記錄，如果有排班資料也要保存
          console.log(`Processing date ${dateStr} for user ${user_id} (no attendance data, but has schedule):`, {
            scheduleStartTime: scheduleData.start_time,
            scheduleEndTime: scheduleData.end_time,
            leaveType: scheduleData.leave_type_name_zh
          });
        }

        // 計算該天的考勤數據（傳入 employment_mode 以便計算 approved_overtime_minutes）
        const calculatedData = await this.calculateDailyAttendance(attendanceData, scheduleData || {}, employmentMode);

        // 更新或添加該天的數據
        const existingIndex = dailyData.findIndex(d => d.date === dateStr);
        if (existingIndex >= 0) {
          dailyData[existingIndex] = calculatedData;
        } else {
          dailyData.push(calculatedData);
        }
      }

      // 按日期排序（使用字符串比較，因為格式是 YYYY-MM-DD）
      dailyData.sort((a, b) => {
        if (!a.date || !b.date) return 0;
        return a.date.localeCompare(b.date);
      });

      // 保存月結記錄
      const summaryData = {
        user_id: parseInt(user_id, 10),
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        daily_data: dailyData,
        updated_by_id: userId
      };

      if (summary) {
        summary = await MonthlyAttendanceSummary.update(summary.id, summaryData);
      } else {
        summaryData.created_by_id = userId;
        summary = await MonthlyAttendanceSummary.create(summaryData);
      }

      res.json({ 
        summary,
        message: `成功複製並計算 ${dailyData.length} 天的考勤數據` 
      });
    } catch (error) {
      console.error('Copy from attendance error:', error);
      res.status(500).json({ message: '複製考勤數據失敗', error: error.message });
    }
  }

  // 計算單一天的數據
  async calculateDay(req, res) {
    try {
      const { user_id, date, attendance_data, schedule_data } = req.body;
      const userId = req.user.id;

      if (!user_id || !date) {
        return res.status(400).json({ message: '請提供用戶ID和日期' });
      }

      // 檢查權限：檢查是否有權限存取該用戶的月結表
      const hasPermission = await this.checkAccessPermission(userId, parseInt(user_id, 10));
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月結記錄' });
      }

      // 獲取用戶信息（用於獲取 employment_mode）
      const user = await User.findById(user_id);
      if (!user) {
        return res.status(404).json({ message: '找不到用戶' });
      }
      const employmentMode = (user.position_employment_mode || user.employment_mode || '').toString().trim().toUpperCase();

      // 如果沒有傳入 schedule_data，嘗試從數據庫獲取
      let finalScheduleData = schedule_data || {};
      if (!schedule_data || (!schedule_data.start_time && !schedule_data.end_time && !schedule_data.leave_type_name_zh)) {
        try {
          // 獲取該日期的排班資料
          const dateStr = this.formatDateToUTC8(date);
          const userSchedules = await Schedule.findAll({
            user_id: user_id,
            start_date: dateStr,
            end_date: dateStr
          });

          if (userSchedules && userSchedules.length > 0) {
            const scheduleRecord = userSchedules[0];
            // 獲取已批准的假期申請
            const LeaveApplication = require('../database/models/LeaveApplication');
            const leaveResult = await LeaveApplication.findAll({
              user_id: user_id,
              status: 'approved',
              start_date_from: dateStr,
              end_date_to: dateStr
            });
            const approvedLeaves = Array.isArray(leaveResult?.applications) 
              ? leaveResult.applications.filter(leave => !leave.is_reversed && !leave.is_reversal_transaction)
              : [];

            if (approvedLeaves.length > 0) {
              // 如果有已批准的假期，使用假期信息
              const leave = approvedLeaves[0];
              finalScheduleData = {
                id: scheduleRecord?.id || null,
                store_id: scheduleRecord?.store_id || null,
                start_time: scheduleRecord?.start_time || null,
                end_time: scheduleRecord?.end_time || null,
                leave_type_name_zh: leave.leave_type_name_zh || scheduleRecord?.leave_type_name_zh || null,
                leave_session: LeaveApplication.getSessionForDate ? LeaveApplication.getSessionForDate(leave, dateStr) : scheduleRecord?.leave_session || null,
                is_approved_leave: true
              };
            } else if (scheduleRecord) {
              // 如果沒有已批准的假期，但有排班記錄，使用排班記錄
              finalScheduleData = {
                id: scheduleRecord.id || null,
                store_id: scheduleRecord.store_id || null,
                start_time: scheduleRecord.start_time || null,
                end_time: scheduleRecord.end_time || null,
                leave_type_name_zh: scheduleRecord.leave_type_name_zh || null,
                leave_session: scheduleRecord.leave_session || null,
                is_approved_leave: false
              };
            }
          }
        } catch (error) {
          console.error('Error fetching schedule data:', error);
          // 如果獲取失敗，繼續使用傳入的 schedule_data 或空對象
        }
      }

      const calculatedData = await this.calculateDailyAttendance(
        attendance_data || {},
        finalScheduleData,
        employmentMode
      );

      res.json({ daily_data: calculatedData });
    } catch (error) {
      console.error('Calculate day error:', error);
      res.status(500).json({ message: '計算考勤數據失敗', error: error.message });
    }
  }

  // 更新月結記錄
  async updateMonthlySummary(req, res) {
    try {
      const { id } = req.params;
      const { daily_data } = req.body;
      const userId = req.user.id;

      const summary = await MonthlyAttendanceSummary.findById(id);
      if (!summary) {
        return res.status(404).json({ message: '月結記錄不存在' });
      }

      // 檢查權限：檢查是否有權限存取該用戶的月結表
      const hasPermission = await this.checkAccessPermission(userId, summary.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月結記錄' });
      }

      const updated = await MonthlyAttendanceSummary.update(id, {
        daily_data: daily_data || summary.daily_data,
        updated_by_id: userId
      });

      res.json({ summary: updated, message: '月結記錄更新成功' });
    } catch (error) {
      console.error('Update monthly summary error:', error);
      res.status(500).json({ message: '更新月結記錄失敗', error: error.message });
    }
  }

  // 刪除月結記錄
  async deleteMonthlySummary(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const summary = await MonthlyAttendanceSummary.findById(id);
      
      if (!summary) {
        return res.status(404).json({ message: '月結記錄不存在' });
      }

      // 檢查權限：檢查是否有權限存取該用戶的月結表
      const hasPermission = await this.checkAccessPermission(userId, summary.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月結記錄' });
      }

      await MonthlyAttendanceSummary.delete(id);
      res.json({ message: '月結記錄刪除成功' });
    } catch (error) {
      console.error('Delete monthly summary error:', error);
      res.status(500).json({ message: '刪除月結記錄失敗', error: error.message });
    }
  }

  /**
   * 月結表顯示嘅排班時間來源：
   * - 儲存喺 DB 表 monthly_attendance_summaries 嘅 daily_data（JSON），每個 day 有 schedule、late_minutes、total_work_hours 等
   * - 當用戶喺 /schedule 改編更後，要同步更新並用新排班重算該日（遲到、Break、總工時、超時、應計超時），月結表先會顯示最新
   */
  async syncScheduleToMonthlySummary(user_id, schedule_date, schedulePayload) {
    if (!user_id || !schedule_date) return;
    try {
      const dateStr = this.formatDateToUTC8(schedule_date);
      if (!dateStr) return;
      const [year, month] = dateStr.split('-').map(Number);
      const summary = await MonthlyAttendanceSummary.findByUserAndMonth(user_id, year, month);
      if (!summary) return;
      let dailyData = summary.daily_data;
      if (typeof dailyData === 'string') {
        try {
          dailyData = JSON.parse(dailyData);
        } catch (e) {
          return;
        }
      }
      if (!Array.isArray(dailyData)) return;
      const dayIndex = dailyData.findIndex(d => d && d.date === dateStr);
      if (dayIndex < 0) return;
      const day = dailyData[dayIndex];

      const newSchedule = {
        id: schedulePayload.id ?? null,
        store_id: schedulePayload.store_id ?? null,
        start_time: schedulePayload.start_time ?? null,
        end_time: schedulePayload.end_time ?? null,
        leave_type_name_zh: schedulePayload.leave_type_name_zh ?? null,
        leave_session: schedulePayload.leave_session ?? null,
        is_approved_leave: schedulePayload.is_approved_leave ?? false
      };

      // 用新排班重算該日，令遲到(分鐘)、Break時間、全日上班總時數、超時工作時間、應計超時工作時數一齊更新
      const user = await User.findById(user_id);
      const employmentMode = user ? ((user.position_employment_mode || user.employment_mode || '').toString().trim().toUpperCase()) : null;
      const attendanceData = {
        attendance_date: dateStr,
        clock_records: (day.attendance_data && Array.isArray(day.attendance_data.clock_records))
          ? day.attendance_data.clock_records
          : []
      };
      const calculatedDay = await this.calculateDailyAttendance(attendanceData, newSchedule, employmentMode);
      dailyData[dayIndex] = calculatedDay;

      await MonthlyAttendanceSummary.update(summary.id, { daily_data: dailyData });
    } catch (error) {
      console.error('[syncScheduleToMonthlySummary] error:', error);
    }
  }
}

module.exports = new MonthlyAttendanceSummaryController();
