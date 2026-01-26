const MonthlyAttendanceReport = require('../database/models/MonthlyAttendanceReport');
const MonthlyAttendanceSummary = require('../database/models/MonthlyAttendanceSummary');
const User = require('../database/models/User');
const LeaveType = require('../database/models/LeaveType');
const knex = require('../config/database');

class MonthlyAttendanceReportController {
  // 檢查權限：檢查是否有權限存取該用戶的月報
  // 允許：HR 成員、系統管理員、申請人本人、以及任何作為 checker/approver1/approver2/approver3 的用戶
  async checkAccessPermission(currentUserId, targetUserId) {
    try {
      // 檢查是否為 HR 成員或系統管理員
      const isHRMember = await User.isHRMember(currentUserId);
      const currentUser = await User.findById(currentUserId);
      if (isHRMember || (currentUser && currentUser.is_system_admin)) {
        console.log(`[checkAccessPermission] 用戶 ${currentUserId} 是 HR 成員或系統管理員，允許存取`);
        return true;
      }

      // 如果指定了目標用戶 ID，檢查是否為本人
      if (targetUserId && Number(currentUserId) === Number(targetUserId)) {
        console.log(`[checkAccessPermission] 用戶 ${currentUserId} 查看自己的月報，允許存取`);
        return true;
      }

      // 檢查用戶是否是任何假期申請的批核者（checker、approver1、approver2、approver3）
      const userIdNum = Number(currentUserId);
      
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
        console.log(`[checkAccessPermission] 用戶 ${currentUserId} 是直接批核者，允許存取`);
        return true;
      }

      // 方法2：檢查是否通過授權群組屬於批核者（使用 User.isApprovalMember）
      const isApprovalMember = await User.isApprovalMember(currentUserId);
      if (isApprovalMember) {
        console.log(`[checkAccessPermission] 用戶 ${currentUserId} 通過授權群組屬於批核者，允許存取`);
        return true;
      }

      console.log(`[checkAccessPermission] 用戶 ${currentUserId} 沒有權限存取月報`);
      return false;
    } catch (error) {
      console.error('[checkAccessPermission] 檢查權限時發生錯誤:', error);
      return false;
    }
  }

  // 根據假期類型代碼或名稱歸類假期
  classifyLeaveType(leaveTypeCode, leaveTypeNameZh) {
    const code = (leaveTypeCode || '').trim().toUpperCase();
    const nameZh = (leaveTypeNameZh || '').trim();

    // 年假類
    if (code === 'AL') return 'annual_leave_days';
    if (code === 'BL') return 'birthday_leave_days';
    if (code === 'CL') return 'compensatory_leave_days';

    // 病假類
    if (code === 'FPSL') return 'full_paid_sick_leave_days';
    if (code === 'SAL') return 'sick_leave_with_allowance_days';
    if (code === 'NPSL') return 'no_pay_sick_leave_days';
    if (code === 'IL') return 'work_injury_leave_days';

    // 其他假期類
    if (code === 'MGL') return 'marriage_leave_days';
    if (code === 'MTL') return 'maternity_leave_days';
    if (code === 'PTL') return 'paternity_leave_days';
    if (code === 'JSL') return 'jury_service_leave_days';
    if (code === 'CPL') return 'compassionate_leave_days';
    if (code === 'NPL') return 'no_pay_personal_leave_days';
    if (code === 'SPL') return 'special_leave_days';
    if (code === 'ABS') return 'absent_days';

    // 例假類：區分累積例假（AR）和本月例假（R1-R6）
    if (code === 'AR') return 'accumulated_rest_days_days'; // 累積例假
    if (code.startsWith('R')) return 'current_rest_days_days'; // 本月例假（R1-R6）
    
    // 法定假期
    if (code === 'SH') return 'statutory_holiday_days';

    // 如果沒有代碼，嘗試根據中文名稱匹配
    if (nameZh) {
      if (nameZh.includes('年假')) return 'annual_leave_days';
      if (nameZh.includes('生日假')) return 'birthday_leave_days';
      if (nameZh.includes('補假')) return 'compensatory_leave_days';
      if (nameZh === '全薪病假') return 'full_paid_sick_leave_days';
      if (nameZh.includes('病假') && nameZh.includes('疾病津貼')) return 'sick_leave_with_allowance_days';
      if (nameZh === '無薪病假') return 'no_pay_sick_leave_days';
      if (nameZh.includes('工傷') || nameZh.includes('工傷病假')) return 'work_injury_leave_days';
      if (nameZh.includes('婚假')) return 'marriage_leave_days';
      if (nameZh.includes('產假')) return 'maternity_leave_days';
      if (nameZh.includes('侍產假')) return 'paternity_leave_days';
      if (nameZh.includes('陪審團假')) return 'jury_service_leave_days';
      if (nameZh.includes('恩恤假')) return 'compassionate_leave_days';
      if (nameZh === '無薪事假') return 'no_pay_personal_leave_days';
      if (nameZh.includes('特別假期') || nameZh.includes('特別假')) return 'special_leave_days';
      if (nameZh.includes('累積例假')) return 'accumulated_rest_days_days'; // 累積例假
      if (nameZh.includes('例假')) return 'current_rest_days_days'; // 本月例假
      if (nameZh.includes('法定假期')) return 'statutory_holiday_days';
      if (nameZh.includes('缺勤')) return 'absent_days';
    }

    return null; // 無法歸類
  }

  // 計算一天的假期天數（考慮半天假）
  calculateLeaveDays(leaveSession) {
    if (!leaveSession) return 1.0; // 全天假
    if (leaveSession === 'AM' || leaveSession === 'PM') return 0.5; // 半天假
    return 1.0;
  }

  // 從月結數據生成月報
  async generateReport(req, res) {
    try {
      const { user_id, year, month } = req.body;
      const userId = req.user.id;

      if (!user_id || !year || !month) {
        return res.status(400).json({ message: '請提供用戶ID、年份和月份' });
      }

      // 檢查權限
      const hasPermission = await this.checkAccessPermission(userId, parseInt(user_id, 10));
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月報記錄' });
      }

      // 獲取月結數據，如果沒有則自動生成
      let summary = await MonthlyAttendanceSummary.findByUserAndMonth(user_id, year, month);
      if (!summary || !summary.daily_data || summary.daily_data.length === 0) {
        // 自動生成月結數據
        console.log(`[generateReport] 沒有找到月結數據，自動生成中... user_id=${user_id}, year=${year}, month=${month}`);
        
        try {
          // 調用月結表的 copyFromAttendance 方法來生成月結數據
          const monthlyAttendanceSummaryController = require('./monthlyAttendanceSummary.controller');
          
          // 創建模擬的 req 對象
          const mockReq = {
            body: {
              user_id: user_id,
              year: year,
              month: month,
              attendance_date: `${year}-${String(month).padStart(2, '0')}-01` // 使用該月第一天作為日期參數
            },
            user: req.user
          };
          
          // 創建模擬的 res 對象
          let summaryCreated = false;
          let summaryError = null;
          const mockRes = {
            json: (data) => {
              // 成功的情況
              summaryCreated = true;
              console.log(`[generateReport] 月結數據生成成功: ${data.message || '成功'}`);
              return data;
            },
            status: (code) => ({
              json: (data) => {
                if (code >= 200 && code < 300) {
                  summaryCreated = true;
                  console.log(`[generateReport] 月結數據生成成功: ${data.message || '成功'}`);
                } else {
                  summaryError = data.message || '生成月結數據失敗';
                  console.error(`[generateReport] 生成月結數據失敗 (${code}): ${summaryError}`);
                }
                return data;
              }
            })
          };
          
          // 調用 copyFromAttendance
          await monthlyAttendanceSummaryController.copyFromAttendance(mockReq, mockRes);
          
          if (summaryError) {
            console.error(`[generateReport] 生成月結數據失敗: ${summaryError}`);
            return res.status(500).json({ message: `生成月結數據失敗: ${summaryError}` });
          }
          
          if (!summaryCreated) {
            console.error(`[generateReport] 無法確定月結數據是否生成成功`);
            return res.status(500).json({ message: '生成月結數據失敗：無法確認生成狀態' });
          }
          
          // 重新獲取月結數據
          summary = await MonthlyAttendanceSummary.findByUserAndMonth(user_id, year, month);
          
          if (!summary || !summary.daily_data || summary.daily_data.length === 0) {
            return res.status(500).json({ message: '生成月結數據後仍無法獲取數據，請稍後再試' });
          }
          
          console.log(`[generateReport] 月結數據已自動生成，共 ${summary.daily_data.length} 天`);
        } catch (error) {
          console.error('[generateReport] 自動生成月結數據時發生錯誤:', error);
          return res.status(500).json({ message: '自動生成月結數據失敗', error: error.message });
        }
      }

      // 獲取用戶信息
      const user = await User.findById(user_id);
      if (!user) {
        return res.status(404).json({ message: '找不到用戶' });
      }

      const employmentMode = (user.position_employment_mode || user.employment_mode || '').toString().trim().toUpperCase();

      // 檢查月結數據是否包含 approved_overtime_minutes 字段
      // 如果沒有，需要重新生成月結數據（僅對 FT 員工）
      if (employmentMode === 'FT' && summary && summary.daily_data && summary.daily_data.length > 0) {
        const sampleDay = summary.daily_data.find(d => d.date); // 找一個有日期的數據
        if (sampleDay && !sampleDay.hasOwnProperty('approved_overtime_minutes')) {
          console.log(`[generateReport] 檢測到月結數據缺少 approved_overtime_minutes 字段，需要重新生成`);
          try {
            const monthlyAttendanceSummaryController = require('./monthlyAttendanceSummary.controller');
            const mockReq = {
              body: {
                user_id: user_id,
                year: year,
                month: month,
                attendance_date: `${year}-${String(month).padStart(2, '0')}-01`
              },
              user: req.user
            };
            let summaryRegenerated = false;
            const mockRes = {
              json: (data) => {
                summaryRegenerated = true;
                console.log(`[generateReport] 月結數據重新生成成功`);
                return data;
              },
              status: (code) => ({
                json: (data) => {
                  console.error(`[generateReport] 月結數據重新生成失敗 (${code}):`, data);
                  throw new Error(data.message || '重新生成月結數據失敗');
                }
              })
            };
            
            await monthlyAttendanceSummaryController.copyFromAttendance(mockReq, mockRes);
            
            if (summaryRegenerated) {
              // 重新獲取月結數據
              summary = await MonthlyAttendanceSummary.findByUserAndMonth(user_id, year, month);
              if (!summary || !summary.daily_data || summary.daily_data.length === 0) {
                return res.status(500).json({ message: '重新生成月結數據後仍無法獲取數據，請稍後再試' });
              }
              console.log(`[generateReport] 月結數據已重新生成，共 ${summary.daily_data.length} 天`);
            }
          } catch (error) {
            console.error('[generateReport] 重新生成月結數據時發生錯誤:', error);
            // 不中斷流程，繼續使用現有數據
            console.log(`[generateReport] 繼續使用現有月結數據（可能缺少 approved_overtime_minutes）`);
          }
        }
      }

      // 初始化統計數據
      const reportData = {
        user_id: parseInt(user_id, 10),
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        // 假期統計
        annual_leave_days: 0,
        birthday_leave_days: 0,
        compensatory_leave_days: 0,
        full_paid_sick_leave_days: 0,
        sick_leave_with_allowance_days: 0,
        no_pay_sick_leave_days: 0,
        work_injury_leave_days: 0,
        marriage_leave_days: 0,
        maternity_leave_days: 0,
        paternity_leave_days: 0,
        jury_service_leave_days: 0,
        compassionate_leave_days: 0,
        no_pay_personal_leave_days: 0,
        special_leave_days: 0,
        current_rest_days_days: 0,
        accumulated_rest_days_days: 0,
        statutory_holiday_days: 0,
        absent_days: 0,
        // 工作統計
        work_days: 0,
        late_count: 0,
        late_total_minutes: 0,
        // FT/PT
        ft_overtime_hours: 0,
        pt_work_hours: 0,
        // 津貼（保持現有值或設為0）
        store_manager_allowance: 0,
        attendance_bonus: 0,
        location_allowance: 0,
        incentive: 0,
        special_allowance: 0,
        remarks: null,
        created_by_id: userId,
        updated_by_id: userId
      };

      // 檢查是否已有報告，如果有則保留手動輸入的津貼
      const existingReport = await MonthlyAttendanceReport.findByUserAndMonth(user_id, year, month);
      if (existingReport) {
        // 確保所有數值都是數字類型
        reportData.store_manager_allowance = parseFloat(existingReport.store_manager_allowance) || 0;
        reportData.attendance_bonus = parseFloat(existingReport.attendance_bonus) || 0;
        reportData.location_allowance = parseFloat(existingReport.location_allowance) || 0;
        reportData.incentive = parseFloat(existingReport.incentive) || 0;
        reportData.special_allowance = parseFloat(existingReport.special_allowance) || 0;
        reportData.remarks = existingReport.remarks;
        reportData.created_by_id = existingReport.created_by_id; // 保留原始創建者
      }

      // 處理每天的數據
      if (!summary.daily_data || !Array.isArray(summary.daily_data)) {
        console.warn(`[generateReport] summary.daily_data 不是數組或為空:`, summary.daily_data);
        summary.daily_data = [];
      }
      
      console.log(`[generateReport] 開始處理 ${summary.daily_data.length} 天的數據`);
      console.log(`[generateReport] 用戶 employment_mode: ${employmentMode}`);
      
      // 檢查前幾天的數據結構
      const sampleDays = summary.daily_data.slice(0, 3);
      console.log(`[generateReport] 樣本數據結構（前3天）:`, JSON.stringify(sampleDays.map(d => ({
        date: d.date,
        has_approved_overtime_minutes: d.hasOwnProperty('approved_overtime_minutes'),
        approved_overtime_minutes: d.approved_overtime_minutes,
        total_work_hours: d.total_work_hours,
        overtime_hours: d.overtime_hours
      })), null, 2));
      
      for (const day of summary.daily_data) {
        const schedule = day.schedule || day.attendance_data?.schedule;
        const leaveTypeCode = schedule?.leave_type_code;
        const leaveTypeNameZh = schedule?.leave_type_name_zh;
        const leaveSession = schedule?.leave_session;

        // 處理假期歸類
        if (leaveTypeCode || leaveTypeNameZh) {
          const leaveField = this.classifyLeaveType(leaveTypeCode, leaveTypeNameZh);
          if (leaveField) {
            const leaveDays = this.calculateLeaveDays(leaveSession);
            // 確保數值類型正確，避免字符串連接
            const currentValue = parseFloat(reportData[leaveField]) || 0;
            reportData[leaveField] = currentValue + parseFloat(leaveDays);
          }
        }

        // 計算工作統計
        const hasWorkTime = day.total_work_hours && day.total_work_hours > 0;
        const hasScheduleTime = schedule && (schedule.start_time || schedule.end_time);
        
        // 如果有工作時間或排班時間（且不是假期），計為上班日
        if ((hasWorkTime || hasScheduleTime) && !leaveTypeCode && !leaveTypeNameZh) {
          reportData.work_days = (parseFloat(reportData.work_days) || 0) + 1;
        }

        // 計算遲到
        if (day.is_late && day.late_minutes) {
          reportData.late_count = (parseInt(reportData.late_count) || 0) + 1;
          reportData.late_total_minutes = (parseFloat(reportData.late_total_minutes) || 0) + parseFloat(day.late_minutes || 0);
        }

        // 根據 employment_mode 計算 FT 超時工作或 PT 工作時數
        if (employmentMode === 'FT') {
          // FT: 直接使用應計超時工作時數（approved_overtime_minutes）
          // 檢查字段是否存在（包括 null 和 0 的情況）
          const hasApprovedOvertime = day.hasOwnProperty('approved_overtime_minutes');
          const approvedOvertimeValue = day.approved_overtime_minutes;
          
          console.log(`[generateReport] FT 員工 ${user_id} 日期 ${day.date || '未知'}: hasOwnProperty=${hasApprovedOvertime}, value=${approvedOvertimeValue}, type=${typeof approvedOvertimeValue}`);
          
          if (hasApprovedOvertime && approvedOvertimeValue !== null && approvedOvertimeValue !== undefined) {
            const approvedOvertimeMinutes = parseFloat(approvedOvertimeValue) || 0;
            if (approvedOvertimeMinutes > 0) {
              const overtimeHours = approvedOvertimeMinutes / 60;
              reportData.ft_overtime_hours = (parseFloat(reportData.ft_overtime_hours) || 0) + overtimeHours;
              console.log(`[generateReport] ✓ FT 員工 ${user_id} 日期 ${day.date || '未知'}: approved_overtime_minutes=${approvedOvertimeMinutes}, 轉換為小時=${overtimeHours.toFixed(2)}, 累計=${reportData.ft_overtime_hours.toFixed(2)}`);
            } else {
              console.log(`[generateReport] - FT 員工 ${user_id} 日期 ${day.date || '未知'}: approved_overtime_minutes=${approvedOvertimeMinutes} (為0或負數，不累加)`);
            }
          } else {
            // 如果沒有 approved_overtime_minutes，嘗試使用 overtime_hours 作為備用
            if (day.overtime_hours) {
              const overtimeHours = parseFloat(day.overtime_hours) || 0;
              if (overtimeHours > 0) {
                // 對於 FT 員工，如果有超時工作，向下取整到30分鐘
                const overtimeMinutes = Math.floor(overtimeHours * 60 / 30) * 30;
                const adjustedHours = overtimeMinutes / 60;
                reportData.ft_overtime_hours = (parseFloat(reportData.ft_overtime_hours) || 0) + adjustedHours;
                console.log(`[generateReport] ⚠ FT 員工 ${user_id} 日期 ${day.date || '未知'}: 使用備用方案 overtime_hours=${overtimeHours}, 調整後=${adjustedHours.toFixed(2)}, 累計=${reportData.ft_overtime_hours.toFixed(2)}`);
              }
            } else {
              console.log(`[generateReport] ✗ FT 員工 ${user_id} 日期 ${day.date || '未知'}: 沒有 approved_overtime_minutes 字段且沒有 overtime_hours`);
            }
          }
        } else if (employmentMode === 'PT') {
          // PT: 使用應計工作時數（approved_overtime_minutes）
          const hasApprovedOvertime = day.hasOwnProperty('approved_overtime_minutes');
          const approvedOvertimeValue = day.approved_overtime_minutes;
          
          console.log(`[generateReport] PT 員工 ${user_id} 日期 ${day.date || '未知'}: hasOwnProperty=${hasApprovedOvertime}, value=${approvedOvertimeValue}, type=${typeof approvedOvertimeValue}`);
          
          if (hasApprovedOvertime && approvedOvertimeValue !== null && approvedOvertimeValue !== undefined) {
            const approvedWorkMinutes = parseFloat(approvedOvertimeValue) || 0;
            if (approvedWorkMinutes > 0) {
              const workHours = approvedWorkMinutes / 60;
              reportData.pt_work_hours = (parseFloat(reportData.pt_work_hours) || 0) + workHours;
              console.log(`[generateReport] ✓ PT 員工 ${user_id} 日期 ${day.date || '未知'}: approved_overtime_minutes=${approvedWorkMinutes}, 轉換為小時=${workHours.toFixed(2)}, 累計=${reportData.pt_work_hours.toFixed(2)}`);
            } else {
              console.log(`[generateReport] - PT 員工 ${user_id} 日期 ${day.date || '未知'}: approved_overtime_minutes=${approvedWorkMinutes} (為0或負數，不累加)`);
            }
          } else {
            // 如果沒有 approved_overtime_minutes，使用備用方案 total_work_hours
            const totalWorkHours = parseFloat(day.total_work_hours) || 0;
            if (totalWorkHours > 0) {
              // 對於 PT 員工，如果有總工作時數，向下取整到15分鐘
              const totalWorkMinutes = totalWorkHours * 60;
              const adjustedMinutes = Math.floor(totalWorkMinutes / 15) * 15;
              const adjustedHours = adjustedMinutes / 60;
              reportData.pt_work_hours = (parseFloat(reportData.pt_work_hours) || 0) + adjustedHours;
              console.log(`[generateReport] ⚠ PT 員工 ${user_id} 日期 ${day.date || '未知'}: 使用備用方案 total_work_hours=${totalWorkHours}, 調整後=${adjustedHours.toFixed(2)}, 累計=${reportData.pt_work_hours.toFixed(2)}`);
            } else {
              console.log(`[generateReport] ✗ PT 員工 ${user_id} 日期 ${day.date || '未知'}: 沒有 approved_overtime_minutes 字段且沒有 total_work_hours`);
            }
          }
        }
      }

      // 確保所有數值字段都是正確的數字類型（避免字符串連接問題）
      const numericFields = [
        'annual_leave_days', 'birthday_leave_days', 'compensatory_leave_days',
        'full_paid_sick_leave_days', 'sick_leave_with_allowance_days', 'no_pay_sick_leave_days',
        'work_injury_leave_days', 'marriage_leave_days', 'maternity_leave_days',
        'paternity_leave_days', 'jury_service_leave_days', 'compassionate_leave_days',
        'no_pay_personal_leave_days', 'special_leave_days', 'current_rest_days_days',
        'accumulated_rest_days_days', 'statutory_holiday_days', 'absent_days',
        'work_days', 'late_total_minutes', 'ft_overtime_hours', 'pt_work_hours',
        'store_manager_allowance', 'attendance_bonus', 'location_allowance',
        'incentive', 'special_allowance'
      ];
      
      for (const field of numericFields) {
        if (reportData[field] !== undefined && reportData[field] !== null) {
          reportData[field] = parseFloat(reportData[field]) || 0;
        }
      }
      
      // 確保整數字段是整數
      reportData.late_count = parseInt(reportData.late_count) || 0;
      reportData.work_days = parseFloat(reportData.work_days) || 0;

      // 保存或更新報告
      const report = await MonthlyAttendanceReport.upsert(reportData);

      console.log(`[generateReport] 月報生成成功: user_id=${user_id}, year=${year}, month=${month}, report_id=${report.id}`);
      console.log(`[generateReport] 最終統計: ft_overtime_hours=${reportData.ft_overtime_hours}, pt_work_hours=${reportData.pt_work_hours}`);
      
      res.json({
        message: existingReport ? '月報已更新' : '月報已生成',
        report
      });
    } catch (error) {
      console.error('[generateReport] 生成月報時發生錯誤:', error);
      console.error('[generateReport] 錯誤堆棧:', error.stack);
      res.status(500).json({ 
        message: '生成月報失敗', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // 取得月報列表
  async getReports(req, res) {
    try {
      const { user_id, year, month } = req.query;
      const userId = req.user.id;

      const filters = {};
      if (user_id) filters.user_id = parseInt(user_id, 10);
      if (year) filters.year = parseInt(year, 10);
      if (month) filters.month = parseInt(month, 10);

      // 如果指定了 user_id，檢查權限
      if (filters.user_id) {
        const hasPermission = await this.checkAccessPermission(userId, filters.user_id);
        if (!hasPermission) {
          return res.status(403).json({ message: '無權限存取此月報記錄' });
        }
      } else {
        // 如果沒有指定 user_id，檢查用戶是否有權限查看所有報告
        // 允許：HR 成員、系統管理員、批核者（approver1、approver2、approver3）
        const hasPermission = await this.checkAccessPermission(userId);
        if (!hasPermission) {
          return res.status(403).json({ message: '無權限存取月報列表' });
        }
      }

      const reports = await MonthlyAttendanceReport.findAll(filters);
      res.json({ reports });
    } catch (error) {
      console.error('Get reports error:', error);
      res.status(500).json({ message: '取得月報列表失敗', error: error.message });
    }
  }

  // 取得單一月報
  async getReport(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const report = await MonthlyAttendanceReport.findById(id);
      
      if (!report) {
        return res.status(404).json({ message: '月報記錄不存在' });
      }

      // 檢查權限
      const hasPermission = await this.checkAccessPermission(userId, report.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限存取此月報記錄' });
      }

      res.json({ report });
    } catch (error) {
      console.error('Get report error:', error);
      res.status(500).json({ message: '取得月報失敗', error: error.message });
    }
  }

  // 更新月報
  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const report = await MonthlyAttendanceReport.findById(id);
      if (!report) {
        return res.status(404).json({ message: '月報記錄不存在' });
      }

      // 檢查權限
      const hasPermission = await this.checkAccessPermission(userId, report.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限修改此月報記錄' });
      }

      updateData.updated_by_id = userId;
      const updatedReport = await MonthlyAttendanceReport.update(id, updateData);

      res.json({
        message: '月報已更新',
        report: updatedReport
      });
    } catch (error) {
      console.error('Update report error:', error);
      res.status(500).json({ message: '更新月報失敗', error: error.message });
    }
  }

  // 刪除月報
  async deleteReport(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const report = await MonthlyAttendanceReport.findById(id);
      if (!report) {
        return res.status(404).json({ message: '月報記錄不存在' });
      }

      // 檢查權限
      const hasPermission = await this.checkAccessPermission(userId, report.user_id);
      if (!hasPermission) {
        return res.status(403).json({ message: '無權限刪除此月報記錄' });
      }

      await MonthlyAttendanceReport.delete(id);

      res.json({ message: '月報已刪除' });
    } catch (error) {
      console.error('Delete report error:', error);
      res.status(500).json({ message: '刪除月報失敗', error: error.message });
    }
  }
}

module.exports = new MonthlyAttendanceReportController();

