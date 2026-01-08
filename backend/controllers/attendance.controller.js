const Attendance = require('../database/models/Attendance');
const Schedule = require('../database/models/Schedule');
const DepartmentGroup = require('../database/models/DepartmentGroup');

class AttendanceController {
  // 取得考勤列表
  async getAttendances(req, res) {
    try {
      const {
        user_id,
        department_group_id,
        start_date,
        end_date,
        attendance_date,
        status
      } = req.query;

      const filters = {};
      if (user_id) filters.user_id = user_id;
      if (department_group_id) filters.department_group_id = department_group_id;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;
      if (attendance_date) filters.attendance_date = attendance_date;
      if (status) filters.status = status;

      const attendances = await Attendance.findAll(filters);
      res.json({ attendances });
    } catch (error) {
      console.error('Get attendances error:', error);
      res.status(500).json({ message: '獲取考勤記錄失敗', error: error.message });
    }
  }

  // 取得單一考勤記錄
  async getAttendance(req, res) {
    try {
      const { id } = req.params;
      const attendance = await Attendance.findById(id);

      if (!attendance) {
        return res.status(404).json({ message: '考勤記錄不存在' });
      }

      res.json({ attendance });
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ message: '獲取考勤記錄失敗', error: error.message });
    }
  }

  // 建立考勤記錄
  async createAttendance(req, res) {
    try {
      const userId = req.user.id;
      const {
        user_id,
        department_group_id,
        attendance_date,
        clock_in_time,
        clock_out_time,
        time_off_start,
        time_off_end,
        remarks
      } = req.body;

      if (!user_id || !department_group_id || !attendance_date) {
        return res.status(400).json({ message: '請提供用戶ID、部門群組ID和考勤日期' });
      }

      // 獲取對應的排班記錄
      const schedule = await Schedule.findAll({
        user_id,
        schedule_date: attendance_date
      });

      let status = null;
      let late_minutes = null;

      // 如果有排班記錄，計算考勤狀態
      if (schedule && schedule.length > 0) {
        const roster = schedule[0];
        if (roster.start_time && clock_in_time) {
          // 計算遲到分鐘數
          const rosterTime = new Date(`2000-01-01 ${roster.start_time}`);
          const clockInTime = new Date(`2000-01-01 ${clock_in_time}`);
          const diffMinutes = (clockInTime - rosterTime) / (1000 * 60);

          if (diffMinutes > 0) {
            status = 'late';
            late_minutes = Math.round(diffMinutes);
          } else {
            status = 'on_time';
          }
        } else if (!clock_in_time && !clock_out_time) {
          // 沒有打卡記錄，視為缺席
          status = 'absent';
        } else if (clock_in_time || clock_out_time) {
          // 有打卡但沒有排班時間，視為準時
          status = 'on_time';
        }
      } else {
        // 沒有排班記錄，如果有打卡則視為準時
        if (clock_in_time || clock_out_time) {
          status = 'on_time';
        } else {
          status = 'absent';
        }
      }

      const attendanceData = {
        user_id,
        department_group_id,
        attendance_date,
        clock_in_time: clock_in_time || null,
        clock_out_time: clock_out_time || null,
        time_off_start: time_off_start || null,
        time_off_end: time_off_end || null,
        status,
        late_minutes,
        remarks: remarks || null,
        created_by_id: userId,
        updated_by_id: userId
      };

      const attendance = await Attendance.upsert(attendanceData);
      res.status(201).json({ attendance, message: '考勤記錄建立成功' });
    } catch (error) {
      console.error('Create attendance error:', error);
      res.status(500).json({ message: '建立考勤記錄失敗', error: error.message });
    }
  }

  // 更新考勤記錄
  async updateAttendance(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const {
        clock_in_time,
        clock_out_time,
        time_off_start,
        time_off_end,
        remarks
      } = req.body;

      const existing = await Attendance.findById(id);
      if (!existing) {
        return res.status(404).json({ message: '考勤記錄不存在' });
      }

      // 重新計算狀態
      const schedule = await Schedule.findAll({
        user_id: existing.user_id,
        schedule_date: existing.attendance_date
      });

      let status = null;
      let late_minutes = null;

      // 使用更新後的值，如果沒有提供則使用現有值
      const finalClockInTime = clock_in_time !== undefined ? clock_in_time : existing.clock_in_time;
      const finalClockOutTime = clock_out_time !== undefined ? clock_out_time : existing.clock_out_time;

      if (schedule && schedule.length > 0) {
        const roster = schedule[0];
        if (roster.start_time && finalClockInTime) {
          // 確保時間格式正確（處理 'HH:mm:ss' 或 'HH:mm' 格式）
          let rosterTimeStr = roster.start_time;
          if (!rosterTimeStr.includes(':')) {
            // 如果是 'HHmm' 格式，轉換為 'HH:mm:ss'
            rosterTimeStr = `${rosterTimeStr.substring(0, 2)}:${rosterTimeStr.substring(2, 4)}:00`;
          } else if (rosterTimeStr.split(':').length === 2) {
            // 如果是 'HH:mm' 格式，添加 ':00'
            rosterTimeStr = `${rosterTimeStr}:00`;
          }
          
          let clockInTimeStr = finalClockInTime;
          if (!clockInTimeStr.includes(':')) {
            clockInTimeStr = `${clockInTimeStr.substring(0, 2)}:${clockInTimeStr.substring(2, 4)}:00`;
          } else if (clockInTimeStr.split(':').length === 2) {
            clockInTimeStr = `${clockInTimeStr}:00`;
          }
          
          const rosterTime = new Date(`2000-01-01 ${rosterTimeStr}`);
          const clockInTime = new Date(`2000-01-01 ${clockInTimeStr}`);
          const diffMinutes = (clockInTime - rosterTime) / (1000 * 60);

          if (diffMinutes > 0) {
            status = 'late';
            late_minutes = Math.round(diffMinutes);
          } else {
            status = 'on_time';
            late_minutes = null;
          }
        } else if (!finalClockInTime && !finalClockOutTime) {
          // 沒有打卡記錄，視為缺席
          status = 'absent';
          late_minutes = null;
        } else if (finalClockInTime || finalClockOutTime) {
          // 有打卡但沒有排班時間，視為準時
          status = 'on_time';
          late_minutes = null;
        }
      } else {
        // 沒有排班記錄
        if (finalClockInTime || finalClockOutTime) {
          status = 'on_time';
          late_minutes = null;
        } else {
          status = 'absent';
          late_minutes = null;
        }
      }

      const attendanceData = {
        clock_in_time: clock_in_time !== undefined ? (clock_in_time || null) : existing.clock_in_time,
        clock_out_time: clock_out_time !== undefined ? (clock_out_time || null) : existing.clock_out_time,
        time_off_start: time_off_start !== undefined ? (time_off_start || null) : existing.time_off_start,
        time_off_end: time_off_end !== undefined ? (time_off_end || null) : existing.time_off_end,
        status,
        late_minutes,
        remarks: remarks !== undefined ? remarks : existing.remarks,
        updated_by_id: userId
      };

      const attendance = await Attendance.update(id, attendanceData);
      res.json({ attendance, message: '考勤記錄更新成功' });
    } catch (error) {
      console.error('Update attendance error:', error);
      res.status(500).json({ message: '更新考勤記錄失敗', error: error.message });
    }
  }

  // 刪除考勤記錄
  async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      const attendance = await Attendance.findById(id);

      if (!attendance) {
        return res.status(404).json({ message: '考勤記錄不存在' });
      }

      await Attendance.delete(id);
      res.json({ message: '考勤記錄刪除成功' });
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

      // 獲取日期範圍內的所有考勤記錄
      const attendances = await Attendance.findAll({
        department_group_id,
        start_date,
        end_date
      });

      // 生成日期列表
      const dates = [];
      const start = new Date(start_date);
      const end = new Date(end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d).toISOString().split('T')[0]);
      }

      // 將考勤記錄轉換為按用戶和日期索引的格式
      const attendancesMap = {};
      attendances.forEach(attendance => {
        const key = `${attendance.user_id}_${attendance.attendance_date}`;
        attendancesMap[key] = attendance;
      });

      // 構建對比數據
      const comparison = [];
      for (const member of members) {
        for (const date of dates) {
          const scheduleKey = `${member.id}_${date}`;
          const schedule = schedules[scheduleKey] || null;
          const attendance = attendancesMap[scheduleKey] || null;

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
            attendance: attendance ? {
              id: attendance.id,
              clock_in_time: attendance.clock_in_time,
              clock_out_time: attendance.clock_out_time,
              time_off_start: attendance.time_off_start,
              time_off_end: attendance.time_off_end,
              status: attendance.status,
              late_minutes: attendance.late_minutes,
              remarks: attendance.remarks
            } : null
          });
        }
      }

      res.json({ comparison });
    } catch (error) {
      console.error('Get attendance comparison error:', error);
      res.status(500).json({ message: '獲取考勤對比失敗', error: error.message });
    }
  }
}

module.exports = new AttendanceController();
