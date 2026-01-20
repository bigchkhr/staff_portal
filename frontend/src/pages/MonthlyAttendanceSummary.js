import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Card,
  Divider,
  useTheme,
  useMediaQuery,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Calculate as CalculateIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Event as EventIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

// 配置 dayjs 時區插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

const MonthlyAttendanceSummary = ({ noLayout = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().tz('Asia/Hong_Kong').year());
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().tz('Asia/Hong_Kong').month() + 1);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [calculateDialogOpen, setCalculateDialogOpen] = useState(false);
  const [calculatingDate, setCalculatingDate] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [clockRecordsCache, setClockRecordsCache] = useState(new Map()); // 緩存已獲取的打卡記錄

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedYear && selectedMonth) {
      fetchSummary();
    }
  }, [selectedUserId, selectedYear, selectedMonth]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按 employee_number 排序
      usersList.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || '獲取用戶列表失敗'
      });
    }
  };

  // 通過 employee_number 和日期獲取打卡記錄
  const fetchClockRecordsByEmployeeAndDate = async (employeeNumber, date) => {
    try {
      // 使用新的 user-clock-records API 獲取該天的打卡記錄
      const response = await axios.get('/api/attendances/user-clock-records', {
        params: {
          user_id: selectedUserId,
          start_date: date,
          end_date: date
        }
      });

      if (response.data && response.data.clock_records && response.data.clock_records[date]) {
        return response.data.clock_records[date] || [];
      }
      return [];
    } catch (error) {
      console.error(`Fetch clock records error for ${employeeNumber} on ${date}:`, error);
      return [];
    }
  };

  // 解析時間字符串（HH:mm 或 HH:mm:ss）並返回分鐘數（從當天00:00開始）
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    try {
      const timeOnly = timeStr.split(':').slice(0, 2).join(':');
      const [hours, minutes] = timeOnly.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return null;
      return hours * 60 + minutes;
    } catch (error) {
      return null;
    }
  };

  // 將分鐘數向下取整到指定間隔（例如 30 / 15）
  const floorMinutesToInterval = (minutes, interval) => {
    if (minutes === null || minutes === undefined) return null;
    const m = typeof minutes === 'string' ? Number(minutes) : minutes;
    if (Number.isNaN(m)) return null;
    if (!interval || interval <= 0) return Math.floor(m);
    return Math.floor(m / interval) * interval;
  };

  // 計算一天的考勤數據
  const calculateDailyAttendance = (attendanceItem, storesMap, employmentMode) => {
    const dateStr = attendanceItem.attendance_date;
    const schedule = attendanceItem.schedule || null;
    const clockRecords = attendanceItem.clock_records || [];
    
    // 獲取有效的打卡記錄（按時間排序）
    const validRecords = clockRecords
      .filter(r => {
        const isValid = r.is_valid === true || 
                      r.is_valid === 'true' || 
                      r.is_valid === 1 || 
                      r.is_valid === '1' ||
                      r.is_valid === 'True' ||
                      (typeof r.is_valid === 'string' && r.is_valid.toLowerCase() === 'true');
        return isValid && r.clock_time;
      })
      .sort((a, b) => {
        const timeA = a.clock_time || '';
        const timeB = b.clock_time || '';
        return timeA.localeCompare(timeB);
      });

    const result = {
      date: dateStr,
      late_minutes: null,
      break_duration: null,
      total_work_hours: null,
      overtime_hours: null,
      approved_overtime_minutes: null,
      early_leave: false,
      is_late: false,
      is_absent: false,
      store_short_name: null,
      schedule: schedule && (schedule.start_time || schedule.end_time || schedule.leave_type_name_zh) ? {
        id: schedule.id || null,
        store_id: schedule.store_id || null,
        start_time: schedule.start_time || null,
        end_time: schedule.end_time || null,
        leave_type_name_zh: schedule.leave_type_name_zh || null,
        leave_session: schedule.leave_session || null,
        is_approved_leave: schedule.is_approved_leave || false
      } : null,
      valid_clock_records: validRecords.map(record => ({
        id: record.id,
        employee_number: record.employee_number || null,
        name: record.name || null,
        branch_code: record.branch_code || null,
        attendance_date: record.attendance_date || null,
        clock_time: record.clock_time || null,
        in_out: record.in_out || null,
        is_valid: true,
        remarks: record.remarks || null
      })),
      attendance_data: {
        attendance_date: dateStr,
        clock_records: clockRecords,
        schedule: schedule
      }
    };

    // 根據第一個有效打卡記錄的 branch_code 查找 store_short_name
    if (validRecords.length > 0 && validRecords[0].branch_code) {
      const storeCode = String(validRecords[0].branch_code).trim();
      if (storeCode && storesMap && storesMap[storeCode]) {
        result.store_short_name = storesMap[storeCode];
        console.log(`[calculateDailyAttendance] Date ${dateStr}: Found store_short_name "${result.store_short_name}" for store_code "${storeCode}"`);
      } else if (storeCode) {
        console.warn(`[calculateDailyAttendance] Date ${dateStr}: No store found for store_code "${storeCode}"`);
      }
    }

    if (validRecords.length === 0) {
      // 沒有有效打卡記錄，判斷是否缺勤
      if (schedule && schedule.start_time) {
        result.is_absent = true;
      }
      return result;
    }

    // 獲取排班時間
    const scheduleStartTime = schedule?.start_time;
    const scheduleEndTime = schedule?.end_time;

    // 第一個有效記錄作為上班時間
    const clockInTime = validRecords[0]?.clock_time;
    // 最後一個有效記錄作為下班時間
    const clockOutTime = validRecords[validRecords.length - 1]?.clock_time;

    // 計算遲到
    if (scheduleStartTime && clockInTime) {
      const scheduleStart = parseTime(scheduleStartTime);
      const actualStart = parseTime(clockInTime);
      
      if (actualStart !== null && scheduleStart !== null && actualStart > scheduleStart) {
        const diffMinutes = actualStart - scheduleStart;
        result.late_minutes = diffMinutes;
        result.is_late = true;
      }
    }

    // 計算Break時間（第三個有效時間減去第二個有效時間）
    if (validRecords.length >= 3) {
      const secondTime = parseTime(validRecords[1]?.clock_time);
      const thirdTime = parseTime(validRecords[2]?.clock_time);
      
      if (secondTime !== null && thirdTime !== null) {
        const breakMinutes = thirdTime - secondTime;
        result.break_duration = breakMinutes;
      }
    }

    // 計算總工作時數
    if (clockInTime && clockOutTime) {
      const start = parseTime(clockInTime);
      const end = parseTime(clockOutTime);
      
      if (start !== null && end !== null) {
        let workMinutes = end - start;
        // 如果有Break時間，需要減去
        if (result.break_duration !== null) {
          workMinutes -= result.break_duration;
        }
        result.total_work_hours = workMinutes / 60;
      }
    }

    // 計算超時工作時間
    if (scheduleEndTime && clockOutTime) {
      const scheduleEnd = parseTime(scheduleEndTime);
      const actualEnd = parseTime(clockOutTime);
      
      if (scheduleEnd !== null && actualEnd !== null && actualEnd > scheduleEnd) {
        const overtimeMinutes = actualEnd - scheduleEnd;
        if (overtimeMinutes >= 15) {
          result.overtime_hours = overtimeMinutes / 60;

          // 應計工作時數：按 employment_mode 向下取整
          const mode = (employmentMode || '').toString().trim().toUpperCase();
          const interval = mode === 'PT' ? 15 : 30; // FT（或未知）預設 30 分鐘
          result.approved_overtime_minutes = floorMinutesToInterval(overtimeMinutes, interval);
        }
      }
    }

    // 計算早退
    if (scheduleEndTime && clockOutTime) {
      const scheduleEnd = parseTime(scheduleEndTime);
      const actualEnd = parseTime(clockOutTime);
      
      if (scheduleEnd !== null && actualEnd !== null && actualEnd < scheduleEnd) {
        result.early_leave = true;
      }
    }

    return result;
  };

  const fetchSummary = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    try {
      // 獲取該月的日期範圍
      const startDate = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const lastDay = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`).tz('Asia/Hong_Kong').endOf('month').date();
      const endDate = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`).tz('Asia/Hong_Kong').format('YYYY-MM-DD');

      // 先嘗試使用 /api/attendances/my-clock-records（如果查看的是當前用戶）
      // 這個 API 會返回包含 schedule 和 clock_records 的完整數據
      let attendanceData = [];
      
      if (Number(selectedUserId) === Number(user?.id)) {
        // 當前用戶，使用 my-clock-records API
        const myClockRecordsResponse = await axios.get('/api/attendances/my-clock-records', {
          params: {
            start_date: startDate,
            end_date: endDate
          }
        });
        attendanceData = myClockRecordsResponse.data.attendance || [];
      } else {
        // 其他用戶，需要獲取部門群組 ID，然後使用 comparison API
        // 獲取用戶的部門群組（通過嘗試所有可訪問的群組）
        const accessibleGroupsResponse = await axios.get('/api/attendances/accessible-groups');
        const accessibleGroups = accessibleGroupsResponse.data.groups || [];
        
        let foundData = false;
        for (const group of accessibleGroups) {
          try {
            const comparisonResponse = await axios.get('/api/attendances/comparison', {
              params: {
                department_group_id: group.id,
                start_date: startDate,
                end_date: endDate
              }
            });
            
            const comparisonData = comparisonResponse.data.comparison || [];
            const userData = comparisonData.find(item => 
              Number(item.user_id) === Number(selectedUserId)
            );
            
            if (userData) {
              // 轉換為與 my-clock-records 相同的格式
              const dateMap = new Map();
              const start = dayjs(startDate).tz('Asia/Hong_Kong');
              const end = dayjs(endDate).tz('Asia/Hong_Kong');
              let current = start;
              
              while (current.isBefore(end) || current.isSame(end, 'day')) {
                const dateStr = current.format('YYYY-MM-DD');
                const item = comparisonData.find(i => 
                  i.attendance_date === dateStr && 
                  Number(i.user_id) === Number(selectedUserId)
                );
                
                if (item) {
                  dateMap.set(dateStr, {
                    attendance_date: dateStr,
                    schedule: item.schedule || null,
                    clock_records: item.clock_records || []
                  });
                }
                current = current.add(1, 'day');
              }
              
              attendanceData = Array.from(dateMap.values());
              foundData = true;
              break;
            }
          } catch (error) {
            console.error(`Error fetching comparison for group ${group.id}:`, error);
            continue;
          }
        }
        
        if (!foundData) {
          // 如果找不到數據，生成空的月結表
          attendanceData = [];
        }
      }

      // attendanceData 已經是按日期組織的數據，包含 schedule 和 clock_records

      // 獲取所有店舖資料（用於查找 store_short_name）
      const storesResponse = await axios.get('/api/stores');
      const stores = storesResponse.data.stores || [];
      const storesMap = {};
      stores.forEach(store => {
        // 後端返回的字段是 store_short_name_（帶下劃線）
        const storeShortName = store.store_short_name_ || store.store_short_name;
        if (store.store_code && storeShortName) {
          storesMap[store.store_code] = storeShortName;
        }
      });
      
      console.log('Stores map built:', {
        totalStores: stores.length,
        mappedStores: Object.keys(storesMap).length,
        sampleEntries: Object.entries(storesMap).slice(0, 5)
      });

      // 生成該月的所有日期
      const dailyData = [];
      const start = dayjs(startDate).tz('Asia/Hong_Kong');
      const end = dayjs(endDate).tz('Asia/Hong_Kong');
      let current = start;

      const selectedUser = users.find(u => Number(u.id) === Number(selectedUserId));
      const employmentMode = selectedUser?.position_employment_mode || null;

      while (current.isBefore(end) || current.isSame(end, 'day')) {
        const dateStr = current.format('YYYY-MM-DD');
        const attendanceItem = attendanceData.find(item => item.attendance_date === dateStr);
        
        const dayData = calculateDailyAttendance(
          attendanceItem || { 
            attendance_date: dateStr, 
            clock_records: [],
            schedule: null
          },
          storesMap,
          employmentMode
        );
        
        dailyData.push(dayData);
        current = current.add(1, 'day');
      }

      // 構建 summary 對象
      const summaryData = {
        id: null,
        user_id: selectedUserId,
        year: selectedYear,
        month: selectedMonth,
        daily_data: dailyData,
        created_at: null,
        updated_at: null
      };

      setSummary(summaryData);
    } catch (error) {
      console.error('Fetch summary error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || '取得月結記錄失敗'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateDay = async (date) => {
    if (!selectedUserId) return;

    setCalculatingDate(date);
    setCalculateDialogOpen(true);

    try {
      // 獲取該日期的考勤數據（使用 UTC+8 時區）
      const dateStr = typeof date === 'string' 
        ? date 
        : dayjs(date).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const [year, month, day] = dateStr.split('-').map(Number);

      // 獲取該日期的考勤數據並計算
      const dayData = summary?.daily_data?.find(d => d.date === dateStr);
      const response = await axios.post('/api/monthly-attendance-summaries/calculate-day', {
        user_id: selectedUserId,
        date: dateStr,
        attendance_data: dayData?.attendance_data || {},
        schedule_data: dayData?.schedule || dayData?.attendance_data?.schedule || {}
      });

      // 更新該天的數據
      if (summary) {
        const dailyData = [...(summary.daily_data || [])];
        const index = dailyData.findIndex(d => d.date === dateStr);
        
        if (index >= 0) {
          dailyData[index] = response.data.daily_data;
        } else {
          dailyData.push(response.data.daily_data);
        }

        // 保存更新
        await axios.put(`/api/monthly-attendance-summaries/${summary.id}`, {
          daily_data: dailyData
        });

        await fetchSummary();
        Swal.fire({
          icon: 'success',
          title: t('attendance.success') || '成功',
          text: t('attendance.calculateComplete') || '計算完成'
        });
      }
    } catch (error) {
      console.error('Calculate day error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || t('attendance.calculateFailed') || '計算失敗'
      });
    } finally {
      setCalculateDialogOpen(false);
      setCalculatingDate(null);
    }
  };

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };

  // 將小時數（可為小數）轉換成 hh:mm 顯示
  const formatHoursAsTime = (hours) => {
    if (hours === null || hours === undefined) return '--';
    const num = typeof hours === 'string' ? Number(hours) : hours;
    if (Number.isNaN(num)) return '--';
    const minutes = Math.round(num * 60);
    return formatTime(minutes);
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '--';
    return typeof hours === 'string' ? hours : hours.toFixed(2);
  };

  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '--:--';
    // 如果是 HH:mm:ss 格式，只取前5個字符
    return timeStr.substring(0, 5);
  };

  const handleToggleRow = (date) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedRows(newExpanded);
  };

  const handleViewDetail = (day) => {
    setSelectedDayDetail(day);
    setDetailDialogOpen(true);
  };

  const handleExportPDF = async () => {
    if (!summary || !selectedUserId) {
      Swal.fire({
        icon: 'warning',
        title: t('attendance.error') || '錯誤',
        text: t('attendance.noMonthlySummary') || '沒有月結記錄'
      });
      return;
    }

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      const userName = selectedUser 
        ? `${selectedUser.employee_number} - ${selectedUser.display_name || selectedUser.name_zh || selectedUser.name || ''}`
        : '';

      // 創建 PDF - 改為縱向（portrait）
      const doc = new jsPDF('portrait', 'mm', 'a4');
      
      // 使用默認字體（helvetica）避免字體相關錯誤
      // 注意：jsPDF 默認字體不支持中文，所以我們使用英文標籤
      // 如果需要支持中文，需要正確加載和註冊中文字體文件
      doc.setFont('helvetica', 'normal');
      
      // 標題 - 使用英文避免字體問題
      doc.setFontSize(18);
      doc.text('Monthly Attendance Summary', 14, 15);
      
      // 員工信息 - 使用英文避免字體問題，包含 display_name
      doc.setFontSize(12);
      const employeeDisplayName = selectedUser?.display_name || selectedUser?.name_zh || selectedUser?.name || '';
      doc.text(`Employee: ${selectedUser?.employee_number || ''} - ${employeeDisplayName}`, 14, 22);
      doc.text(`Year: ${selectedYear}`, 14, 28);
      doc.text(`Month: ${selectedMonth}`, 14, 34);

    // 準備表格數據 - 使用英文避免字體問題
    // 注意：PDF 使用英文，避免中文顯示成亂碼（jsPDF 預設字體不支援中文）
    const tableData = dailyData.map(day => {
      const schedule = day.schedule || day.attendance_data?.schedule || null;
      const rosterText = (schedule?.start_time || schedule?.end_time)
        ? `${schedule?.start_time ? formatTimeDisplay(schedule.start_time) : '--:--'} - ${schedule?.end_time ? formatTimeDisplay(schedule.end_time) : '--:--'}`
        : (schedule?.leave_type_name_zh ? 'LEAVE' : '--');

      const storeText = day.store_short_name || '--';

      const validRecords = Array.isArray(day.valid_clock_records) ? day.valid_clock_records : [];
      const clockTimesText = validRecords.length > 0
        ? validRecords
            .filter(r => r?.clock_time)
            .map(r => formatTimeDisplay(r.clock_time))
            .join(' | ')
        : '--';

      return [
        day.date || '--',
        rosterText,
        storeText,
        clockTimesText,
        day.late_minutes !== null ? formatTime(day.late_minutes) : '--',
        day.break_duration !== null ? formatTime(day.break_duration) : '--',
        formatHoursAsTime(day.total_work_hours),
        formatHoursAsTime(day.overtime_hours),
        day.approved_overtime_minutes !== null ? formatTime(day.approved_overtime_minutes) : '--'
      ];
    });

    // 計算總計
    const totals = dailyData.reduce((acc, day) => {
      acc.late_minutes += day.late_minutes || 0;
      acc.break_duration += day.break_duration || 0;
      acc.total_work_hours += day.total_work_hours || 0;
      acc.overtime_hours += day.overtime_hours || 0;
      acc.approved_overtime_minutes += day.approved_overtime_minutes || 0;
      return acc;
    }, {
      late_minutes: 0,
      break_duration: 0,
      total_work_hours: 0,
      overtime_hours: 0,
      approved_overtime_minutes: 0
    });

    // 準備總計行
    const totalRow = [
      'Total',
      '--',
      '--',
      '--',
      totals.late_minutes > 0 ? formatTime(totals.late_minutes) : '--',
      totals.break_duration > 0 ? formatTime(totals.break_duration) : '--',
      formatHoursAsTime(totals.total_work_hours),
      formatHoursAsTime(totals.overtime_hours),
      totals.approved_overtime_minutes > 0 ? formatTime(totals.approved_overtime_minutes) : '--'
    ];

    // 表格標題 - 使用英文避免字體問題（需與頁面 table 欄位一致）
    const tableHeaders = [
      'Date',
      'Roster',
      'Store',
      'Clock Times',
      'Late',
      'Break',
      'Work',
      'Overtime',
      'Approved OT'
    ];

    // 確保有數據才生成表格
    if (tableData.length === 0) {
      doc.text('No data available', 14, 50);
    } else {
      // 添加表格 - 不設置自定義字體，使用默認字體
      // 縱向模式下需要調整列寬，總寬度約為 180mm（A4 縱向寬度減去邊距）
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        foot: [totalRow],
        startY: 40,
        styles: { 
          fontSize: 7,
          overflow: 'linebreak',
          cellPadding: 1.5
        },
        headStyles: { 
          fillColor: [25, 118, 210], 
          textColor: 255, 
          fontStyle: 'bold',
          overflow: 'linebreak',
          fontSize: 7
        },
        footStyles: {
          fillColor: [200, 200, 200],
          textColor: 0,
          fontStyle: 'bold',
          fontSize: 7
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 40, left: 14, right: 14 },
        columnStyles: {
          0: { cellWidth: 18 }, // Date
          1: { cellWidth: 22 }, // Roster
          2: { cellWidth: 20 }, // Store
          3: { cellWidth: 40 }, // Clock Times
          4: { cellWidth: 15 }, // Late
          5: { cellWidth: 15 }, // Break
          6: { cellWidth: 18 }, // Work
          7: { cellWidth: 18 },  // Overtime
          8: { cellWidth: 20 }  // Approved OT
        }
      });
    }

    // 生成文件名 - 使用英文避免文件名問題
    const fileName = `MonthlySummary_${selectedUser?.employee_number || 'User'}_${selectedYear}_${selectedMonth}.pdf`;
    
    // 保存 PDF
    doc.save(fileName);
    
    Swal.fire({
      icon: 'success',
      title: t('attendance.success') || '成功',
      text: t('attendance.exportPDFSuccess') || 'PDF 導出成功'
    });
    } catch (error) {
      console.error('Export PDF error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.message || t('attendance.exportPDFFailed') || 'PDF 導出失敗'
      });
    }
  };

  const dailyData = summary?.daily_data || [];

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={noLayout ? { mt: 0, mb: 0 } : { mt: 4, mb: 4 }}>
        <Paper 
          elevation={3}
          sx={{ 
            p: 4,
            borderRadius: 3,
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography 
              variant="h4" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
              }}
            >
              {t('attendance.monthlySummary') || '月結表'}
            </Typography>
            {summary && selectedUserId && (
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleExportPDF}
                color="primary"
                sx={{ mb: 1 }}
              >
                {t('attendance.exportPDF') || '導出 PDF'}
              </Button>
            )}
            <Divider sx={{ width: '100%', mt: 1 }} />
          </Box>

          <Card 
            elevation={2}
            sx={{ 
              mb: 3, 
              p: 3,
              borderRadius: 2,
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={users}
                  getOptionLabel={(option) => 
                    `${option.employee_number || ''} - ${option.display_name || option.name_zh || option.name || ''}`
                  }
                  value={users.find(u => u.id === selectedUserId) || null}
                  onChange={(event, newValue) => {
                    setSelectedUserId(newValue ? newValue.id : null);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('attendance.selectEmployee') || '選擇員工'}
                      placeholder={t('attendance.selectEmployee') || '選擇員工'}
                    />
                  )}
                  filterOptions={(options, { inputValue }) => {
                    if (!inputValue) return options;
                    const searchLower = inputValue.toLowerCase();
                    return options.filter((u) => {
                      const employeeNumber = (u.employee_number || '').toLowerCase();
                      const displayName = (u.display_name || '').toLowerCase();
                      const nameZh = (u.name_zh || '').toLowerCase();
                      const name = (u.name || '').toLowerCase();
                      const givenName = (u.given_name || '').toLowerCase();
                      const surname = (u.surname || '').toLowerCase();
                      const alias = (u.alias || '').toLowerCase();
                      
                      return (
                        employeeNumber.includes(searchLower) ||
                        displayName.includes(searchLower) ||
                        nameZh.includes(searchLower) ||
                        name.includes(searchLower) ||
                        givenName.includes(searchLower) ||
                        surname.includes(searchLower) ||
                        alias.includes(searchLower) ||
                        `${surname} ${givenName}`.trim().includes(searchLower) ||
                        `${givenName} ${surname}`.trim().includes(searchLower)
                      );
                    });
                  }}
                  noOptionsText={t('attendance.noUsersFound') || '找不到員工'}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label={t('attendance.year') || '年份'}
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('attendance.month') || '月份'}</InputLabel>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    label={t('attendance.month') || '月份'}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <MenuItem key={m} value={m}>
                        {m} {t('attendance.month') || '月'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            {/* 統計信息 */}
            {summary && dailyData.length > 0 && (
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      {t('attendance.approvedOvertimeHours') || '應計工作時數'}：
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1565C0' }}>
                      {(() => {
                        const totalMinutes = dailyData.reduce((sum, day) => {
                          return sum + (day.approved_overtime_minutes || 0);
                        }, 0);
                        return formatTime(totalMinutes);
                      })()}
                    </Typography>
                  </Grid>
                  {(() => {
                    const totalLate = dailyData.reduce((sum, day) => {
                      return sum + (day.late_minutes || 0);
                    }, 0);
                    // 只有總遲到 >= 10 分鐘時才顯示
                    if (totalLate < 10) return null;
                    return (
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="text.secondary">
                          {t('attendance.totalLateMinutes') || '總遲到分鐘數'}：
                        </Typography>
                        <Typography 
                          variant="h6" 
                          sx={{ 
                            fontWeight: 600,
                            color: 'error.main'
                          }}
                        >
                          {totalLate} {t('attendance.minutes') || '分鐘'}
                        </Typography>
                      </Grid>
                    );
                  })()}
                </Grid>
              </Box>
            )}
          </Card>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading') || '載入中...'}
              </Typography>
            </Box>
          ) : summary ? (
            <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.date') || '日期'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.roster') || '排班'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.store') || '分店'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.attendanceStatus') || '考勤情況'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.lateMinutes') || '遲到(分鐘)'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.breakDuration') || 'Break時間(分鐘)'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.totalWorkHours') || '全日上班總時數'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.overtimeHours') || '超時工作時間'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.approvedOvertimeHours') || '應計工作時數'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.details') || '詳情'}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyData.map((day, index) => {
                      const isExpanded = expandedRows.has(day.date);
                      // 優先從 day.schedule 讀取，如果沒有則從 attendance_data.schedule 讀取
                      const schedule = day.schedule || day.attendance_data?.schedule || null;
                      
                      // 獲取有效的打卡記錄：確保所有有效的打卡時間都被 map 出來
                      let validRecords = [];
                      
                      // 方法1: 優先從 valid_clock_records 讀取（後端已過濾好的）
                      if (day.valid_clock_records && Array.isArray(day.valid_clock_records) && day.valid_clock_records.length > 0) {
                        validRecords = day.valid_clock_records;
                      }
                      
                      // 方法2: 如果 valid_clock_records 為空，從 attendance_data.clock_records 中過濾所有有效的記錄
                      if (validRecords.length === 0 && day.attendance_data?.clock_records && Array.isArray(day.attendance_data.clock_records)) {
                        validRecords = day.attendance_data.clock_records
                          .filter(r => {
                            // 支援多種 is_valid 格式，確保所有有效記錄都被識別
                            const isValid = r.is_valid === true || 
                                          r.is_valid === 'true' || 
                                          r.is_valid === 1 || 
                                          r.is_valid === '1' ||
                                          r.is_valid === 'True' ||
                                          (typeof r.is_valid === 'string' && r.is_valid.toLowerCase() === 'true');
                            return isValid && r.clock_time; // 確保有打卡時間
                          })
                          .sort((a, b) => {
                            const timeA = a.clock_time || '';
                            const timeB = b.clock_time || '';
                            return timeA.localeCompare(timeB);
                          });
                      }
                      
                      // 方法3: 如果還是沒有記錄，或者 attendance_data 中沒有 clock_records，嘗試從緩存或 API 獲取
                      const hasClockRecordsInData = day.attendance_data?.clock_records && Array.isArray(day.attendance_data.clock_records) && day.attendance_data.clock_records.length > 0;
                      if ((validRecords.length === 0 || !hasClockRecordsInData) && day.date) {
                        const selectedUser = users.find(u => u.id === selectedUserId);
                        const employeeNumber = selectedUser?.employee_number;
                        
                        if (employeeNumber) {
                          const cacheKey = `${employeeNumber}-${day.date}`;
                          const cachedRecords = clockRecordsCache.get(cacheKey);
                          
                          if (cachedRecords && cachedRecords.length > 0) {
                            // 使用緩存的記錄
                            validRecords = cachedRecords;
                            // 同時更新 summary 中的數據
                            if (summary && !hasClockRecordsInData) {
                              const updatedDailyData = [...(summary.daily_data || [])];
                              const dayIndex = updatedDailyData.findIndex(d => d.date === day.date);
                              if (dayIndex >= 0) {
                                if (!updatedDailyData[dayIndex].attendance_data) {
                                  updatedDailyData[dayIndex].attendance_data = {};
                                }
                                // 從緩存中獲取所有記錄（不僅僅是有效的）
                                const allCachedRecords = clockRecordsCache.get(`${employeeNumber}-${day.date}-all`);
                                updatedDailyData[dayIndex].attendance_data.clock_records = allCachedRecords || cachedRecords;
                                updatedDailyData[dayIndex].valid_clock_records = cachedRecords;
                                setSummary({ ...summary, daily_data: updatedDailyData });
                              }
                            }
                          } else {
                            // 異步獲取打卡記錄（不阻塞渲染）
                            fetchClockRecordsByEmployeeAndDate(employeeNumber, day.date).then(clockRecords => {
                              if (clockRecords && clockRecords.length > 0) {
                                const valid = clockRecords
                                  .filter(r => {
                                    const isValid = r.is_valid === true || 
                                                  r.is_valid === 'true' || 
                                                  r.is_valid === 1 || 
                                                  r.is_valid === '1' ||
                                                  r.is_valid === 'True' ||
                                                  (typeof r.is_valid === 'string' && r.is_valid.toLowerCase() === 'true');
                                    return isValid && r.clock_time;
                                  })
                                  .sort((a, b) => {
                                    const timeA = a.clock_time || '';
                                    const timeB = b.clock_time || '';
                                    return timeA.localeCompare(timeB);
                                  });
                                
                                // 更新緩存（保存所有記錄和有效記錄）
                                const newCache = new Map(clockRecordsCache);
                                newCache.set(cacheKey, valid);
                                newCache.set(`${employeeNumber}-${day.date}-all`, clockRecords);
                                setClockRecordsCache(newCache);
                                
                                // 更新 summary 中的數據
                                if (summary) {
                                  const updatedDailyData = [...(summary.daily_data || [])];
                                  const dayIndex = updatedDailyData.findIndex(d => d.date === day.date);
                                  if (dayIndex >= 0) {
                                    if (!updatedDailyData[dayIndex].attendance_data) {
                                      updatedDailyData[dayIndex].attendance_data = {};
                                    }
                                    updatedDailyData[dayIndex].attendance_data.clock_records = clockRecords;
                                    updatedDailyData[dayIndex].valid_clock_records = valid;
                                    setSummary({ ...summary, daily_data: updatedDailyData });
                                  }
                                }
                              }
                            }).catch(err => {
                              console.error(`Error fetching clock records for ${employeeNumber} on ${day.date}:`, err);
                            });
                          }
                        }
                      }
                      
                      // 調試日誌（只對有記錄的日期）
                      if (validRecords.length > 0) {
                        console.log(`[MonthlyAttendanceSummary] Day ${day.date} - 將要顯示的有效打卡記錄:`, {
                          date: day.date,
                          validRecordsCount: validRecords.length,
                          validRecords: validRecords.map((r, idx) => ({
                            index: idx + 1,
                            id: r.id,
                            clock_time: r.clock_time,
                            in_out: r.in_out,
                            is_valid: r.is_valid,
                            branch_code: r.branch_code
                          }))
                        });
                      }
                      
                      return (
                        <React.Fragment key={day.date || index}>
                          <TableRow>
                            <TableCell>{day.date}</TableCell>
                            <TableCell>
                              {schedule ? (
                                <Box>
                                  {schedule.leave_type_name_zh ? (
                                    <Box sx={{ mb: 0.5 }}>
                                      <Chip
                                        icon={schedule.is_approved_leave ? <CheckCircleIcon /> : <EventIcon />}
                                        label={
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                              {schedule.leave_type_name_zh}
                                            </Typography>
                                            {schedule.leave_session && (
                                              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                                ({schedule.leave_session})
                                              </Typography>
                                            )}
                                          </Box>
                                        }
                                        size="small"
                                        color={schedule.is_approved_leave ? 'success' : 'warning'}
                                        sx={{ 
                                          display: 'inline-flex',
                                          fontWeight: 600,
                                          boxShadow: schedule.is_approved_leave 
                                            ? '0 2px 4px rgba(76, 175, 80, 0.3)' 
                                            : '0 2px 4px rgba(237, 108, 2, 0.3)',
                                          '& .MuiChip-icon': {
                                            fontSize: '1rem'
                                          }
                                        }}
                                      />
                                    </Box>
                                  ) : null}
                                  {(schedule.start_time || schedule.end_time) ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: schedule.leave_type_name_zh ? 0.5 : 0 }}>
                                      <ScheduleIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                                      <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                        {schedule.start_time ? formatTimeDisplay(schedule.start_time) : '--:--'} - {schedule.end_time ? formatTimeDisplay(schedule.end_time) : '--:--'}
                                      </Typography>
                                    </Box>
                                  ) : schedule.leave_type_name_zh ? null : (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {t('attendance.noScheduleTime') || '無排班時間'}
                                    </Typography>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">--</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {day.store_short_name ? (
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {day.store_short_name}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.secondary">--</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box>
                                {validRecords.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                    {/* 顯示所有有效的打卡時間 - 同一行顯示（不顯示 in/out、branch_code/store_code） */}
                                    {validRecords.map((record, idx) => {
                                      // 確保每條記錄都有打卡時間
                                      if (!record.clock_time) {
                                        console.warn(`[MonthlyAttendanceSummary] Record at index ${idx} missing clock_time:`, record);
                                        return null;
                                      }
                                      return (
                                        <Typography
                                          key={record.id || `record-${idx}`}
                                          variant="body2"
                                          sx={{
                                            fontSize: '0.875rem',
                                            fontWeight: 700,
                                            color: 'primary.main',
                                            fontFamily: 'monospace',
                                            letterSpacing: '0.5px',
                                            display: 'inline-block'
                                          }}
                                        >
                                          {formatTimeDisplay(record.clock_time)}
                                          {idx < validRecords.length - 1 && (
                                            <span style={{ margin: '0 4px', color: '#999' }}>|</span>
                                          )}
                                        </Typography>
                                      );
                                    })}
                                  </Box>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('attendance.noRecords') || '無記錄'}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {day.late_minutes !== null ? (
                                <Typography
                                  sx={{
                                    fontWeight: 700,
                                    color: 'error.main',
                                    display: 'inline-block'
                                  }}
                                >
                                  {formatTime(day.late_minutes)}
                                </Typography>
                              ) : (
                                '--'
                              )}
                            </TableCell>
                            <TableCell>{day.break_duration !== null ? formatTime(day.break_duration) : '--'}</TableCell>
                            <TableCell>{formatHoursAsTime(day.total_work_hours)}</TableCell>
                            <TableCell>{formatHoursAsTime(day.overtime_hours)}</TableCell>
                            <TableCell>
                              {day.approved_overtime_minutes !== null ? (
                                <Typography
                                  sx={{
                                    fontWeight: 700,
                                    color: '#1565C0', // 深藍色
                                    display: 'inline-block'
                                  }}
                                >
                                  {formatTime(day.approved_overtime_minutes)}
                                </Typography>
                              ) : (
                                '--'
                              )}
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetail(day)}
                                color="primary"
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                          {isExpanded && validRecords.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={8} sx={{ bgcolor: 'grey.50', py: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                                  {t('attendance.validClockRecords') || '有效打卡記錄'}:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  {validRecords.map((record, idx) => (
                                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: '0.875rem' }}>
                                      <Typography variant="body2">
                                        {formatTimeDisplay(record.clock_time)} ({record.in_out || '--'})
                                      </Typography>
                                      {record.branch_code && (
                                        <Typography variant="caption" color="text.secondary">
                                          [{record.branch_code}]
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                    
                    {/* 總計行 */}
                    {dailyData.length > 0 && (() => {
                      const totals = dailyData.reduce((acc, day) => {
                        acc.late_minutes += day.late_minutes || 0;
                        acc.break_duration += day.break_duration || 0;
                        acc.total_work_hours += day.total_work_hours || 0;
                        acc.overtime_hours += day.overtime_hours || 0;
                        acc.approved_overtime_minutes += day.approved_overtime_minutes || 0;
                        return acc;
                      }, {
                        late_minutes: 0,
                        break_duration: 0,
                        total_work_hours: 0,
                        overtime_hours: 0,
                        approved_overtime_minutes: 0
                      });

                      return (
                        <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 600 }}>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('common.total') || '總計'}
                          </TableCell>
                          <TableCell>--</TableCell>
                          <TableCell>--</TableCell>
                          <TableCell>--</TableCell>
                          <TableCell>
                            {totals.late_minutes > 0 ? (
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  color: 'error.main',
                                  display: 'inline-block'
                                }}
                              >
                                {formatTime(totals.late_minutes)}
                              </Typography>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell>
                            {totals.break_duration > 0 ? formatTime(totals.break_duration) : '--'}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {formatHoursAsTime(totals.total_work_hours)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {formatHoursAsTime(totals.overtime_hours)}
                          </TableCell>
                          <TableCell>
                            {totals.approved_overtime_minutes > 0 ? (
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  color: '#1565C0',
                                  display: 'inline-block'
                                }}
                              >
                                {formatTime(totals.approved_overtime_minutes)}
                              </Typography>
                            ) : (
                              '--'
                            )}
                          </TableCell>
                          <TableCell>--</TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : (
            <Card 
              elevation={2}
              sx={{ 
                textAlign: 'center', 
                py: 6,
                borderRadius: 2,
                bgcolor: 'grey.50',
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t('attendance.noMonthlySummary') || '沒有月結記錄'}
              </Typography>
            </Card>
          )}

          {/* 詳情對話框 */}
          <Dialog
            open={detailDialogOpen}
            onClose={() => {
              setDetailDialogOpen(false);
              setSelectedDayDetail(null);
            }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {t('attendance.details') || '詳情'} - {selectedDayDetail?.date}
            </DialogTitle>
            <DialogContent>
              {selectedDayDetail && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                  {/* 排班資料 */}
                  {(selectedDayDetail.schedule || selectedDayDetail.attendance_data?.schedule) && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        {t('attendance.roster') || '排班資料'}
                      </Typography>
                      {(() => {
                        const schedule = selectedDayDetail.schedule || selectedDayDetail.attendance_data?.schedule;
                        return (
                          <Grid container spacing={2}>
                            {schedule.start_time && (
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                  {t('attendance.startTime') || '開始時間'}:
                                </Typography>
                                <Typography variant="body1">
                                  {formatTimeDisplay(schedule.start_time)}
                                </Typography>
                              </Grid>
                            )}
                            {schedule.end_time && (
                              <Grid item xs={6}>
                                <Typography variant="body2" color="text.secondary">
                                  {t('attendance.endTime') || '結束時間'}:
                                </Typography>
                                <Typography variant="body1">
                                  {formatTimeDisplay(schedule.end_time)}
                                </Typography>
                              </Grid>
                            )}
                            {schedule.leave_type_name_zh && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                  {t('attendance.leaveType') || '假期類型'}:
                                </Typography>
                                <Chip
                                  icon={schedule.is_approved_leave ? <CheckCircleIcon /> : <EventIcon />}
                                  label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        {schedule.leave_type_name_zh}
                                      </Typography>
                                      {schedule.leave_session && (
                                        <Typography variant="caption" sx={{ opacity: 0.8 }}>
                                          ({schedule.leave_session})
                                        </Typography>
                                      )}
                                    </Box>
                                  }
                                  color={schedule.is_approved_leave ? 'success' : 'warning'}
                                  size="medium"
                                  sx={{ 
                                    fontWeight: 600,
                                    boxShadow: schedule.is_approved_leave 
                                      ? '0 2px 6px rgba(76, 175, 80, 0.3)' 
                                      : '0 2px 6px rgba(237, 108, 2, 0.3)',
                                    '& .MuiChip-icon': {
                                      fontSize: '1.1rem'
                                    }
                                  }}
                                />
                              </Grid>
                            )}
                            {!schedule.start_time && !schedule.end_time && !schedule.leave_type_name_zh && (
                              <Grid item xs={12}>
                                <Typography variant="body2" color="text.secondary">
                                  {t('attendance.noSchedule') || '無排班資料'}
                                </Typography>
                              </Grid>
                            )}
                          </Grid>
                        );
                      })()}
                    </Box>
                  )}

                  {/* 所有打卡記錄 */}
                  {selectedDayDetail.attendance_data?.clock_records && selectedDayDetail.attendance_data.clock_records.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        {t('attendance.allClockRecords') || '所有打卡記錄'} ({selectedDayDetail.attendance_data.clock_records.length})
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>{t('attendance.clockTime') || '打卡時間'}</TableCell>
                              <TableCell>{t('attendance.inOut') || '進出'}</TableCell>
                              <TableCell>{t('attendance.branchCode') || '分行代碼'}</TableCell>
                              <TableCell>{t('attendance.isValid') || '有效'}</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedDayDetail.attendance_data.clock_records.map((record, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{formatTimeDisplay(record.clock_time)}</TableCell>
                                <TableCell>{record.in_out || '--'}</TableCell>
                                <TableCell>{record.branch_code || '--'}</TableCell>
                                <TableCell>
                                  {record.is_valid ? (
                                    <Chip label={t('common.yes') || '是'} size="small" color="success" />
                                  ) : (
                                    <Chip label={t('common.no') || '否'} size="small" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setDetailDialogOpen(false);
                setSelectedDayDetail(null);
              }}>
                {t('common.close') || '關閉'}
              </Button>
            </DialogActions>
          </Dialog>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default MonthlyAttendanceSummary;
