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
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  FormControlLabel
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

// 配置 dayjs 時區插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 設置默認時區為香港（UTC+8）
dayjs.tz.setDefault('Asia/Hong_Kong');

const Schedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').add(6, 'day'));
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [batchMorningLeave, setBatchMorningLeave] = useState(false);
  const [batchAfternoonLeave, setBatchAfternoonLeave] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editStartTime, setEditStartTime] = useState(null);
  const [editEndTime, setEditEndTime] = useState(null);
  const [editEndHour, setEditEndHour] = useState(null);
  const [editEndMinute, setEditEndMinute] = useState(null);
  const [editLeaveTypeId, setEditLeaveTypeId] = useState('');
  const [editIsMorningLeave, setEditIsMorningLeave] = useState(false);
  const [editIsAfternoonLeave, setEditIsAfternoonLeave] = useState(false);

  useEffect(() => {
    fetchDepartmentGroups();
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers();
      fetchSchedules();
      checkEditPermission();
    }
  }, [selectedGroupId, startDate, endDate]);

  const fetchDepartmentGroups = async () => {
    try {
      const response = await axios.get('/api/groups/department?closed=false');
      setDepartmentGroups(response.data.groups || []);
      
      // 如果用戶只屬於一個群組，自動選擇
      if (response.data.groups && response.data.groups.length === 1) {
        setSelectedGroupId(response.data.groups[0].id);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: t('schedule.fetchGroupsFailed')
      });
    }
  };

  const fetchGroupMembers = async () => {
    if (!selectedGroupId) return;
    
    try {
      const response = await axios.get(`/api/groups/department/${selectedGroupId}/members`);
      const members = response.data.members || [];
      members.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setGroupMembers(members);
    } catch (error) {
      console.error('Fetch group members error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.fetchGroupsFailed')
      });
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchSchedules = async () => {
    if (!selectedGroupId) return;
    
    setLoading(true);
    try {
      // 確保日期有效並使用香港時區格式化
      let startDateStr, endDateStr;
      try {
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        if (!start.isValid() || !end.isValid()) {
          throw new Error('Invalid date range');
        }
        startDateStr = start.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
        endDateStr = end.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      } catch (error) {
        console.error('Error formatting dates for API:', error);
        throw error;
      }
      
      const response = await axios.get('/api/schedules', {
        params: {
          department_group_id: selectedGroupId,
          start_date: startDateStr,
          end_date: endDateStr
        }
      });
      const schedulesData = response.data.schedules || [];
      console.log('Fetched schedules:', schedulesData);
      console.log('Schedule dates:', schedulesData.map(s => ({ 
        id: s.id, 
        user_id: s.user_id, 
        schedule_date: s.schedule_date, 
        type: typeof s.schedule_date,
        isDate: s.schedule_date instanceof Date
      })));
      console.log('Date range:', { 
        start: startDate.format('YYYY-MM-DD'), 
        end: endDate.format('YYYY-MM-DD') 
      });
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Fetch schedules error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || t('schedule.fetchSchedulesFailed');
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEditPermission = async () => {
    // 檢查用戶是否為批核成員
    try {
      const group = departmentGroups.find(g => g.id === selectedGroupId);
      if (!group) {
        setCanEdit(false);
        return;
      }

      // 檢查用戶是否為系統管理員
      if (user.is_system_admin) {
        setCanEdit(true);
        return;
      }

      // 檢查用戶是否為批核成員（checker, approver_1, approver_2, approver_3）
      const userDelegationGroups = user.delegation_groups || [];
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
      const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
      const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
      const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

      setCanEdit(isChecker || isApprover1 || isApprover2 || isApprover3);
    } catch (error) {
      console.error('Check edit permission error:', error);
      setCanEdit(false);
    }
  };

  const getScheduleForUserAndDate = (userId, date) => {
    // 如果 date 為 null 或 undefined，返回 null
    if (!date) {
      return null;
    }
    
    // 使用香港時區格式化日期，確保日期有效
    let dateStr;
    try {
      // 如果 date 已經是 dayjs 對象，直接使用其日期部分（不受時區影響）
      if (dayjs.isDayjs(date)) {
        // 已經是 dayjs 對象，直接獲取日期字符串（YYYY-MM-DD），不進行時區轉換
        // 這樣可以避免時區轉換導致的日期偏移
        dateStr = date.format('YYYY-MM-DD');
      } else {
        // 需要解析，先解析為本地時間，然後轉換為香港時區
        let dateObj = dayjs(date);
        if (!dateObj.isValid()) {
          console.warn('Invalid date in getScheduleForUserAndDate:', date);
          return null;
        }
        // 如果是字符串日期（YYYY-MM-DD），直接使用；否則轉換時區
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          dateStr = date;
        } else {
          dateObj = dateObj.tz('Asia/Hong_Kong');
          dateStr = dateObj.format('YYYY-MM-DD');
        }
      }
    } catch (error) {
      console.error('Error formatting date in getScheduleForUserAndDate:', error, date);
      return null;
    }
    // 確保 user_id 類型一致（都轉為數字）
    const userIdNum = Number(userId);
    const found = schedules.find(s => {
      const sUserId = Number(s.user_id);
      // 處理 schedule_date 可能是 Date 對象或字符串的情況
      let sDateStr = s.schedule_date;
      
      // 如果為 null 或 undefined，跳過
      if (!sDateStr) {
        return false;
      }
      
      try {
        // 處理 Date 對象或字符串，統一轉換為日期字符串（YYYY-MM-DD）
        if (sDateStr instanceof Date) {
          // Date 對象，使用本地日期部分（避免時區轉換導致的日期偏移）
          // 因為數據庫存儲的是純日期，不應該進行時區轉換
          const year = sDateStr.getFullYear();
          const month = String(sDateStr.getMonth() + 1).padStart(2, '0');
          const day = String(sDateStr.getDate()).padStart(2, '0');
          sDateStr = `${year}-${month}-${day}`;
        } else if (typeof sDateStr === 'string') {
          // 字符串格式
          if (sDateStr.includes('T') && sDateStr.includes('Z')) {
            // UTC 時間字符串，需要轉換為香港時區
            const parsed = dayjs.utc(sDateStr);
            if (!parsed.isValid()) {
              return false;
            }
            sDateStr = parsed.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
          } else if (sDateStr.includes('T')) {
            // 有時區信息的時間字符串，需要轉換
            const parsed = dayjs(sDateStr);
            if (!parsed.isValid()) {
              return false;
            }
            sDateStr = parsed.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
          } else {
            // 純日期字符串（YYYY-MM-DD），直接使用，不進行時區轉換
            // 因為數據庫存儲的是純日期，不應該進行時區轉換
            sDateStr = sDateStr.split('T')[0].substring(0, 10);
          }
        } else {
          // 嘗試用 dayjs 解析其他格式
          const parsed = dayjs(sDateStr);
          if (parsed.isValid()) {
            // 如果是純日期格式，直接格式化；否則轉換時區
            if (typeof sDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sDateStr)) {
              sDateStr = sDateStr;
            } else {
              sDateStr = parsed.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
            }
          } else {
            return false;
          }
        }
      } catch (error) {
        console.error('Error parsing schedule date:', error, sDateStr);
        return false;
      }
      
      const matches = sUserId === userIdNum && sDateStr === dateStr;
      if (matches) {
        console.log('Found schedule match:', { 
          userId, 
          sUserId, 
          dateStr, 
          sDateStr, 
          schedule: s 
        });
      }
      return matches;
    });
    return found;
  };

  const handleOpenEditDialog = (userId, date) => {
    if (!editMode || !canEdit) return;
    
    // 確保日期有效
    if (!date) {
      console.warn('Invalid date in handleOpenEditDialog');
      return;
    }

    // 使用香港時區格式化日期
    // 如果 date 已經是 dayjs 對象，直接使用其日期部分（不受時區影響）
    let dateStr;
    try {
      if (dayjs.isDayjs(date)) {
        // 已經是 dayjs 對象，直接獲取日期字符串（YYYY-MM-DD），不進行時區轉換
        // 這樣可以避免時區轉換導致的日期偏移
        dateStr = date.format('YYYY-MM-DD');
      } else {
        // 需要解析
        let dateObj = dayjs(date);
        if (!dateObj.isValid()) {
          console.warn('Invalid date in handleOpenEditDialog:', date);
          return;
        }
        // 如果是字符串日期（YYYY-MM-DD），直接使用；否則轉換時區
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          dateStr = date;
        } else {
          dateObj = dateObj.tz('Asia/Hong_Kong');
          dateStr = dateObj.format('YYYY-MM-DD');
        }
      }
      console.log('Opening edit dialog for date:', { original: date, formatted: dateStr, isDayjs: dayjs.isDayjs(date) });
    } catch (error) {
      console.error('Error formatting date in handleOpenEditDialog:', error, date);
      return;
    }
    
    const existingSchedule = getScheduleForUserAndDate(userId, date);

    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      setEditStartTime(existingSchedule.start_time ? dayjs(existingSchedule.start_time, 'HH:mm:ss') : null);
      
      // 處理結束時間，支援26:00格式
      if (existingSchedule.end_time) {
        const endTimeStr = existingSchedule.end_time;
        // 解析時間字符串
        const timeMatch = endTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          setEditEndHour(hours);
          setEditEndMinute(minutes);
          // 轉換為dayjs對象用於內部處理
          if (hours >= 24) {
            // 跨日時間
            const baseTime = dayjs().startOf('day').add(24, 'hour');
            const time = baseTime.add(hours - 24, 'hour').add(minutes, 'minute');
            setEditEndTime(time);
          } else {
            // 正常時間
            const time = dayjs().startOf('day').hour(hours).minute(minutes);
            setEditEndTime(time);
          }
        } else {
          setEditEndHour(null);
          setEditEndMinute(null);
          setEditEndTime(null);
        }
      } else {
        setEditEndHour(null);
        setEditEndMinute(null);
        setEditEndTime(null);
      }
      
      setEditLeaveTypeId(existingSchedule.leave_type_id || '');
      setEditIsMorningLeave(existingSchedule.is_morning_leave || false);
      setEditIsAfternoonLeave(existingSchedule.is_afternoon_leave || false);
    } else {
      setEditingSchedule({
        user_id: userId,
        schedule_date: dateStr,
        id: null
      });
      setEditStartTime(null);
      setEditEndTime(null);
      setEditEndHour(null);
      setEditEndMinute(null);
      setEditLeaveTypeId('');
      setEditIsMorningLeave(false);
      setEditIsAfternoonLeave(false);
    }
    setEditDialogOpen(true);
  };

  // 從選擇器更新結束時間
  const updateEndTimeFromSelect = (hour, minute) => {
    if (hour !== null && minute !== null) {
      // 格式化為 HH:mm
      const endTimeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      // 轉換為dayjs對象用於內部處理
      if (hour >= 24) {
        // 跨日時間
        const baseTime = dayjs().startOf('day').add(24, 'hour');
        const time = baseTime.add(hour - 24, 'hour').add(minute, 'minute');
        setEditEndTime(time);
      } else {
        // 正常時間
        const time = dayjs().startOf('day').hour(hour).minute(minute);
        setEditEndTime(time);
      }
    } else {
      setEditEndTime(null);
    }
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;

    try {
      // 處理結束時間，使用選擇器的值（支援24-32小時格式）
      let endTimeValue = null;
      if (editEndHour !== null && editEndMinute !== null) {
        // 使用選擇器的值
        endTimeValue = `${String(editEndHour).padStart(2, '0')}:${String(editEndMinute).padStart(2, '0')}`;
      } else if (editEndTime) {
        // 如果選擇器為空，使用TimePicker的值（正常時間）
        endTimeValue = editEndTime.format('HH:mm');
      }
      
      const scheduleData = {
        user_id: editingSchedule.user_id,
        department_group_id: selectedGroupId,
        schedule_date: editingSchedule.schedule_date,
        start_time: editStartTime ? editStartTime.format('HH:mm:ss') : null,
        end_time: endTimeValue,
        leave_type_id: editLeaveTypeId || null,
        is_morning_leave: editIsMorningLeave,
        is_afternoon_leave: editIsAfternoonLeave
      };

      if (editingSchedule.id) {
        // 更新現有記錄
        await axios.put(`/api/schedules/${editingSchedule.id}`, scheduleData);
      } else {
        // 建立新記錄
        await axios.post('/api/schedules', scheduleData);
      }

      setEditDialogOpen(false);
      setEditingSchedule(null);
      setEditStartTime(null);
      setEditEndTime(null);
      setEditEndHour(null);
      setEditEndMinute(null);
      setEditLeaveTypeId('');
      setEditIsMorningLeave(false);
      setEditIsAfternoonLeave(false);
      
      // 等待數據刷新完成
      await fetchSchedules();
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.updateSuccess')
      });
    } catch (error) {
      console.error('Save schedule error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  // 格式化結束時間用於顯示（支援26:00格式）
  const formatEndTimeForDisplay = (endTime) => {
    if (!endTime) return '';
    // 如果是字符串格式，直接返回前5個字符（HH:mm）
    if (typeof endTime === 'string') {
      return endTime.length >= 5 ? endTime.substring(0, 5) : endTime;
    }
    // 如果是Date對象或其他格式，轉換為字符串
    return endTime.toString().substring(0, 5);
  };

  // 取得假期顯示文字
  const getLeaveDisplayText = (schedule) => {
    if (!schedule) return null;
    
    const isMorning = schedule.is_morning_leave;
    const isAfternoon = schedule.is_afternoon_leave;
    
    if (isMorning && isAfternoon) {
      return t('schedule.fullDayLeave');
    } else if (isMorning) {
      return t('schedule.morningLeave');
    } else if (isAfternoon) {
      return t('schedule.afternoonLeave');
    }
    
    return null;
  };

  const handleBatchEdit = () => {
    setBatchEditDialogOpen(true);
  };

  const handleBatchSave = async () => {
    if (selectedUsers.length === 0 || selectedDates.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectUsersAndDates')
      });
      return;
    }

    try {
      const schedulesData = [];
      
      selectedDates.forEach(date => {
        if (!date) return;
        try {
          let dateObj;
          if (dayjs.isDayjs(date)) {
            // 已經是 dayjs 對象，確保使用香港時區
            dateObj = date.tz('Asia/Hong_Kong', true); // true 表示保持日期不變
          } else {
            // 需要解析
            dateObj = dayjs(date);
            if (!dateObj.isValid()) {
              console.warn('Invalid date in batch save:', date);
              return;
            }
            dateObj = dateObj.tz('Asia/Hong_Kong');
          }
          const dateStr = dateObj.format('YYYY-MM-DD');
          console.log('Batch save date:', { original: date, formatted: dateStr });
          selectedUsers.forEach(userId => {
            schedulesData.push({
              user_id: userId,
              department_group_id: selectedGroupId,
              schedule_date: dateStr,
              is_morning_leave: batchMorningLeave,
              is_afternoon_leave: batchAfternoonLeave
            });
          });
        } catch (error) {
          console.error('Error processing date in batch save:', error, date);
        }
      });

      await axios.post('/api/schedules/batch', { schedules: schedulesData });
      
      setBatchEditDialogOpen(false);
      setSelectedUsers([]);
      setSelectedDates([]);
      setBatchMorningLeave(false);
      setBatchAfternoonLeave(false);
      
      // 等待數據刷新完成
      await fetchSchedules();
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.batchUpdateSuccess')
      });
    } catch (error) {
      console.error('Batch save error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.batchUpdateFailed')
      });
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmDelete'),
      text: t('schedule.deleteConfirmMessage'),
      showCancelButton: true,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/schedules/${scheduleId}`);
        
        // 等待數據刷新完成
        await fetchSchedules();
        
        Swal.fire({
          icon: 'success',
          title: t('schedule.success'),
          text: t('schedule.deleteSuccess')
        });
      } catch (error) {
        console.error('Delete schedule error:', error);
        Swal.fire({
          icon: 'error',
          title: t('schedule.error'),
          text: error.response?.data?.message || t('schedule.deleteFailed')
        });
      }
    }
  };

  const generateDateRange = () => {
    const dates = [];
    // 確保使用香港時區
    let current = dayjs(startDate);
    if (!current.isValid()) {
      console.warn('Invalid startDate in generateDateRange');
      return [];
    }
    current = current.tz('Asia/Hong_Kong').startOf('day');
    
    let end = dayjs(endDate);
    if (!end.isValid()) {
      console.warn('Invalid endDate in generateDateRange');
      return [];
    }
    end = end.tz('Asia/Hong_Kong').startOf('day');
    
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current);
      current = current.add(1, 'day');
    }
    
    return dates;
  };

  const dates = generateDateRange();

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            {t('schedule.title')}
          </Typography>

          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('schedule.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('schedule.selectGroup')}
                  >
                    {departmentGroups.map(group => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'zh-TW' || i18n.language === 'zh-CN' 
                          ? group.name_zh || group.name 
                          : group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label={t('schedule.startDate')}
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label={t('schedule.endDate')}
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {canEdit && (
                    <>
                      <Button
                        variant={editMode ? 'contained' : 'outlined'}
                        onClick={() => setEditMode(!editMode)}
                        startIcon={<EditIcon />}
                      >
                        {editMode ? t('schedule.exitEdit') : t('schedule.edit')}
                      </Button>
                      {editMode && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={handleBatchEdit}
                          startIcon={<SaveIcon />}
                        >
                          {t('schedule.batchEdit')}
                        </Button>
                      )}
                    </>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>

          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t('schedule.viewOnly')}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>{t('common.loading')}</Typography>
            </Box>
          ) : selectedGroupId ? (
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('schedule.employee')}</TableCell>
                    {dates.map(date => (
                      <TableCell key={date.format('YYYY-MM-DD')} align="center">
                        <Box>
                          <Typography variant="caption" display="block">
                            {date.format('MM/DD')}
                          </Typography>
                          <Typography variant="caption" display="block">
                            {date.format('ddd')}
                          </Typography>
                        </Box>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {groupMembers.map(member => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            {member.employee_number}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {i18n.language === 'zh-TW' || i18n.language === 'zh-CN'
                              ? member.name_zh || member.name
                              : member.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      {dates.map(date => {
                        const schedule = getScheduleForUserAndDate(member.id, date);
                        const dateStr = date.format('YYYY-MM-DD');
                        return (
                          <TableCell key={dateStr} align="center">
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {editMode && canEdit ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleOpenEditDialog(member.id, date)}
                                    sx={{ minWidth: 'auto', p: 0.5 }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </Button>
                                  {schedule && (
                                    <>
                                      {/* 顯示工作時間 */}
                                      {schedule.start_time && schedule.end_time && (
                                        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                          {schedule.start_time.substring(0, 5)} - {formatEndTimeForDisplay(schedule.end_time)}
                                        </Typography>
                                      )}
                                      {/* 顯示假期類型 */}
                                      {schedule.leave_type_name_zh && (
                                        <Chip 
                                          label={schedule.leave_type_name_zh} 
                                          size="small" 
                                          color="primary"
                                          sx={{ fontSize: '0.65rem', height: '20px', mb: 0.5 }}
                                        />
                                      )}
                                      {/* 顯示假期時段（上午/下午/全天） */}
                                      {getLeaveDisplayText(schedule) && (
                                        <Chip 
                                          label={getLeaveDisplayText(schedule)} 
                                          size="small" 
                                          color="warning"
                                          sx={{ fontSize: '0.65rem', height: '20px', mb: 0.5 }}
                                        />
                                      )}
                                      <IconButton
                                        size="small"
                                        onClick={() => handleDeleteSchedule(schedule.id)}
                                        color="error"
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  {schedule ? (
                                    <>
                                      {/* 顯示工作時間 */}
                                      {schedule.start_time && schedule.end_time && (
                                        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                                          {schedule.start_time.substring(0, 5)} - {formatEndTimeForDisplay(schedule.end_time)}
                                        </Typography>
                                      )}
                                      {/* 顯示假期類型 */}
                                      {schedule.leave_type_name_zh && (
                                        <Chip 
                                          label={schedule.leave_type_name_zh} 
                                          size="small" 
                                          color="primary"
                                          sx={{ fontSize: '0.65rem', height: '20px', mb: 0.5 }}
                                        />
                                      )}
                                      {/* 顯示假期時段（上午/下午/全天） */}
                                      {getLeaveDisplayText(schedule) && (
                                        <Chip 
                                          label={getLeaveDisplayText(schedule)} 
                                          size="small" 
                                          color="warning"
                                          sx={{ fontSize: '0.65rem', height: '20px' }}
                                        />
                                      )}
                                      {/* 如果沒有任何資訊，顯示 --- */}
                                      {!schedule.start_time && !schedule.leave_type_name_zh && !getLeaveDisplayText(schedule) && (
                                        <Typography variant="caption" color="text.secondary">
                                          ---
                                        </Typography>
                                      )}
                                    </>
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">
                                      ---
                                    </Typography>
                                  )}
                                </>
                              )}
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                {t('schedule.selectGroupFirst')}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* 編輯排班對話框 */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => {
            setEditDialogOpen(false);
            setEditingSchedule(null);
            setEditStartTime(null);
            setEditEndTime(null);
            setEditEndHour(null);
            setEditEndMinute(null);
            setEditLeaveTypeId('');
            setEditIsMorningLeave(false);
            setEditIsAfternoonLeave(false);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{editingSchedule?.id ? t('schedule.editSchedule') : t('schedule.createSchedule')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TimePicker
                    label={t('schedule.startTime')}
                    value={editStartTime}
                    onChange={(newValue) => setEditStartTime(newValue)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                      {t('schedule.endTime')}
                    </Typography>
                    <Grid container spacing={1}>
                      <Grid item xs={5}>
                        <FormControl fullWidth>
                          <InputLabel>{t('schedule.hour')}</InputLabel>
                          <Select
                            value={editEndHour !== null ? editEndHour : ''}
                            onChange={(e) => {
                              const hour = e.target.value === '' ? null : Number(e.target.value);
                              setEditEndHour(hour);
                              updateEndTimeFromSelect(hour, editEndMinute);
                            }}
                            label={t('schedule.hour')}
                          >
                            {Array.from({ length: 33 }, (_, i) => i).map(hour => (
                              <MenuItem key={hour} value={hour}>
                                {String(hour).padStart(2, '0')} {hour >= 24 ? `(${t('schedule.nextDay')}${String(hour - 24).padStart(2, '0')}:00)` : ''}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={1} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography>:</Typography>
                      </Grid>
                      <Grid item xs={5}>
                        <FormControl fullWidth>
                          <InputLabel>{t('schedule.minute')}</InputLabel>
                          <Select
                            value={editEndMinute !== null ? editEndMinute : ''}
                            onChange={(e) => {
                              const minute = e.target.value === '' ? null : Number(e.target.value);
                              setEditEndMinute(minute);
                              updateEndTimeFromSelect(editEndHour, minute);
                            }}
                            label={t('schedule.minute')}
                          >
                            {Array.from({ length: 60 }, (_, i) => i).map(minute => (
                              <MenuItem key={minute} value={minute}>
                                {String(minute).padStart(2, '0')}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {t('schedule.endTimeHelper')}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.leaveType')}</InputLabel>
                    <Select
                      value={editLeaveTypeId}
                      onChange={(e) => setEditLeaveTypeId(e.target.value)}
                      label={t('schedule.leaveType')}
                    >
                      <MenuItem value="">
                        <em>{t('common.none')}</em>
                      </MenuItem>
                      {leaveTypes.map(leaveType => (
                        <MenuItem key={leaveType.id} value={leaveType.id}>
                          {i18n.language === 'zh-TW' || i18n.language === 'zh-CN'
                            ? leaveType.name_zh || leaveType.name
                            : leaveType.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('schedule.leavePeriod')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editIsMorningLeave && !editIsAfternoonLeave}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditIsMorningLeave(true);
                              setEditIsAfternoonLeave(false);
                            } else {
                              setEditIsMorningLeave(false);
                            }
                          }}
                        />
                      }
                      label={t('schedule.morningLeave')}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editIsAfternoonLeave && !editIsMorningLeave}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditIsAfternoonLeave(true);
                              setEditIsMorningLeave(false);
                            } else {
                              setEditIsAfternoonLeave(false);
                            }
                          }}
                        />
                      }
                      label={t('schedule.afternoonLeave')}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editIsMorningLeave && editIsAfternoonLeave}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditIsMorningLeave(true);
                              setEditIsAfternoonLeave(true);
                            } else {
                              setEditIsMorningLeave(false);
                              setEditIsAfternoonLeave(false);
                            }
                          }}
                        />
                      }
                      label={t('schedule.fullDayLeave')}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setEditDialogOpen(false);
              setEditingSchedule(null);
              setEditStartTime(null);
              setEditEndTime(null);
              setEditEndHour(null);
            setEditEndMinute(null);
              setEditLeaveTypeId('');
              setEditIsMorningLeave(false);
              setEditIsAfternoonLeave(false);
            }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveSchedule} variant="contained" color="primary">
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 批量編輯對話框 */}
        <Dialog 
          open={batchEditDialogOpen} 
          onClose={() => setBatchEditDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{t('schedule.batchEdit')}</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('schedule.selectUsers')}
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {groupMembers.map(member => (
                  <Box key={member.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Checkbox
                      checked={selectedUsers.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers([...selectedUsers, member.id]);
                        } else {
                          setSelectedUsers(selectedUsers.filter(id => id !== member.id));
                        }
                      }}
                    />
                    <Typography variant="body2">
                      {member.employee_number} - {i18n.language === 'zh-TW' || i18n.language === 'zh-CN'
                        ? member.name_zh || member.name
                        : member.name}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                {t('schedule.selectDates')}
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
                {dates.map(date => (
                  <Box key={date.format('YYYY-MM-DD')} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Checkbox
                      checked={selectedDates.some(d => {
                        if (!d || !date) return false;
                        try {
                          const dDate = dayjs(d);
                          const checkDate = dayjs(date);
                          if (!dDate.isValid() || !checkDate.isValid()) return false;
                          return dDate.tz('Asia/Hong_Kong').startOf('day').isSame(checkDate.tz('Asia/Hong_Kong').startOf('day'), 'day');
                        } catch (error) {
                          return false;
                        }
                      })}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDates([...selectedDates, date]);
                        } else {
                          setSelectedDates(selectedDates.filter(d => {
                            if (!d || !date) return true;
                            try {
                              const dDate = dayjs(d);
                              const checkDate = dayjs(date);
                              if (!dDate.isValid() || !checkDate.isValid()) return true;
                              return !dDate.tz('Asia/Hong_Kong').startOf('day').isSame(checkDate.tz('Asia/Hong_Kong').startOf('day'), 'day');
                            } catch (error) {
                              return true;
                            }
                          }));
                        }
                      }}
                    />
                    <Typography variant="body2">
                      {date.format('YYYY-MM-DD')} ({date.format('ddd')})
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ mt: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={batchMorningLeave}
                      onChange={(e) => setBatchMorningLeave(e.target.checked)}
                    />
                  }
                  label={t('schedule.morningLeave')}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={batchAfternoonLeave}
                      onChange={(e) => setBatchAfternoonLeave(e.target.checked)}
                    />
                  }
                  label={t('schedule.afternoonLeave')}
                />
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBatchEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBatchSave} variant="contained" color="primary">
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default Schedule;
