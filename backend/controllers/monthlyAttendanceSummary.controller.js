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
  calculateDailyAttendance(attendanceData, scheduleData) {
    const result = {
      date: attendanceData.attendance_date,
      late_minutes: null,
      break_duration: null, // 分鐘數
      total_work_hours: null, // 小時數
      overtime_hours: null, // 小時數
      early_leave: false,
      is_late: false,
      is_absent: false,
      attendance_data: attendanceData
    };

    // 獲取有效的打卡記錄（按時間排序）
    const validRecords = (attendanceData.clock_records || [])
      .filter(r => r.is_valid === true)
      .sort((a, b) => {
        const timeA = a.clock_time || '';
        const timeB = b.clock_time || '';
        return timeA.localeCompare(timeB);
      });

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
    if (clockInTime && clockOutTime) {
      const start = this.parseTime(clockInTime);
      const end = this.parseTime(clockOutTime);
      
      if (start !== null && end !== null) {
        const totalMinutes = end - start;
        result.total_work_hours = (totalMinutes / 60).toFixed(2);
      }
    }

    // 計算超時工作時間
    if (scheduleEndTime && clockOutTime) {
      const scheduleEnd = this.parseTime(scheduleEndTime);
      const actualEnd = this.parseTime(clockOutTime);
      
      if (actualEnd !== null && scheduleEnd !== null && actualEnd > scheduleEnd) {
        const overtimeMinutes = actualEnd - scheduleEnd;
        result.overtime_hours = (overtimeMinutes / 60).toFixed(2);
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

  // 取得月結記錄列表
  async getMonthlySummaries(req, res) {
    try {
      const { user_id, year, month } = req.query;
      const filters = {};
      
      if (user_id) filters.user_id = parseInt(user_id, 10);
      if (year) filters.year = parseInt(year, 10);
      if (month) filters.month = parseInt(month, 10);

      const summaries = await MonthlyAttendanceSummary.findAll(filters);
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
      const summary = await MonthlyAttendanceSummary.findById(id);
      
      if (!summary) {
        return res.status(404).json({ message: '月結記錄不存在' });
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

      // 獲取該用戶該月的考勤數據（使用 UTC+8 時區）
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      // 計算該月的最後一天（UTC+8 時區）
      const lastDay = this.getLastDayOfMonthUTC8(year, month);
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

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
      userAttendanceData.forEach(item => {
        const itemDate = item.attendance_date;
        // 使用 UTC+8 時區格式化日期
        const itemDateStr = this.formatDateToUTC8(itemDate);
        if (!itemDateStr) {
          console.warn('Invalid date format:', itemDate);
          return; // 跳過無效日期
        }

        // 計算該天的考勤數據
        const calculatedData = this.calculateDailyAttendance(item, item.schedule || {});

        // 更新或添加該天的數據
        const existingIndex = dailyData.findIndex(d => d.date === itemDateStr);
        if (existingIndex >= 0) {
          dailyData[existingIndex] = calculatedData;
        } else {
          dailyData.push(calculatedData);
        }
      });

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

      if (!user_id || !date) {
        return res.status(400).json({ message: '請提供用戶ID和日期' });
      }

      const calculatedData = this.calculateDailyAttendance(
        attendance_data || {},
        schedule_data || {}
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
      const summary = await MonthlyAttendanceSummary.findById(id);
      
      if (!summary) {
        return res.status(404).json({ message: '月結記錄不存在' });
      }

      await MonthlyAttendanceSummary.delete(id);
      res.json({ message: '月結記錄刪除成功' });
    } catch (error) {
      console.error('Delete monthly summary error:', error);
      res.status(500).json({ message: '刪除月結記錄失敗', error: error.message });
    }
  }
}

module.exports = new MonthlyAttendanceSummaryController();
