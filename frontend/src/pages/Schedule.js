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
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  Upload as UploadIcon
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

const Schedule = ({ noLayout = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 根據語言格式化日期顯示
  const formatDateDisplay = (date) => {
    if (!date) return '';
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    // 中文使用 DD/MM，英文使用 MM/DD
    return isChinese ? date.format('DD/MM') : date.format('MM/DD');
  };
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [helperSchedules, setHelperSchedules] = useState([]);
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').add(6, 'day'));
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [batchStartTime, setBatchStartTime] = useState('');
  const [batchEndTime, setBatchEndTime] = useState('');
  const [batchLeaveTypeId, setBatchLeaveTypeId] = useState(null);
  const [batchLeaveSession, setBatchLeaveSession] = useState(null);
  const [batchStoreId, setBatchStoreId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLeaveTypeId, setEditLeaveTypeId] = useState(null);
  const [editLeaveSession, setEditLeaveSession] = useState(null);
  const [editStoreId, setEditStoreId] = useState(null);
  const [stores, setStores] = useState([]);
  const [selectedDefaultStoreId, setSelectedDefaultStoreId] = useState(null); // 控制面板選擇的店舖（不存到資料庫）
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pendingError, setPendingError] = useState(null); // 待顯示的錯誤訊息
  const [allowCheckerEdit, setAllowCheckerEdit] = useState(true); // checker 是否可以編輯排班表
  const [canControlCheckerEdit, setCanControlCheckerEdit] = useState(false); // 當前用戶是否可以控制 checker 編輯權限

  useEffect(() => {
    fetchDepartmentGroups();
    fetchLeaveTypes();
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers();
      fetchSchedules();
      checkEditPermission();
    }
  }, [selectedGroupId, startDate, endDate, selectedDefaultStoreId]);

  // 當群組改變時，更新 allow_checker_edit 狀態
  useEffect(() => {
    if (selectedGroupId) {
      const group = departmentGroups.find(g => g.id === selectedGroupId);
      if (group) {
        setAllowCheckerEdit(group.allow_checker_edit !== false);
      }
    }
  }, [selectedGroupId, departmentGroups]);

  // 監聽 modal 關閉，如果有待顯示的錯誤訊息，則顯示
  useEffect(() => {
    if (!csvImportDialogOpen && pendingError) {
      // Modal 已關閉，顯示錯誤訊息
      const error = pendingError;
      setPendingError(null); // 清除待顯示的錯誤
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || error.message || t('schedule.csvImportFailed'),
        allowOutsideClick: true,
        allowEscapeKey: true
      });
    }
  }, [csvImportDialogOpen, pendingError, t]);

  const fetchDepartmentGroups = async () => {
    try {
      // 獲取用戶有權限查看的排班群組
      const response = await axios.get('/api/schedules/accessible-groups');
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
      // 後端已經按 positions.display_order 排序，不需要再次排序
      console.log('=== Fetch到的成員資料 ===');
      console.log('成員總數:', members.length);
      console.log('成員列表:', members);
      console.log('成員詳細資料:', members.map(m => ({
        id: m.id,
        employee_number: m.employee_number,
        display_name: m.display_name,
        name_zh: m.name_zh,
        position_name: m.position_name,
        position_employment_mode: m.position_employment_mode
      })));
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

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Fetch stores error:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      // 只保留允許在排班表中輸入的假期類型
      const allowedLeaveTypes = (response.data.leaveTypes || []).filter(lt => lt.allow_schedule_input);
      setLeaveTypes(allowedLeaveTypes);
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
      
      // 獲取原本群組的排班（原舖）
      // 如果指定了店舖ID，則只獲取該店舖的排班
      const schedulesParams = {
        department_group_id: selectedGroupId,
        start_date: startDateStr,
        end_date: endDateStr
      };
      // 如果選擇了店舖，添加 store_id 參數來過濾排班
      if (selectedDefaultStoreId) {
        schedulesParams.store_id = selectedDefaultStoreId;
      }
      
      const schedulesResponse = await axios.get('/api/schedules', {
        params: schedulesParams
      });
      const schedulesData = schedulesResponse.data.schedules || [];
      
      // 獲取幫舖排班（helper schedules）
      let helperSchedulesData = [];
      if (selectedDefaultStoreId) {
        try {
          const helperResponse = await axios.get('/api/schedules/helpers', {
            params: {
              department_group_id: selectedGroupId,
              store_id: selectedDefaultStoreId,
              start_date: startDateStr,
              end_date: endDateStr
            }
          });
          helperSchedulesData = helperResponse.data.helperSchedules || [];
        } catch (error) {
          console.error('Fetch helper schedules error:', error);
          // 如果獲取幫舖排班失敗，不影響原本群組的排班顯示
        }
      }
      console.log('=== 📅 Fetch到的排班資料 ===');
      console.log('📊 查詢參數:', {
        department_group_id: selectedGroupId,
        store_id: selectedDefaultStoreId,
        start_date: startDateStr,
        end_date: endDateStr
      });
      
      console.log('📋 原舖排班總數:', schedulesData.length);
      console.log('📋 原舖排班完整資料:', schedulesData);
      
      // 顯示每個排班的關鍵信息
      if (schedulesData.length > 0) {
        console.log('📋 原舖排班詳細列表:');
        schedulesData.forEach((s, index) => {
          console.log(`  [${index + 1}]`, {
            id: s.id,
            user_id: s.user_id,
            employee_number: s.employee_number,
            user_name: s.user_name || s.user_name_zh,
            schedule_date: s.schedule_date,
            start_time: s.start_time,
            end_time: s.end_time,
            store_id: s.store_id || s.store_table_id,
            store_code: s.store_code,
            leave_type: s.leave_type_name_zh || s.leave_type_name,
            leave_session: s.leave_session
          });
        });
      } else {
        console.warn('⚠️ 沒有找到原舖排班記錄');
      }
      
      // 按 employee_number 分組顯示
      const schedulesByEmployee = {};
      schedulesData.forEach(s => {
        const empNum = s.employee_number || `無員工編號(user_id:${s.user_id})`;
        if (!schedulesByEmployee[empNum]) {
          schedulesByEmployee[empNum] = [];
        }
        schedulesByEmployee[empNum].push({
          schedule_date: s.schedule_date,
          start_time: s.start_time,
          end_time: s.end_time,
          store_id: s.store_id || s.store_table_id,
          store_code: s.store_code
        });
      });
      console.log('👥 按員工編號分組的排班:', schedulesByEmployee);
      
      // 按日期分組顯示
      const schedulesByDate = {};
      schedulesData.forEach(s => {
        const date = s.schedule_date;
        if (!schedulesByDate[date]) {
          schedulesByDate[date] = [];
        }
        schedulesByDate[date].push({
          employee_number: s.employee_number,
          user_name: s.user_name || s.user_name_zh,
          start_time: s.start_time,
          end_time: s.end_time,
          store_code: s.store_code
        });
      });
      console.log('📅 按日期分組的排班:', schedulesByDate);
      
      // 調試：檢查有時間的排班記錄
      const schedulesWithTime = schedulesData.filter(s => s.start_time || s.end_time);
      console.log(`⏰ 有時間的排班記錄: ${schedulesWithTime.length}`, schedulesWithTime.map(s => ({
        employee_number: s.employee_number,
        user_id: s.user_id,
        schedule_date: s.schedule_date,
        start_time: s.start_time,
        end_time: s.end_time,
        store_code: s.store_code
      })));
      
      // 幫舖排班
      console.log('🆘 幫舖排班總數:', helperSchedulesData.length);
      if (helperSchedulesData.length > 0) {
        console.log('🆘 幫舖排班詳細列表:', helperSchedulesData.map(s => ({
          id: s.id,
          employee_number: s.employee_number,
          user_name: s.user_name || s.user_name_zh,
          schedule_date: s.schedule_date,
          start_time: s.start_time,
          end_time: s.end_time,
          store_id: s.store_id,
          store_code: s.store_code
        })));
      }
      
      console.log('📅 查詢日期範圍:', { 
        start: startDate.format('YYYY-MM-DD'), 
        end: endDate.format('YYYY-MM-DD') 
      });
      console.log('=== ✅ 排班資料載入完成 ===');
      setSchedules(schedulesData);
      setHelperSchedules(helperSchedulesData);
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
        setCanControlCheckerEdit(false);
        setAllowCheckerEdit(true);
        return;
      }

      // 設置 allow_checker_edit 狀態
      setAllowCheckerEdit(group.allow_checker_edit !== false);

      // 檢查用戶是否為系統管理員
      if (user.is_system_admin) {
        setCanEdit(true);
        setCanControlCheckerEdit(true);
        return;
      }

      // 檢查用戶是否為批核成員（checker, approver_1, approver_2, approver_3）
      const userDelegationGroups = user.delegation_groups || [];
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
      const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
      const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
      const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

      // 只有 approver1, approver2, approver3 可以控制 checker 編輯權限
      setCanControlCheckerEdit(isApprover1 || isApprover2 || isApprover3);

      // 如果用戶是 checker，需要檢查 allow_checker_edit 設置
      if (isChecker) {
        setCanEdit(group.allow_checker_edit !== false);
      } else {
        setCanEdit(isApprover1 || isApprover2 || isApprover3);
      }
    } catch (error) {
      console.error('Check edit permission error:', error);
      setCanEdit(false);
      setCanControlCheckerEdit(false);
    }
  };

  // 檢查用戶是否為 checker、approver1、approver2、approver3
  const canViewLeaveTypeDetail = () => {
    // 系統管理員可以看到詳細假期類別
    if (user.is_system_admin) {
      return true;
    }

    const group = departmentGroups.find(g => g.id === selectedGroupId);
    if (!group) {
      return false;
    }

    const userDelegationGroups = user.delegation_groups || [];
    const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

    const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

    return isChecker || isApprover1 || isApprover2 || isApprover3;
  };

  // 獲取應該顯示的假期類別文字
  const getLeaveTypeDisplayText = (schedule) => {
    if (!schedule || (!schedule.leave_type_name_zh && !schedule.leave_type_name && !schedule.leave_type_code)) {
      return null;
    }

    const canViewDetail = canViewLeaveTypeDetail();
    
    // 如果不能查看詳細類別，只顯示「假期」
    if (!canViewDetail) {
      const periodText = schedule.leave_session 
        ? ` (${schedule.leave_session === 'AM' ? t('schedule.morning') : t('schedule.afternoon')})`
        : '';
      return i18n.language === 'en' ? `Leave${periodText}` : `假期${periodText}`;
    }

    // 可以查看詳細類別，顯示具體的假期類別
    const leaveTypeDisplay = i18n.language === 'en'
      ? (schedule.leave_type_code || schedule.leave_type_name)
      : (schedule.leave_type_name_zh || schedule.leave_type_name);
    
    return schedule.leave_session 
      ? `${leaveTypeDisplay} (${schedule.leave_session === 'AM' ? t('schedule.morning') : t('schedule.afternoon')})`
      : leaveTypeDisplay;
  };

  const getScheduleForUserAndDate = (userId, employeeNumber, date) => {
    // 如果 date 為 null 或 undefined，返回 null
    if (!date) {
      return null;
    }
    
    // 格式化日期為 YYYY-MM-DD
    let dateStr;
    try {
      if (dayjs.isDayjs(date)) {
        dateStr = date.format('YYYY-MM-DD');
      } else {
        const dateObj = dayjs(date);
        if (!dateObj.isValid()) {
          console.warn('Invalid date in getScheduleForUserAndDate:', date);
          return null;
        }
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          dateStr = date;
        } else {
          dateStr = dateObj.format('YYYY-MM-DD');
        }
      }
    } catch (error) {
      console.error('Error formatting date in getScheduleForUserAndDate:', error, date);
      return null;
    }
    
    // 簡化匹配邏輯：只使用 user_id 匹配
    // 如果 schedules.user_id == users.id，就 filter 出來
    const found = schedules.find(s => {
      // 1. 用戶匹配：只使用 user_id
      if (!userId || !s.user_id) {
        return false;
      }
      
      const userMatch = Number(s.user_id) === Number(userId);
      if (!userMatch) {
        return false;
      }
      
      // 2. 日期匹配：統一轉換為 YYYY-MM-DD 格式
      let sDateStr = s.schedule_date;
      if (!sDateStr) {
        return false;
      }
      
      // 處理各種日期格式
      if (sDateStr instanceof Date) {
        const year = sDateStr.getFullYear();
        const month = String(sDateStr.getMonth() + 1).padStart(2, '0');
        const day = String(sDateStr.getDate()).padStart(2, '0');
        sDateStr = `${year}-${month}-${day}`;
      } else if (typeof sDateStr === 'string') {
        // 提取日期部分（YYYY-MM-DD）
        sDateStr = sDateStr.split('T')[0].substring(0, 10);
      } else {
        // 嘗試用 dayjs 解析
        const parsed = dayjs(sDateStr);
        if (parsed.isValid()) {
          sDateStr = parsed.format('YYYY-MM-DD');
        } else {
          return false;
        }
      }
      
      // 日期匹配
      return sDateStr === dateStr;
    });
    
    return found || null;
  };

  const handleOpenEditDialog = (userId, date, employeeNumber = null) => {
    if (!editMode || !canEdit) return;
    
    // 確保日期有效
    if (!date) {
      console.warn('Invalid date in handleOpenEditDialog');
      return;
    }

    // 如果沒有提供 employee_number，嘗試從 groupMembers 中查找
    if (!employeeNumber) {
      const member = groupMembers.find(m => m.id === userId);
      if (member) {
        employeeNumber = member.employee_number;
      }
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
    
    const existingSchedule = getScheduleForUserAndDate(userId, employeeNumber, date);

    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      
      // 處理開始時間，支援HH:mm格式（0-32小時）
      if (existingSchedule.start_time) {
        const startTimeStr = existingSchedule.start_time;
        // 解析時間字符串，提取HH:mm部分
        const timeMatch = startTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          setEditStartTime(startTimeStr.substring(0, 5)); // 只取HH:mm部分
        } else {
          setEditStartTime('');
        }
      } else {
        setEditStartTime('');
      }
      
      // 處理結束時間，支援26:00格式（0-32小時）
      if (existingSchedule.end_time) {
        const endTimeStr = existingSchedule.end_time;
        // 解析時間字符串，提取HH:mm部分
        const timeMatch = endTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          setEditEndTime(endTimeStr.substring(0, 5)); // 只取HH:mm部分
        } else {
          setEditEndTime('');
        }
      } else {
        setEditEndTime('');
      }
      
      // 設置假期類型
      setEditLeaveTypeId(existingSchedule.leave_type_id || null);
      setEditLeaveSession(existingSchedule.leave_session || null);
      // 設置店舖 - 如果有現有值則使用，否則為 null
      setEditStoreId(existingSchedule.store_id || null);
      
    } else {
      // 獲取該員工所屬的群組作為默認值
      const member = groupMembers.find(m => m.id === userId);
      const defaultGroupId = member ? selectedGroupId : null;
      
      setEditingSchedule({
        user_id: userId,
        schedule_date: dateStr,
        id: null,
        department_group_id: defaultGroupId
      });
      setEditStartTime('');
      setEditEndTime('');
      setEditLeaveTypeId(null);
      setEditLeaveSession(null);
      // 設置店舖默認值為 null
      setEditStoreId(null);
    }
    setEditDialogOpen(true);
  };

  // 計算結束時間（開始時間 + 9小時）
  const calculateEndTime = (startTime) => {
    if (!startTime || startTime.trim() === '') {
      return '';
    }
    
    // 解析開始時間
    let hours, minutes;
    
    // 處理4位數字格式（如2330）
    if (/^\d{4}$/.test(startTime)) {
      hours = parseInt(startTime.substring(0, 2), 10);
      minutes = parseInt(startTime.substring(2, 4), 10);
    } else {
      // 處理HH:mm格式
      const parts = startTime.split(':');
      if (parts.length !== 2) {
        return '';
      }
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 32 || minutes < 0 || minutes > 59) {
      return '';
    }
    
    // 加9小時
    const totalMinutes = hours * 60 + minutes + 9 * 60;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    // 格式化為HH:mm（支持0-32小時格式）
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  // 處理開始時間輸入（支援0-32小時格式，支援4位數字輸入如2330）
  const handleStartTimeChange = (e) => {
    const value = e.target.value;
    // 允許輸入格式：HH:mm 或 H:mm，或4位數字（如2330），小時範圍0-32
    if (value === '') {
      setEditStartTime('');
      setEditEndTime(''); // 清空開始時間時也清空結束時間
      return;
    }
    
    // 只允許數字和冒號
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    let finalStartTime = '';
    let shouldAutoCalculate = false;
    
    // 如果輸入的是4位數字（如2330），自動轉換為23:30格式
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      // 驗證範圍
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        finalStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        shouldAutoCalculate = true;
      }
    } else if (value.length <= 5) {
      // 限制長度（最多5個字符：HH:mm）
      const parts = value.split(':');
      
      if (parts.length === 1) {
        // 只有小時部分
        const hours = parseInt(parts[0], 10);
        if (!isNaN(hours) && hours >= 0 && hours <= 32) {
          setEditStartTime(value);
          // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
          if (selectedDefaultStoreId && !editStoreId) {
            setEditStoreId(selectedDefaultStoreId);
          }
          return; // 還未輸入完整，不自動計算
        }
      } else if (parts.length === 2) {
        // 有小時和分鐘
        const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
        const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
        
        // 驗證小時範圍（0-32）
        if (hours !== -1 && (hours < 0 || hours > 32)) {
          return;
        }
        
        // 驗證分鐘範圍（0-59）或允許部分輸入
        if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
          return;
        }
        
        // 如果分鐘部分超過2位數，截斷
        if (parts[1].length > 2) {
          finalStartTime = `${parts[0]}:${parts[1].substring(0, 2)}`;
          shouldAutoCalculate = true;
        } else {
          // 檢查是否已輸入完整的時間格式（HH:mm）
          if (hours !== -1 && minutes !== -1 && parts[0].length === 2 && parts[1].length === 2) {
            finalStartTime = value;
            shouldAutoCalculate = true;
          } else {
            setEditStartTime(value);
            // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
            if (selectedDefaultStoreId && !editStoreId) {
              setEditStoreId(selectedDefaultStoreId);
            }
            return; // 還未輸入完整，不自動計算
          }
        }
      } else {
        // 多個冒號，不允許
        return;
      }
    }
    
    if (finalStartTime) {
      setEditStartTime(finalStartTime);
      // 自動計算結束時間（開始時間 + 9小時）
      if (shouldAutoCalculate) {
        const calculatedEndTime = calculateEndTime(finalStartTime);
        if (calculatedEndTime) {
          setEditEndTime(calculatedEndTime);
        }
      }
      // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
      if (selectedDefaultStoreId && !editStoreId) {
        setEditStoreId(selectedDefaultStoreId);
      }
    }
  };

  // 處理結束時間輸入（支援0-32小時格式，支援4位數字輸入如2330）
  const handleEndTimeChange = (e) => {
    const value = e.target.value;
    // 允許輸入格式：HH:mm 或 H:mm，或4位數字（如2330），小時範圍0-32
    if (value === '') {
      setEditEndTime('');
      return;
    }
    
    // 只允許數字和冒號
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    // 如果輸入的是4位數字（如2330），自動轉換為23:30格式
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      // 驗證範圍
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        setEditEndTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        return;
      }
    }
    
    // 限制長度（最多5個字符：HH:mm）
    if (value.length > 5) {
      return;
    }
    
    // 驗證格式：允許部分輸入，但必須符合 HH:mm 或 H:mm 格式
    const parts = value.split(':');
    
    if (parts.length === 1) {
      // 只有小時部分
      const hours = parseInt(parts[0], 10);
      if (isNaN(hours) || hours < 0 || hours > 32) {
        return; // 小時超出範圍
      }
      setEditEndTime(value);
    } else if (parts.length === 2) {
      // 有小時和分鐘
      const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
      const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
      
      // 驗證小時範圍（0-32）
      if (hours !== -1 && (hours < 0 || hours > 32)) {
        return;
      }
      
      // 驗證分鐘範圍（0-59）或允許部分輸入
      if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
        return;
      }
      
      // 如果分鐘部分超過2位數，截斷
      if (parts[1].length > 2) {
        setEditEndTime(`${parts[0]}:${parts[1].substring(0, 2)}`);
      } else {
        setEditEndTime(value);
      }
    } else {
      // 多個冒號，不允許
      return;
    }
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;

    try {
      // 處理開始時間，支援0-32小時格式
      let startTimeValue = null;
      if (editStartTime && editStartTime.trim() !== '') {
        // 驗證格式
        const timeMatch = editStartTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          // 驗證範圍
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            startTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidStartTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidStartTimeFormat')
          });
          return;
        }
      }
      
      // 處理結束時間，支援0-32小時格式
      let endTimeValue = null;
      if (editEndTime && editEndTime.trim() !== '') {
        // 驗證格式
        const timeMatch = editEndTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          // 驗證範圍
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            endTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidEndTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidEndTimeFormat')
          });
          return;
        }
      }
      
      const scheduleData = {
        user_id: editingSchedule.user_id,
        department_group_id: selectedGroupId,
        schedule_date: editingSchedule.schedule_date,
        start_time: startTimeValue,
        end_time: endTimeValue,
        leave_type_id: editLeaveTypeId || null,
        leave_session: editLeaveSession || null,
        store_id: editStoreId || null
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
      setEditStartTime('');
      setEditEndTime('');
      setEditLeaveTypeId(null);
      setEditLeaveSession(null);
      setEditStoreId(null);
      
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

  // 取得假期顯示文字（簡化：只顯示假期類型，不區分上下午）
  const getLeaveDisplayText = (schedule) => {
    if (!schedule) return null;
    
    // 如果有假期類型，就顯示假期
    if (schedule.leave_type_name_zh || schedule.leave_type_name) {
      return schedule.leave_type_name_zh || schedule.leave_type_name;
    }
    
    return null;
  };

  // 渲染週曆視圖（手機版）- 每個人一行，日期作為列
  const renderWeekCalendarView = () => {
    return (
      <Box
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 600,
                      minWidth: 120,
                      maxWidth: 120,
                      boxShadow: '2px 0 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {t('schedule.employee')}
                  </TableCell>
                  {dates.map(date => (
                    <TableCell
                      key={date.format('YYYY-MM-DD')}
                      align="center"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 600,
                        minWidth: 80,
                        whiteSpace: 'nowrap',
                        fontSize: '0.85rem',
                      }}
                    >
                      <Box>
                        <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                          {formatDateDisplay(date)}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ opacity: 0.9, mt: 0.5 }}>
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
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      bgcolor: 'grey.50',
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      minWidth: 120,
                      maxWidth: 120,
                      boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {member.employee_number}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.65rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {member.display_name || member.name_zh || member.name}
                      </Typography>
                      {member.position_code || member.position_name || member.position_name_zh ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            fontSize: '0.6rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {member.position_code || (i18n.language === 'en'
                            ? (member.position_name || member.position_name_zh)
                            : (member.position_name_zh || member.position_name))}
                        </Typography>
                      ) : null}
                    </Box>
                  </TableCell>
                  {dates.map(date => {
                    const schedule = getScheduleForUserAndDate(member.id, member.employee_number, date);
                    const dateStr = date.format('YYYY-MM-DD');
                    return (
                      <TableCell
                        key={dateStr}
                        align="center"
                        sx={{
                          minWidth: 80,
                          whiteSpace: 'nowrap',
                          p: 0.5,
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                          {editMode && canEdit ? (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleOpenEditDialog(member.id, date, member.employee_number)}
                                sx={{ 
                                  minWidth: 'auto', 
                                  p: 0.5,
                                  borderRadius: 1.5,
                                  borderColor: 'primary.main',
                                  '&:hover': {
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    transform: 'scale(1.05)',
                                    transition: 'all 0.2s',
                                  },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </Button>
                              {schedule && (
                                <>
                                  {(schedule.start_time || schedule.end_time) && (
                                    <Typography 
                                      variant="caption" 
                                      display="block" 
                                      sx={{ 
                                        fontSize: '0.7rem', 
                                        mb: 0.5, 
                                        color: '#1565c0',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}
                                    </Typography>
                                  )}
                                  {getLeaveTypeDisplayText(schedule) && (
                                    <Chip
                                      label={getLeaveTypeDisplayText(schedule)}
                                      size="small"
                                      color="primary"
                                      sx={{ 
                                        fontSize: '0.65rem', 
                                        height: '20px', 
                                        mb: 0.5,
                                        fontWeight: 600,
                                        boxShadow: 1,
                                      }}
                                    />
                                  )}
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteSchedule(schedule.id)}
                                    color="error"
                                    sx={{ 
                                      p: 0.3,
                                      '&:hover': {
                                        bgcolor: 'error.main',
                                        color: 'error.contrastText',
                                        transform: 'scale(1.1)',
                                        transition: 'all 0.2s',
                                      },
                                    }}
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
                                  {(schedule.start_time || schedule.end_time) && (
                                    <Typography 
                                      variant="caption" 
                                      display="block" 
                                      sx={{ 
                                        fontSize: '0.7rem', 
                                        mb: 0.5, 
                                        color: '#1565c0',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}
                                    </Typography>
                                  )}
                                  {getLeaveTypeDisplayText(schedule) && (
                                    <Chip
                                      label={getLeaveTypeDisplayText(schedule)}
                                      size="small"
                                      color="primary"
                                      sx={{ 
                                        fontSize: '0.65rem', 
                                        height: '20px', 
                                        mb: 0.5,
                                        fontWeight: 600,
                                        boxShadow: 1,
                                      }}
                                    />
                                  )}
                                  {/* 顯示店舖 */}
                                  {schedule.store_code && (
                                    <Chip 
                                      label={schedule.store_short_name || schedule.store_code}
                                      size="small" 
                                      sx={{ 
                                        fontSize: '0.65rem', 
                                        height: '20px', 
                                        mb: 0.5,
                                        fontWeight: 600,
                                        boxShadow: 1,
                                        bgcolor: '#424242',
                                        color: '#ffffff',
                                      }}
                                    />
                                  )}
                                  {!schedule.start_time && !schedule.end_time && !schedule.leave_type_name_zh && !schedule.leave_type_name && !schedule.leave_type_code && !schedule.store_code && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}>
                                      ---
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
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
              {/* 統計行：顯示每日 FT 和 PT 數量 */}
              <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                <TableCell
                  sx={{
                    bgcolor: 'grey.100',
                    borderRight: '2px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    minWidth: 120,
                    maxWidth: 120,
                    boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {t('schedule.summary') || '統計'}
                </TableCell>
                {dates.map(date => {
                  const dateStr = date.format('YYYY-MM-DD');
                  // 計算該日期有排班的 FT 和 PT 數量
                  let ftCount = 0;
                  let ptCount = 0;
                  
                  // 統計群組成員（只計算有排班時間的）
                  groupMembers.forEach(member => {
                    const schedule = getScheduleForUserAndDate(member.id, member.employee_number, date);
                    // 判斷是否有排班時間：必須有 start_time 或 end_time（不包括只有 leave_type 但沒有時間的）
                    const hasScheduleTime = schedule && (
                      schedule.start_time || 
                      schedule.end_time
                    );
                    
                    if (hasScheduleTime) {
                      const employmentMode = member.position_employment_mode || member.employment_mode;
                      if (employmentMode === 'FT') {
                        ftCount++;
                      } else if (employmentMode === 'PT') {
                        ptCount++;
                      }
                    }
                  });
                  
                  // 統計 helper schedules（只計算有排班時間的）
                  // 後端已經根據選擇的店舖篩選了 helper，直接統計所有返回的 helper
                  helperSchedules.forEach(helper => {
                    const helperDateStr = typeof helper.schedule_date === 'string' 
                      ? helper.schedule_date.split('T')[0] 
                      : dayjs(helper.schedule_date).format('YYYY-MM-DD');
                    
                    if (helperDateStr === dateStr) {
                      // 判斷是否有排班時間：必須有 start_time 或 end_time
                      const hasScheduleTime = helper.start_time || helper.end_time;
                      
                      if (hasScheduleTime) {
                        const employmentMode = helper.position_employment_mode;
                        if (employmentMode === 'FT') {
                          ftCount++;
                        } else if (employmentMode === 'PT') {
                          ptCount++;
                        }
                      }
                    }
                  });
                  
                  return (
                    <TableCell
                      key={dateStr}
                      align="center"
                      sx={{
                        py: 1,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        bgcolor: 'grey.100',
                        minWidth: 80,
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.7rem' }}>
                          FT: {ftCount}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main', fontSize: '0.7rem' }}>
                          PT: {ptCount}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      );
    };

  const handleBatchEdit = () => {
    // 設置批量編輯的店舖預設值為控制面板選擇的店舖
    setBatchStoreId(selectedDefaultStoreId);
    setBatchEditDialogOpen(true);
  };

  // 處理批量編輯開始時間輸入
  const handleBatchStartTimeChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setBatchStartTime('');
      setBatchEndTime(''); // 清空開始時間時也清空結束時間
      return;
    }
    
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    let finalStartTime = '';
    let shouldAutoCalculate = false;
    
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        finalStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        shouldAutoCalculate = true;
      }
    } else if (value.length <= 5) {
      const parts = value.split(':');
      
      if (parts.length === 1) {
        const hours = parseInt(parts[0], 10);
        if (!isNaN(hours) && hours >= 0 && hours <= 32) {
          setBatchStartTime(value);
          // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
          if (selectedDefaultStoreId && !batchStoreId) {
            setBatchStoreId(selectedDefaultStoreId);
          }
          return; // 還未輸入完整，不自動計算
        }
      } else if (parts.length === 2) {
        const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
        const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
        
        if (hours !== -1 && (hours < 0 || hours > 32)) {
          return;
        }
        
        if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
          return;
        }
        
        if (parts[1].length > 2) {
          finalStartTime = `${parts[0]}:${parts[1].substring(0, 2)}`;
          shouldAutoCalculate = true;
        } else {
          // 檢查是否已輸入完整的時間格式（HH:mm）
          if (hours !== -1 && minutes !== -1 && parts[0].length === 2 && parts[1].length === 2) {
            finalStartTime = value;
            shouldAutoCalculate = true;
          } else {
            setBatchStartTime(value);
            // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
            if (selectedDefaultStoreId && !batchStoreId) {
              setBatchStoreId(selectedDefaultStoreId);
            }
            return; // 還未輸入完整，不自動計算
          }
        }
      }
    }
    
    if (finalStartTime) {
      setBatchStartTime(finalStartTime);
      // 自動計算結束時間（開始時間 + 9小時）
      if (shouldAutoCalculate) {
        const calculatedEndTime = calculateEndTime(finalStartTime);
        if (calculatedEndTime) {
          setBatchEndTime(calculatedEndTime);
        }
      }
      // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
      if (selectedDefaultStoreId && !batchStoreId) {
        setBatchStoreId(selectedDefaultStoreId);
      }
    }
  };

  // 處理批量編輯結束時間輸入
  const handleBatchEndTimeChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setBatchEndTime('');
      return;
    }
    
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        setBatchEndTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        return;
      }
    }
    
    if (value.length > 5) {
      return;
    }
    
    const parts = value.split(':');
    
    if (parts.length === 1) {
      const hours = parseInt(parts[0], 10);
      if (isNaN(hours) || hours < 0 || hours > 32) {
        return;
      }
      setBatchEndTime(value);
    } else if (parts.length === 2) {
      const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
      const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
      
      if (hours !== -1 && (hours < 0 || hours > 32)) {
        return;
      }
      
      if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
        return;
      }
      
      if (parts[1].length > 2) {
        setBatchEndTime(`${parts[0]}:${parts[1].substring(0, 2)}`);
      } else {
        setBatchEndTime(value);
      }
    } else {
      return;
    }
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
      // 處理開始時間
      let startTimeValue = null;
      if (batchStartTime && batchStartTime.trim() !== '') {
        const timeMatch = batchStartTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            startTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidStartTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidStartTimeFormat')
          });
          return;
        }
      }
      
      // 處理結束時間
      let endTimeValue = null;
      if (batchEndTime && batchEndTime.trim() !== '') {
        const timeMatch = batchEndTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            endTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidEndTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidEndTimeFormat')
          });
          return;
        }
      }

      const schedulesData = [];
      
      selectedDates.forEach(date => {
        if (!date) return;
        try {
          let dateObj;
          if (dayjs.isDayjs(date)) {
            dateObj = date.tz('Asia/Hong_Kong', true);
          } else {
            dateObj = dayjs(date);
            if (!dateObj.isValid()) {
              console.warn('Invalid date in batch save:', date);
              return;
            }
            dateObj = dateObj.tz('Asia/Hong_Kong');
          }
          const dateStr = dateObj.format('YYYY-MM-DD');
          selectedUsers.forEach(userId => {
            schedulesData.push({
              user_id: userId,
              department_group_id: selectedGroupId,
              schedule_date: dateStr,
              start_time: startTimeValue,
              end_time: endTimeValue,
              leave_type_id: batchLeaveTypeId !== null && batchLeaveTypeId !== undefined && batchLeaveTypeId !== '' ? Number(batchLeaveTypeId) : null,
              leave_session: batchLeaveSession !== null && batchLeaveSession !== undefined && batchLeaveSession !== '' ? batchLeaveSession : null,
              store_id: batchStoreId !== null && batchStoreId !== undefined && batchStoreId !== '' ? Number(batchStoreId) : null
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
      setBatchStartTime('');
      setBatchEndTime('');
      setBatchLeaveTypeId(null);
      setBatchLeaveSession(null);
      setBatchStoreId(null);
      
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

  // 處理 CSV 文件選擇
  const handleCsvFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        Swal.fire({
          icon: 'error',
          title: t('schedule.error'),
          text: t('schedule.invalidFileType')
        });
        return;
      }
      setCsvFile(file);
    }
  };

  // 處理 CSV 匯入
  // 正確解析 CSV 行，處理包含逗號、引號等特殊字符的欄位
  const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 轉義的引號
          current += '"';
          i++; // 跳過下一個引號
        } else {
          // 切換引號狀態
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // 在引號外的逗號，表示欄位分隔符
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // 添加最後一個欄位
    values.push(current.trim());
    
    return values;
  };

  const handleCsvImport = async () => {
    if (!csvFile) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.error'),
        text: t('schedule.pleaseSelectFile')
      });
      return;
    }

    setImporting(true);
    try {
      // 讀取 CSV 文件
      const text = await csvFile.text();
      // 處理不同類型的換行符（\r\n, \n, \r）
      const lines = text.split(/\r?\n|\r/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error(t('schedule.csvEmptyOrInvalid'));
      }

      // 解析 CSV（假設第一行是標題）
      const headers = parseCSVLine(lines[0]);
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 9) continue; // 跳過不完整的行（新格式需要至少 9 欄）

        // 跳過第一列（欄A: 數位）
        const dataValues = values.slice(1);
        
        // 根據新的 POS CSV 格式（跳過第一列後）：
        // 欄B=分行代碼, 欄C=運行日期(不參考), 欄D=員工ID, 欄E=員工姓名(不匯入), 欄F=TILL(不參考), 欄G=Clock in/Clock out, 欄H=日期, 欄I=時間
        const row = {
          employee_number: dataValues[2] || '', // 欄D: 員工ID (跳過第一列後索引為2)
          name: null, // 欄E: 員工姓名 (不匯入，設為 null)
          branch_code: dataValues[0] || '', // 欄B: 分行代碼 (跳過第一列後索引為0)
          date: dataValues[6] || '', // 欄H: 日期 (跳過第一列後索引為6)
          clock_time: dataValues[7] || '', // 欄I: 時間 (跳過第一列後索引為7)
          in_out: dataValues[5] || '' // 欄G: Clock in/Clock out (跳過第一列後索引為5)
        };

        if (row.employee_number && row.date && row.clock_time && row.in_out) {
          data.push(row);
        }
      }

      if (data.length === 0) {
        throw new Error(t('schedule.noValidData'));
      }

      // 發送到後端
      const response = await axios.post('/api/attendances/import-csv', { data });

      setCsvImportDialogOpen(false);
      setCsvFile(null);
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.csvImportSuccess', { count: response.data.imported_count })
      });

      // 如果有錯誤，顯示警告
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('CSV import errors:', response.data.errors);
      }
    } catch (error) {
      console.error('CSV import error:', error);
      // 先關閉 modal，並保存錯誤訊息待 modal 完全關閉後顯示
      setPendingError(error);
      setCsvImportDialogOpen(false);
      setCsvFile(null);
    } finally {
      setImporting(false);
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

  // 更新 checker 編輯權限設置
  const handleToggleCheckerEdit = async (event) => {
    const newValue = event.target.checked;
    if (!selectedGroupId) return;

    try {
      await axios.put(`/api/schedules/group/${selectedGroupId}/checker-edit-permission`, {
        allow_checker_edit: newValue
      });
      
      setAllowCheckerEdit(newValue);
      
      // 更新本地群組數據
      setDepartmentGroups(prevGroups => 
        prevGroups.map(g => 
          g.id === selectedGroupId 
            ? { ...g, allow_checker_edit: newValue }
            : g
        )
      );

      // 重新檢查編輯權限（因為 checker 的權限可能改變）
      await checkEditPermission();

      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: newValue ? t('schedule.checkerEditEnabled') : t('schedule.checkerEditDisabled'),
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Update checker edit permission error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
      // 恢復原值
      setAllowCheckerEdit(!newValue);
    }
  };

  // 批量更新所有群組的 checker 編輯權限設置
  const handleBatchUpdateCheckerEdit = async (enable) => {
    const confirmText = enable 
      ? t('schedule.confirmEnableAllCheckerEdit')
      : t('schedule.confirmDisableAllCheckerEdit');

    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmBatchUpdate'),
      text: confirmText,
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const response = await axios.put('/api/schedules/groups/batch-checker-edit-permission', {
        allow_checker_edit: enable
      });

      // 更新本地所有群組數據
      setDepartmentGroups(prevGroups => 
        prevGroups.map(g => ({ ...g, allow_checker_edit: enable }))
      );

      // 如果當前選中的群組也在更新列表中，更新當前群組的狀態
      if (selectedGroupId) {
        setAllowCheckerEdit(enable);
        await checkEditPermission();
      }

      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.batchUpdateSuccess', { count: response.data.updated_count }),
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Batch update checker edit permission error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.batchUpdateFailed')
      });
    }
  };

  const dates = generateDateRange();

  const content = (
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
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <CalendarIcon sx={{ fontSize: 32 }} />
              {t('schedule.title')}
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>

          {/* 批量控制區塊 - 放在控制面板上方 */}
          {canControlCheckerEdit && (
            <Card 
              elevation={1}
              sx={{ 
                mb: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('schedule.batchControl')}
                </Typography>
                <Button
                  variant="outlined"
                  color="success"
                  size="small"
                  onClick={() => handleBatchUpdateCheckerEdit(true)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('schedule.enableAll')}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => handleBatchUpdateCheckerEdit(false)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('schedule.disableAll')}
                </Button>
              </Box>
            </Card>
          )}

          <Card 
            elevation={2}
            sx={{ 
              mb: 3, 
              p: 3,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('schedule.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('schedule.selectGroup')}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
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
                  format="DD/MM/YYYY"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                      }
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label={t('schedule.endDate')}
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  format="DD/MM/YYYY"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                      }
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('schedule.selectStoreForHelper') || t('schedule.store')}</InputLabel>
                  <Select
                    value={selectedDefaultStoreId || ''}
                    onChange={(e) => setSelectedDefaultStoreId(e.target.value || null)}
                    label={t('schedule.selectStoreForHelper') || t('schedule.store')}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <MenuItem value="">
                      <em>{t('schedule.allStores')}</em>
                    </MenuItem>
                    {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {canEdit && (
                    <Button
                      variant={editMode ? 'contained' : 'outlined'}
                      onClick={() => setEditMode(!editMode)}
                      startIcon={<EditIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: editMode ? 3 : 0,
                        '&:hover': {
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      {editMode ? t('schedule.exitEdit') : t('schedule.edit')}
                    </Button>
                  )}
                  {canControlCheckerEdit && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={allowCheckerEdit}
                          onChange={handleToggleCheckerEdit}
                          color="primary"
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                          {t('schedule.allowCheckerEdit')}
                        </Typography>
                      }
                      sx={{ ml: 0, mr: 0 }}
                    />
                  )}
                  {canEdit && editMode && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleBatchEdit}
                      startIcon={<SaveIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: 3,
                        '&:hover': {
                          boxShadow: 5,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      {t('schedule.batchEdit')}
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Card>


          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : selectedGroupId ? (
            isMobile ? (
              renderWeekCalendarView()
            ) : (
            <>
            <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          py: 2,
                        }}
                      >
                        {t('schedule.employee')}
                      </TableCell>
                      {dates.map(date => (
                        <TableCell 
                          key={date.format('YYYY-MM-DD')} 
                          align="center"
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            py: 2,
                            minWidth: 100,
                          }}
                        >
                          <Box>
                            <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                              {formatDateDisplay(date)}
                            </Typography>
                            <Typography variant="caption" display="block" sx={{ opacity: 0.9, mt: 0.5 }}>
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
                      <TableCell
                        sx={{
                          bgcolor: 'grey.50',
                          borderRight: '2px solid',
                          borderColor: 'divider',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main', mb: 0.5 }}>
                            {member.employee_number}
                          </Typography>
                          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                            {member.display_name || member.name_zh || member.name}
                          </Typography>
                          {member.position_code || member.position_name || member.position_name_zh ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', mt: 0.5 }}>
                              {member.position_code || (i18n.language === 'en'
                                ? (member.position_name || member.position_name_zh)
                                : (member.position_name_zh || member.position_name))}
                            </Typography>
                          ) : null}
                        </Box>
                      </TableCell>
                      {dates.map(date => {
                        const schedule = getScheduleForUserAndDate(member.id, member.employee_number, date);
                        const dateStr = date.format('YYYY-MM-DD');
                        // 調試：檢查 schedule 資料
                        if (schedule && schedule.leave_type_name_zh) {
                          console.log('Schedule with leave:', {
                            date: dateStr,
                            user_id: member.id,
                            leave_type_name_zh: schedule.leave_type_name_zh,
                            leave_session: schedule.leave_session,
                            has_session: !!schedule.leave_session
                          });
                        }
                        return (
                          <TableCell 
                            key={dateStr} 
                            align="center"
                            sx={{
                              py: 1.5,
                              borderRight: '1px solid',
                              borderColor: 'divider',
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                              {editMode && canEdit ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleOpenEditDialog(member.id, date, member.employee_number)}
                                    sx={{ 
                                      minWidth: 'auto', 
                                      p: 0.75,
                                      borderRadius: 1.5,
                                      borderColor: 'primary.main',
                                      '&:hover': {
                                        bgcolor: 'primary.main',
                                        color: 'white',
                                        transform: 'scale(1.05)',
                                        transition: 'all 0.2s',
                                      },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </Button>
                                  {schedule && (
                                    <>
                                      {/* 顯示工作時間 - 只要有start_time或end_time就顯示 */}
                                      {(schedule.start_time || schedule.end_time) && (
                                        <Typography 
                                          variant="caption" 
                                          display="block" 
                                          sx={{ 
                                            mb: 0.5, 
                                            color: '#1565c0',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                          }}
                                        >
                                          {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}
                                        </Typography>
                                      )}
                                      {/* 顯示假期類型 */}
                                      {getLeaveTypeDisplayText(schedule) && (
                                        <Chip 
                                          label={getLeaveTypeDisplayText(schedule)}
                                          size="small" 
                                          color="primary"
                                          sx={{ 
                                            fontSize: '0.7rem', 
                                            height: '22px', 
                                            mb: 0.5,
                                            fontWeight: 600,
                                            boxShadow: 1,
                                          }}
                                        />
                                      )}
                                      {/* 顯示店舖 */}
                                      {schedule.store_code && (
                                        <Chip 
                                          label={schedule.store_short_name || schedule.store_code}
                                          size="small" 
                                          sx={{ 
                                            fontSize: '0.7rem', 
                                            height: '22px', 
                                            mb: 0.5,
                                            fontWeight: 600,
                                            boxShadow: 1,
                                            bgcolor: '#424242',
                                            color: '#ffffff',
                                          }}
                                        />
                                      )}
                                      {schedule.id && (
                                        <IconButton
                                          size="small"
                                          onClick={() => handleDeleteSchedule(schedule.id)}
                                          color="error"
                                          sx={{
                                            '&:hover': {
                                              bgcolor: 'error.main',
                                              color: 'error.contrastText',
                                              transform: 'scale(1.1)',
                                              transition: 'all 0.2s',
                                            },
                                          }}
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      )}
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  {schedule ? (
                                    <>
                                      {/* 顯示工作時間 - 只要有start_time或end_time就顯示 */}
                                      {(schedule.start_time || schedule.end_time) && (
                                        <Typography 
                                          variant="caption" 
                                          display="block" 
                                          sx={{ 
                                            mb: 0.5, 
                                            color: '#1565c0',
                                            fontWeight: 600,
                                            fontSize: '0.75rem',
                                          }}
                                        >
                                          {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}
                                        </Typography>
                                      )}
                                      {/* 顯示假期類型 */}
                                      {getLeaveTypeDisplayText(schedule) && (
                                        <Chip 
                                          label={getLeaveTypeDisplayText(schedule)}
                                          size="small" 
                                          color="primary"
                                          sx={{ 
                                            fontSize: '0.7rem', 
                                            height: '22px', 
                                            mb: 0.5,
                                            fontWeight: 600,
                                            boxShadow: 1,
                                          }}
                                        />
                                      )}
                                      {/* 顯示店舖 */}
                                      {schedule.store_code && (
                                        <Chip 
                                          label={schedule.store_short_name || schedule.store_code}
                                          size="small" 
                                          sx={{ 
                                            fontSize: '0.7rem', 
                                            height: '22px', 
                                            mb: 0.5,
                                            fontWeight: 600,
                                            boxShadow: 1,
                                            bgcolor: '#424242',
                                            color: '#ffffff',
                                          }}
                                        />
                                      )}
                                      {/* 如果沒有任何資訊，顯示 --- */}
                                      {!schedule.start_time && !schedule.end_time && !schedule.leave_type_name_zh && !schedule.leave_type_name && !schedule.leave_type_code && !schedule.store_code && (
                                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
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
                  {/* 顯示跨群組的 helper */}
                  {(() => {
                    // 獲取選中的 store 的 store_short_name_
                    const selectedStore = selectedDefaultStoreId 
                      ? stores.find(s => Number(s.id) === Number(selectedDefaultStoreId))
                      : null;
                    const selectedStoreShortName = selectedStore?.store_short_name_ || null;
                    
                    // 按用戶分組 helper schedules，只處理 store_short_name 匹配的 helper
                    const helperByUser = {};
                    helperSchedules.forEach(helper => {
                      // 如果選中了 store，只處理 store_short_name 匹配的 helper
                      if (selectedStoreShortName) {
                        if (helper.store_short_name !== selectedStoreShortName) {
                          return; // 跳過不匹配的 helper
                        }
                      } else {
                        // 如果沒有選中 store，不顯示任何 helper
                        return;
                      }
                      
                      const userId = helper.user_id;
                      if (!helperByUser[userId]) {
                        helperByUser[userId] = {
                          user_id: userId,
                          employee_number: helper.employee_number,
                          display_name: helper.user_name || helper.user_name_zh || '',
                          group_name: helper.group_name_zh || helper.group_name || '',
                          position_name: helper.position_name,
                          position_name_zh: helper.position_name_zh,
                          schedules: {}
                        };
                      }
                      const dateStr = typeof helper.schedule_date === 'string' 
                        ? helper.schedule_date.split('T')[0] 
                        : dayjs(helper.schedule_date).format('YYYY-MM-DD');
                      helperByUser[userId].schedules[dateStr] = helper;
                    });
                    
                    return Object.values(helperByUser).map(helperUser => (
                      <TableRow key={`helper-${helperUser.user_id}`}>
                        <TableCell
                          sx={{
                            bgcolor: 'grey.50',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main', mb: 0.5 }}>
                              {helperUser.employee_number}
                            </Typography>
                            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                              {helperUser.display_name}
                            </Typography>
                            {helperUser.position_name || helperUser.position_name_zh ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', mt: 0.5 }}>
                                {i18n.language === 'en'
                                  ? (helperUser.position_name || helperUser.position_name_zh)
                                  : (helperUser.position_name_zh || helperUser.position_name)}
                              </Typography>
                            ) : null}
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                display: 'inline-block',
                                fontSize: '0.75rem', 
                                mt: 0.5,
                                bgcolor: '#c62828',
                                color: '#ffffff',
                                px: 1,
                                py: 0.5,
                                borderRadius: '20px',
                                fontWeight: 500,
                              }}
                            >
                              {t('schedule.helper') || 'Helper'}
                            </Typography>
                          </Box>
                        </TableCell>
                        {dates.map(date => {
                          const dateStr = date.format('YYYY-MM-DD');
                          const schedule = helperUser.schedules[dateStr];
                          return (
                            <TableCell 
                              key={dateStr} 
                              align="center"
                              sx={{
                                py: 1.5,
                                borderRight: '1px solid',
                                borderColor: 'divider',
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                },
                              }}
                            >
                              {schedule ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                                  {(schedule.start_time || schedule.end_time) && (
                                    <Typography 
                                      variant="caption" 
                                      display="block" 
                                      sx={{ 
                                        fontSize: '0.7rem', 
                                        mb: 0.5, 
                                        color: '#1565c0',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? (schedule.end_time.length > 5 ? schedule.end_time.substring(0, 5) : schedule.end_time) : '--:--'}
                                    </Typography>
                                  )}
                                  {schedule.store_short_name && (
                                    <Chip 
                                      label={schedule.store_short_name}
                                      size="small" 
                                      sx={{ 
                                        fontSize: '0.65rem', 
                                        height: '20px', 
                                        mb: 0.5,
                                        fontWeight: 600,
                                        boxShadow: 1,
                                        bgcolor: '#424242',
                                        color: '#ffffff',
                                      }}
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                  ---
                                </Typography>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ));
                  })()}
                  {/* 統計行：顯示每日 FT 和 PT 數量 */}
                  <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                    <TableCell
                      sx={{
                        bgcolor: 'grey.100',
                        borderRight: '2px solid',
                        borderColor: 'divider',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        fontWeight: 600,
                        fontSize: '0.9rem',
                      }}
                    >
                      {t('schedule.summary') || '統計'}
                    </TableCell>
                    {dates.map(date => {
                      const dateStr = date.format('YYYY-MM-DD');
                      // 計算該日期有排班的 FT 和 PT 數量
                      let ftCount = 0;
                      let ptCount = 0;
                      
                      // 統計群組成員（只計算有排班時間的）
                      groupMembers.forEach(member => {
                        const schedule = getScheduleForUserAndDate(member.id, member.employee_number, date);
                        // 判斷是否有排班時間：必須有 start_time 或 end_time（不包括只有 leave_type 但沒有時間的）
                        const hasScheduleTime = schedule && (
                          schedule.start_time || 
                          schedule.end_time
                        );
                        
                        if (hasScheduleTime) {
                          const employmentMode = member.position_employment_mode || member.employment_mode;
                          if (employmentMode === 'FT') {
                            ftCount++;
                          } else if (employmentMode === 'PT') {
                            ptCount++;
                          }
                        }
                      });
                      
                      // 統計 helper schedules（只計算有排班時間的）
                      // 後端已經根據選擇的店舖篩選了 helper，直接統計所有返回的 helper
                      helperSchedules.forEach(helper => {
                        const helperDateStr = typeof helper.schedule_date === 'string' 
                          ? helper.schedule_date.split('T')[0] 
                          : dayjs(helper.schedule_date).format('YYYY-MM-DD');
                        
                        if (helperDateStr === dateStr) {
                          // 判斷是否有排班時間：必須有 start_time 或 end_time
                          const hasScheduleTime = helper.start_time || helper.end_time;
                          
                          if (hasScheduleTime) {
                            const employmentMode = helper.position_employment_mode;
                            if (employmentMode === 'FT') {
                              ftCount++;
                            } else if (employmentMode === 'PT') {
                              ptCount++;
                            }
                          }
                        }
                      });
                      
                      return (
                        <TableCell
                          key={dateStr}
                          align="center"
                          sx={{
                            py: 1.5,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            bgcolor: 'grey.100',
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              FT: {ftCount}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              PT: {ptCount}
                            </Typography>
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
              </TableContainer>
            </Card>
            </>
            )
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
                {t('schedule.selectGroupFirst')}
              </Typography>
            </Card>
          )}
        </Paper>

        {/* 編輯排班對話框 */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => {
            setEditDialogOpen(false);
            setEditingSchedule(null);
            setEditStartTime('');
            setEditEndTime('');
            setEditLeaveTypeId(null);
            setEditLeaveSession(null);
            setEditStoreId(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: 6,
            }
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 600,
              py: 2.5,
            }}
          >
            {editingSchedule?.id ? t('schedule.editSchedule') : t('schedule.createSchedule')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.startTime')}
                    value={editStartTime}
                    onChange={handleStartTimeChange}
                    placeholder="HH:mm 或 2330 (0-32:00-59)"
                    fullWidth
                    helperText={t('schedule.startTimeHelper')}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.endTime')}
                    value={editEndTime}
                    onChange={handleEndTimeChange}
                    placeholder="HH:mm 或 2600 (0-32:00-59)"
                    fullWidth
                    helperText={t('schedule.endTimeHelper')}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* 假期類別 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.leaveType')}</InputLabel>
                    <Select
                      value={editLeaveTypeId || ''}
                      onChange={(e) => {
                        const newLeaveTypeId = e.target.value || null;
                        setEditLeaveTypeId(newLeaveTypeId);
                        // 如果清空假期類型，也清空時段
                        if (!newLeaveTypeId) {
                          setEditLeaveSession(null);
                        } else {
                          // 如果選擇了假期類型，且控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
                          if (selectedDefaultStoreId && !editStoreId) {
                            setEditStoreId(selectedDefaultStoreId);
                          }
                        }
                      }}
                      label={t('schedule.leaveType')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectLeaveType')}</em>
                      </MenuItem>
                      {leaveTypes.map(lt => (
                        <MenuItem key={lt.id} value={lt.id}>
                          {i18n.language === 'en' ? lt.name : (lt.name_zh || lt.name)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {editLeaveTypeId && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>{t('schedule.leavePeriod')}</InputLabel>
                      <Select
                        value={editLeaveSession || ''}
                        onChange={(e) => setEditLeaveSession(e.target.value || null)}
                        label={t('schedule.leavePeriod')}
                      >
                        <MenuItem value="">
                          <em>{t('schedule.fullDayLeave')}</em>
                        </MenuItem>
                        <MenuItem value="AM">{t('schedule.morningLeave')}</MenuItem>
                        <MenuItem value="PM">{t('schedule.afternoonLeave')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {/* 店舖選取 - 移到最底部 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.store')}</InputLabel>
                    <Select
                      value={editStoreId || ''}
                      onChange={(e) => setEditStoreId(e.target.value || null)}
                      label={t('schedule.store')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectStore')}</em>
                      </MenuItem>
                      {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setEditDialogOpen(false);
                setEditingSchedule(null);
                setEditStartTime('');
                setEditEndTime('');
                setEditLeaveTypeId(null);
                setEditLeaveSession(null);
                setEditStoreId(null);
              }}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSaveSchedule} 
              variant="contained" 
              color="primary"
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 5,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 批量編輯對話框 */}
        <Dialog 
          open={batchEditDialogOpen} 
          onClose={() => {
            setBatchEditDialogOpen(false);
            setSelectedUsers([]);
            setSelectedDates([]);
            setBatchStartTime('');
            setBatchEndTime('');
            setBatchLeaveTypeId(null);
            setBatchLeaveSession(null);
            setBatchStoreId(null);
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: 6,
            }
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 600,
              py: 2.5,
            }}
          >
            {t('schedule.batchEdit')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                {t('schedule.selectUsers')}
              </Typography>
              <Box sx={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                border: 2, 
                borderColor: 'primary.light', 
                borderRadius: 2, 
                p: 2,
                bgcolor: 'grey.50',
                boxShadow: 1,
              }}>
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
                      {member.employee_number} - {member.display_name || member.name_zh || member.name}
                      {member.position_code || member.position_name || member.position_name_zh ? (
                        <span style={{ color: '#666', fontSize: '0.85em' }}>
                          {' '}({member.position_code || (i18n.language === 'en'
                            ? (member.position_name || member.position_name_zh)
                            : (member.position_name_zh || member.position_name))})
                        </span>
                      ) : null}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 4, fontWeight: 600, color: 'primary.main', mb: 2 }}>
                {t('schedule.selectDates')}
              </Typography>
              <Box sx={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                border: 2, 
                borderColor: 'primary.light', 
                borderRadius: 2, 
                p: 2,
                bgcolor: 'grey.50',
                boxShadow: 1,
              }}>
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
                      {formatDateDisplay(date)} ({date.format('ddd')})
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography variant="subtitle1" gutterBottom sx={{ mt: 4, fontWeight: 600, color: 'primary.main', mb: 2 }}>
                {t('schedule.timeAndLeave')}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.startTime')}
                    value={batchStartTime}
                    onChange={handleBatchStartTimeChange}
                    placeholder="HH:mm 或 2330 (0-32:00-59)"
                    fullWidth
                    helperText={t('schedule.startTimeHelper')}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.endTime')}
                    value={batchEndTime}
                    onChange={handleBatchEndTimeChange}
                    placeholder="HH:mm 或 2600 (0-32:00-59)"
                    fullWidth
                    helperText={t('schedule.endTimeHelper')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.leaveType')}</InputLabel>
                    <Select
                      value={batchLeaveTypeId || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === null || value === undefined) {
                          setBatchLeaveTypeId(null);
                          setBatchLeaveSession(null);
                        } else {
                          setBatchLeaveTypeId(Number(value));
                          // 如果選擇了假期類型，且控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
                          if (selectedDefaultStoreId && !batchStoreId) {
                            setBatchStoreId(selectedDefaultStoreId);
                          }
                        }
                      }}
                      label={t('schedule.leaveType')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectLeaveType')}</em>
                      </MenuItem>
                      {leaveTypes.map(lt => (
                        <MenuItem key={lt.id} value={lt.id}>
                          {i18n.language === 'en' ? lt.name : (lt.name_zh || lt.name)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {batchLeaveTypeId && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>{t('schedule.leavePeriod')}</InputLabel>
                      <Select
                        value={batchLeaveSession || ''}
                        onChange={(e) => setBatchLeaveSession(e.target.value || null)}
                        label={t('schedule.leavePeriod')}
                      >
                        <MenuItem value="">
                          <em>{t('schedule.fullDayLeave')}</em>
                        </MenuItem>
                        <MenuItem value="AM">{t('schedule.morningLeave')}</MenuItem>
                        <MenuItem value="PM">{t('schedule.afternoonLeave')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {/* 店舖選取 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.store')}</InputLabel>
                    <Select
                      value={batchStoreId || ''}
                      onChange={(e) => setBatchStoreId(e.target.value || null)}
                      label={t('schedule.store')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectStore')}</em>
                      </MenuItem>
                      {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setBatchEditDialogOpen(false);
                setSelectedUsers([]);
                setSelectedDates([]);
                setBatchStartTime('');
                setBatchEndTime('');
                setBatchLeaveTypeId(null);
                setBatchLeaveSession(null);
                setBatchStoreId(null);
              }}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleBatchSave} 
              variant="contained" 
              color="primary"
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 5,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

      </Container>
    </LocalizationProvider>
  );

  return content;
};

export default Schedule;
