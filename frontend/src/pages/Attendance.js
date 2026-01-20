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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  IconButton,
  Card,
  Divider,
  useTheme,
  useMediaQuery,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  AccessTime as AccessTimeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Upload as UploadIcon,
  ContentCopy as ContentCopyIcon
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

const Attendance = ({ noLayout = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').add(6, 'day'));
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [editClockInTime, setEditClockInTime] = useState(null);
  const [editClockOutTime, setEditClockOutTime] = useState(null);
  const [editTimeOffStart, setEditTimeOffStart] = useState(null);
  const [editTimeOffEnd, setEditTimeOffEnd] = useState(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [editClockRecords, setEditClockRecords] = useState([]); // 存儲所有打卡記錄，用於選擇有效性
  const [editClockTimes, setEditClockTimes] = useState([]); // 存儲可編輯的打卡時間列表 [{id, time, is_valid}, ...]
  const [editStoreId, setEditStoreId] = useState(null);
  const [stores, setStores] = useState([]);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // 檢查用戶是否為 approver1、approver2、approver3（不包含 checker）
  const [pendingError, setPendingError] = useState(null); // 待顯示的錯誤訊息

  useEffect(() => {
    fetchDepartmentGroups();
    fetchStores();
  }, []);

  // 監聽 modal 關閉，如果有待顯示的錯誤訊息，則顯示
  useEffect(() => {
    if (!csvImportDialogOpen && pendingError) {
      // Modal 已關閉，顯示錯誤訊息
      const error = pendingError;
      setPendingError(null); // 清除待顯示的錯誤
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || error.message || t('attendance.csvImportFailed'),
        allowOutsideClick: true,
        allowEscapeKey: true
      });
    }
  }, [csvImportDialogOpen, pendingError, t]);

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Fetch stores error:', error);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers();
      fetchAttendanceComparison();
      checkEditPermission();
    }
  }, [selectedGroupId, startDate, endDate]);

  const fetchDepartmentGroups = async () => {
    try {
      const response = await axios.get('/api/attendances/accessible-groups');
      const groups = response.data.groups || [];
      setDepartmentGroups(groups);
      
      if (groups.length === 1) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
      // 如果是權限錯誤，設置空數組
      if (error.response?.status === 403) {
        setDepartmentGroups([]);
      } else {
        Swal.fire({
          icon: 'error',
          title: t('attendance.error'),
          text: error.response?.data?.message || t('attendance.fetchGroupsFailed')
        });
      }
    }
  };

  const fetchGroupMembers = async () => {
    if (!selectedGroupId) return;
    
    try {
      const response = await axios.get(`/api/groups/department/${selectedGroupId}/members`);
      const members = response.data.members || [];
      // 後端已經按 positions.display_order 排序，不需要再次排序
      setGroupMembers(members);
    } catch (error) {
      console.error('Fetch group members error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || t('attendance.fetchMembersFailed')
      });
    }
  };

  const checkEditPermission = () => {
    // 檢查用戶是否為批核成員（僅 approver_1, approver_2, approver_3，不包含 checker）
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

      // 檢查用戶是否為批核成員（僅 approver_1, approver_2, approver_3，不包含 checker）
      const userDelegationGroups = user.delegation_groups || [];
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
      const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
      const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

      setCanEdit(isApprover1 || isApprover2 || isApprover3);
    } catch (error) {
      console.error('Check edit permission error:', error);
      setCanEdit(false);
    }
  };

  const fetchAttendanceComparison = async () => {
    if (!selectedGroupId) return;
    
    setLoading(true);
    try {
      const startDateStr = dayjs(startDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const endDateStr = dayjs(endDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      
      const response = await axios.get('/api/attendances/comparison', {
        params: {
          department_group_id: selectedGroupId,
          start_date: startDateStr,
          end_date: endDateStr
        }
      });
      
      setComparisonData(response.data.comparison || []);
    } catch (error) {
      console.error('Fetch attendance comparison error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || t('attendance.fetchComparisonFailed')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = async (item) => {
    console.log('handleOpenEditDialog - item:', item);
    console.log('item.attendance_date:', item?.attendance_date);
    console.log('item.clock_records:', item?.clock_records);
    
    // 確保 item 有必要的屬性
    if (!item) {
      console.error('handleOpenEditDialog: item is null or undefined');
      return;
    }
    
    // 確保 attendance_date 存在
    if (!item.attendance_date) {
      console.error('handleOpenEditDialog: item.attendance_date is missing', item);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: t('attendance.missingAttendanceDate')
      });
      return;
    }
    
    setEditingAttendance(item);
    setEditClockInTime(item.attendance?.clock_in_time ? dayjs(item.attendance.clock_in_time, 'HH:mm:ss') : null);
    setEditClockOutTime(item.attendance?.clock_out_time ? dayjs(item.attendance.clock_out_time, 'HH:mm:ss') : null);
    setEditTimeOffStart(item.attendance?.time_off_start ? dayjs(item.attendance.time_off_start, 'HH:mm:ss') : null);
    setEditTimeOffEnd(item.attendance?.time_off_end ? dayjs(item.attendance.time_off_end, 'HH:mm:ss') : null);
    setEditRemarks(item.attendance?.remarks || '');
    // 設置店舖ID（從 schedule 中獲取），但需要從 stores 數據中查找對應的店舖
    const scheduleStoreId = item.schedule?.store_id;
    if (scheduleStoreId !== undefined && scheduleStoreId !== null) {
      // 從 stores 數組中查找對應的店舖
      const foundStore = stores.find(store => Number(store.id) === Number(scheduleStoreId));
      setEditStoreId(foundStore ? Number(foundStore.id) : null);
    } else {
      setEditStoreId(null);
    }
    
    // 先使用 item 中的 clock_records
    let clockRecords = item?.clock_records || [];
    console.log('Initial clock_records from item:', clockRecords);
    console.log('Initial clock_records length:', clockRecords.length);
    console.log('item structure:', JSON.stringify(item, null, 2));
    
    // 確保 clock_records 是數組
    if (!Array.isArray(clockRecords)) {
      console.warn('clock_records is not an array, converting...', clockRecords);
      clockRecords = [];
    }
    
    // 顯示所有記錄，保留它們當前的 is_valid 狀態，並添加可編輯的時間字段
    setEditClockRecords(clockRecords.map(record => ({
      ...record,
      is_valid: record.is_valid === true, // 保留當前的有效性狀態
      editableTime: record.clock_time ? (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : '' // 可編輯的時間字符串
    })));
    
    console.log('Final editClockRecords:', clockRecords);
    
    // 不再需要單獨的 editClockTimes，因為時間編輯直接在 editClockRecords 中
    setEditClockTimes([]);
    
    setEditDialogOpen(true);
  };

  // 自動勾選最早的4個時間
  const handleAutoSelectEarliest = () => {
    if (!canEdit) return;
    if (!editClockRecords || editClockRecords.length === 0) return;
    
    // 按時間排序，取最早的4個
    const sorted = [...editClockRecords].sort((a, b) => {
      const timeA = a.clock_time || '';
      const timeB = b.clock_time || '';
      return timeA.localeCompare(timeB);
    });
    
    // 只勾選前4個
    const updated = editClockRecords.map((record, idx) => {
      const sortedIndex = sorted.findIndex(r => r.id === record.id);
      return {
        ...record,
        is_valid: sortedIndex >= 0 && sortedIndex < 4
      };
    });
    
    setEditClockRecords(updated);
  };

  // 處理新增打卡時間
  const handleAddClockTime = () => {
    if (!editingAttendance || !canEdit) return;
    
    const newRecord = {
      id: null, // 新記錄沒有id
      tempId: `temp-${Date.now()}-${Math.random()}`, // 臨時唯一標識符
      employee_number: editingAttendance?.employee_number || '',
      name: editingAttendance?.display_name || '',
      branch_code: '',
      attendance_date: editingAttendance?.attendance_date || '',
      clock_time: '',
      in_out: 'IN1',
      is_valid: true,
      editableTime: '', // 可編輯的時間字符串
      created_by_id: null,
      updated_by_id: null
    };
    // 確保 editClockRecords 是數組
    const currentRecords = editClockRecords || [];
    setEditClockRecords([...currentRecords, newRecord]);
  };

  // 處理刪除打卡時間
  const handleRemoveClockTime = (recordId, tempId) => {
    if (!canEdit) return;
    if (recordId !== null && recordId !== undefined) {
      // 有 id 的記錄，標記為無效而不是刪除
      const updated = editClockRecords.map(record => 
        record.id === recordId ? { ...record, is_valid: false } : record
      );
      setEditClockRecords(updated);
    } else if (tempId) {
      // 沒有 id 的新記錄，使用 tempId 來移除
      const updated = editClockRecords.filter(record => record.tempId !== tempId);
      setEditClockRecords(updated);
    }
  };

  // 處理更新打卡時間
  const handleUpdateClockTime = (recordId, tempId, newTime) => {
    const updated = editClockRecords.map(record => {
      if (recordId !== null && record.id === recordId) {
        // 有 id 的記錄
        return { ...record, editableTime: newTime };
      } else if (tempId && record.tempId === tempId) {
        // 新記錄（使用 tempId 匹配）
        return { ...record, editableTime: newTime };
      }
      return record;
    });
    setEditClockRecords(updated);
  };

  const handleSaveAttendance = async () => {
    if (!editingAttendance) return;

    try {
      if (!editClockRecords || editClockRecords.length === 0) {
        // 沒有打卡記錄，直接返回
        setEditDialogOpen(false);
        setEditingAttendance(null);
        setEditRemarks('');
        setEditClockRecords([]);
        await fetchAttendanceComparison();
        return;
      }

      // 確保有必要的參數
      if (!editingAttendance.attendance_date) {
        throw new Error(t('attendance.missingAttendanceDateParam'));
      }
      
      if (!editingAttendance.employee_number && !editingAttendance.user_id) {
        throw new Error(t('attendance.missingEmployeeParam'));
      }

      // 分離需要處理的記錄
      const validityUpdates = []; // 更新有效性的記錄
      const timeUpdates = []; // 更新時間的記錄
      const creates = []; // 新增的記錄

      for (const record of editClockRecords) {
        // 處理有效性更新（只針對有 id 的記錄）
        if (record.id) {
          // 確保 is_valid 是明確的 boolean 值
          const isValid = record.is_valid === true || record.is_valid === 'true' || record.is_valid === 1;
          validityUpdates.push({
            id: record.id,
            is_valid: isValid === true // 明確轉換為 boolean
          });

          // 處理時間更新（如果有修改）
          if (record.editableTime && record.editableTime.trim() !== '') {
            // 驗證時間格式（支援 0-32 小時）
            const timeRegex = /^([0-2][0-9]|3[0-2]):[0-5][0-9]$/;
            if (!timeRegex.test(record.editableTime)) {
              throw new Error(t('attendance.invalidTimeFormat', { time: record.editableTime }));
            }

            const timeStr = record.editableTime + ':00'; // 轉換為 HH:mm:ss 格式
            const originalTime = record.clock_time ? 
              (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : '';
            
            if (originalTime !== record.editableTime) {
              // 時間有變化，需要更新
              timeUpdates.push({
                id: record.id,
                clock_time: timeStr
              });
            }
          }
        } else {
          // 新記錄，需要新增（只新增有效的記錄）
          if (record.is_valid && record.editableTime && record.editableTime.trim() !== '') {
            // 驗證時間格式（支援 0-32 小時）
            const timeRegex = /^([0-2][0-9]|3[0-2]):[0-5][0-9]$/;
            if (!timeRegex.test(record.editableTime)) {
              throw new Error(t('attendance.invalidTimeFormat', { time: record.editableTime }));
            }

            const timeStr = record.editableTime + ':00';
            creates.push({
              employee_number: editingAttendance.employee_number,
              user_id: editingAttendance.user_id,
              department_group_id: selectedGroupId,
              attendance_date: editingAttendance.attendance_date,
              clock_time: timeStr
            });
          }
        }
      }

      // 執行更新和新增操作
      if (validityUpdates.length > 0) {
        await axios.put('/api/attendances/update-clock-records', {
          clock_records: validityUpdates
        });
      }

      if (timeUpdates.length > 0) {
        await axios.put('/api/attendances/update-clock-records-time', {
          clock_records: timeUpdates
        });
      }

      if (creates.length > 0) {
        for (const createData of creates) {
          await axios.post('/api/attendances', {
            employee_number: createData.employee_number,
            user_id: createData.user_id,
            department_group_id: createData.department_group_id,
            attendance_date: createData.attendance_date,
            clock_in_time: createData.clock_time,
            clock_out_time: null,
            time_off_start: null,
            time_off_end: null,
            remarks: null
          });
        }
      }

      // 更新備註（如果有修改）
      if (editRemarks !== undefined && editRemarks !== null) {
        const originalRemarks = editingAttendance?.attendance?.remarks || null;
        const remarksToSave = editRemarks.trim() === '' ? null : editRemarks.trim();
        
        // 只有當備註有變化時才更新
        if (remarksToSave !== originalRemarks) {
          await axios.put('/api/attendances/update-remarks', {
            user_id: editingAttendance.user_id,
            employee_number: editingAttendance.employee_number,
            attendance_date: editingAttendance.attendance_date,
            remarks: remarksToSave
          });
        }
      }

      // 更新排班的 store_id（如果有修改且存在 schedule）
      if (editingAttendance.schedule?.id) {
        const originalStoreId = editingAttendance.schedule?.store_id || null;
        const storeIdToSave = editStoreId || null;
        
        if (storeIdToSave !== originalStoreId) {
          await axios.put(`/api/schedules/${editingAttendance.schedule.id}`, {
            store_id: storeIdToSave
          });
        }
      }

      setEditDialogOpen(false);
      setEditingAttendance(null);
      setEditClockInTime(null);
      setEditClockOutTime(null);
      setEditTimeOffStart(null);
      setEditTimeOffEnd(null);
      setEditRemarks('');
      setEditStoreId(null);
      setEditClockRecords([]);
      
      await fetchAttendanceComparison();
      
      Swal.fire({
        icon: 'success',
        title: t('attendance.success'),
        text: t('attendance.updateSuccess')
      });
    } catch (error) {
      console.error('Save attendance error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || error.message || t('attendance.updateFailed')
      });
    }
  };

  // 一鍵複製到月結表（為群組內所有成員生成）
  const handleCopyToMonthlySummary = async () => {
    if (!selectedGroupId || !groupMembers || groupMembers.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('attendance.error') || '錯誤',
        text: t('attendance.noGroupMembers') || '請先選擇群組'
      });
      return;
    }

    try {
      // 使用當前日期範圍的第一天來確定年份和月份
      const firstDate = dayjs(startDate).tz('Asia/Hong_Kong');
      const year = firstDate.year();
      const month = firstDate.month() + 1; // dayjs月份從0開始
      // 使用該月的第一天作為attendance_date
      const attendanceDate = firstDate.startOf('month').format('YYYY-MM-DD');

      const result = await Swal.fire({
        title: t('attendance.copyToMonthlySummary') || '複製到月結表',
        text: t('attendance.copyToMonthlySummaryConfirmAll', { year, month }) || `確定要為群組內所有成員生成 ${year}年${month}月的月結表嗎？已有記錄的員工將被略過。`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: t('common.confirm') || '確定',
        cancelButtonText: t('common.cancel') || '取消'
      });

      if (!result.isConfirmed) return;

      // 顯示進度提示
      Swal.fire({
        title: t('attendance.processing') || '處理中',
        text: t('attendance.copyingToMonthlySummary') || '正在為群組成員生成月結表...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      let successCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];

      // 為每個群組成員生成月結表
      for (const member of groupMembers) {
        try {
          // 確保成員有有效的 ID
          const userId = member.id || member.user_id;
          if (!userId) {
            console.warn(`Member ${member.employee_number} has no valid ID, skipping...`);
            errorCount++;
            errors.push({
              employee_number: member.employee_number || 'N/A',
              name: member.display_name || member.name || 'N/A',
              error: '缺少用戶ID'
            });
            continue;
          }

          // 檢查該員工是否已有月結表記錄
          const checkResponse = await axios.get('/api/monthly-attendance-summaries', {
            params: {
              user_id: userId,
              year: year,
              month: month
            }
          });

          // 如果已有記錄且daily_data長度不是0，則略過
          if (checkResponse.data.summaries && checkResponse.data.summaries.length > 0) {
            const summary = checkResponse.data.summaries[0];
            if (summary.daily_data && summary.daily_data.length > 0) {
              skippedCount++;
              continue;
            }
          }

          // 為該員工生成月結表
          await axios.post('/api/monthly-attendance-summaries/copy-from-attendance', {
            user_id: userId,
            year: year,
            month: month,
            attendance_date: attendanceDate
          });

          successCount++;
        } catch (error) {
          const userId = member.id || member.user_id;
          console.error(`Copy to monthly summary error for user ${userId}:`, error);
          errorCount++;
          errors.push({
            employee_number: member.employee_number || 'N/A',
            name: member.display_name || member.name || 'N/A',
            error: error.response?.data?.message || error.message || t('common.unknownError') || '未知錯誤'
          });
        }
      }

      // 顯示結果
      let resultMessage = '';
      if (successCount > 0) {
        resultMessage += `${t('attendance.successCount') || '成功'}：${successCount} ${t('attendance.employees') || '位員工'}\n`;
      }
      if (skippedCount > 0) {
        resultMessage += `${t('attendance.skippedCount') || '已略過'}：${skippedCount} ${t('attendance.employees') || '位員工'}${t('attendance.withExistingRecords') || '（已有記錄）'}\n`;
      }
      if (errorCount > 0) {
        resultMessage += `${t('attendance.errorCount') || '失敗'}：${errorCount} ${t('attendance.employees') || '位員工'}\n`;
      }

      if (errorCount > 0) {
        // 如果有錯誤，顯示詳細錯誤信息
        let errorDetails = errors.map(e => `${e.employee_number} - ${e.name}: ${e.error}`).join('\n');
        Swal.fire({
          icon: 'warning',
          title: t('attendance.copyToMonthlySummaryCompleted') || '處理完成',
          html: `<div style="text-align: left;">${resultMessage.replace(/\n/g, '<br>')}</div>
                 <details style="margin-top: 10px; text-align: left;">
                   <summary style="cursor: pointer; color: #d32f2f;">${t('attendance.errorDetails') || '錯誤詳情'}</summary>
                   <pre style="white-space: pre-wrap; font-size: 0.85em; margin-top: 5px;">${errorDetails}</pre>
                 </details>`,
          width: '600px'
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: t('attendance.copyToMonthlySummaryCompleted') || '處理完成',
          text: resultMessage.trim() || (t('attendance.copyToMonthlySummarySuccess') || '已成功複製到月結表')
        });
      }
    } catch (error) {
      console.error('Copy to monthly summary error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || t('attendance.copyToMonthlySummaryFailed') || '複製到月結表失敗'
      });
    }
  };

  // 將時間字符串轉換為分鐘數（處理跨天情況）
  const timeToMinutes = (timeStr, isEndTime = false, startHour = null) => {
    if (!timeStr) return null;
    const time = timeStr.substring(0, 5); // HH:mm
    const [hour, minute] = time.split(':').map(Number);
    let totalMinutes = hour * 60 + minute;
    
    // 如果小時數 >= 24，表示跨天（如26:00表示第二天凌晨2:00）
    if (hour >= 24) {
      totalMinutes = (hour - 24) * 60 + minute + 24 * 60;
    }
    // 如果是結束時間，且小時數小於開始時間的小時數，表示跨天
    else if (isEndTime && startHour !== null && hour < startHour) {
      totalMinutes = totalMinutes + 24 * 60;
    }
    
    return totalMinutes;
  };

  // 自動對比考勤並生成備註
  const handleAutoCompare = () => {
    if (!editingAttendance) return;
    
    const issues = [];
    
    // 獲取排班時間
    const schedule = editingAttendance.schedule;
    const scheduleStartTime = schedule?.start_time;
    const scheduleEndTime = schedule?.end_time;
    
    // 獲取有效的打卡記錄
    const validRecords = editClockRecords.filter(r => r.is_valid === true);
    const sortedRecords = [...validRecords].sort((a, b) => {
      const timeA = a.editableTime || (a.clock_time ? (typeof a.clock_time === 'string' ? a.clock_time.substring(0, 5) : a.clock_time) : '');
      const timeB = b.editableTime || (b.clock_time ? (typeof b.clock_time === 'string' ? b.clock_time.substring(0, 5) : b.clock_time) : '');
      return timeA.localeCompare(timeB);
    });
    
    // 獲取實際打卡時間
    const clockInTime = sortedRecords.length > 0 ? (sortedRecords[0].editableTime || (sortedRecords[0].clock_time ? (typeof sortedRecords[0].clock_time === 'string' ? sortedRecords[0].clock_time.substring(0, 5) : sortedRecords[0].clock_time) : '')) : null;
    // 下班時間取最後一條有效記錄
    const clockOutTime = sortedRecords.length > 0 ? (sortedRecords[sortedRecords.length - 1].editableTime || (sortedRecords[sortedRecords.length - 1].clock_time ? (typeof sortedRecords[sortedRecords.length - 1].clock_time === 'string' ? sortedRecords[sortedRecords.length - 1].clock_time.substring(0, 5) : sortedRecords[sortedRecords.length - 1].clock_time) : '')) : null;
    
    // 檢查缺勤
    if (sortedRecords.length === 0) {
      issues.push(t('attendance.absent'));
    } else {
      // 檢查遲到：第一個有效打卡時間大於排班的開始時間
      if (scheduleStartTime && clockInTime) {
        const scheduleStart = scheduleStartTime.substring(0, 5); // HH:mm
        const [scheduleHour, scheduleMinute] = scheduleStart.split(':').map(Number);
        const [clockInHour, clockInMinute] = clockInTime.split(':').map(Number);
        
        // 處理跨天的情況（小時可能超過24，如26:00表示第二天凌晨2:00）
        let scheduleTotalMinutes = scheduleHour * 60 + scheduleMinute;
        if (scheduleHour >= 24) {
          scheduleTotalMinutes = (scheduleHour - 24) * 60 + scheduleMinute + 24 * 60;
        }
        
        let clockInTotalMinutes = clockInHour * 60 + clockInMinute;
        if (clockInHour >= 24) {
          clockInTotalMinutes = (clockInHour - 24) * 60 + clockInMinute + 24 * 60;
        }
        // 如果打卡時間的小時數小於排班開始時間的小時數，且打卡時間在12點之前，可能是跨天
        else if (clockInHour < scheduleHour && clockInHour < 12) {
          clockInTotalMinutes = clockInTotalMinutes + 24 * 60;
        }
        
        // 第一個有效打卡時間大於排班開始時間，則為遲到
        if (clockInTotalMinutes > scheduleTotalMinutes) {
          const lateMinutes = clockInTotalMinutes - scheduleTotalMinutes;
          issues.push(t('attendance.lateMinutes', { minutes: lateMinutes }));
        }
      }
      
      // 檢查早退和超時工作（需要有排班結束時間和實際下班時間）
      if (scheduleEndTime && clockOutTime) {
        const scheduleStartHour = scheduleStartTime ? parseInt(scheduleStartTime.substring(0, 2)) : null;
        const scheduleEndMinutes = timeToMinutes(scheduleEndTime, true, scheduleStartHour);
        const clockOutMinutes = timeToMinutes(clockOutTime, true, scheduleStartHour);
        
        if (scheduleEndMinutes !== null && clockOutMinutes !== null) {
          if (clockOutMinutes < scheduleEndMinutes) {
            const earlyMinutes = scheduleEndMinutes - clockOutMinutes;
            issues.push(t('attendance.earlyLeaveMinutes', { minutes: earlyMinutes }));
          } else if (clockOutMinutes > scheduleEndMinutes) {
            const overtimeMinutes = clockOutMinutes - scheduleEndMinutes;
            if (overtimeMinutes >= 15) {
              issues.push(t('attendance.overtimeMinutes', { minutes: overtimeMinutes }));
            }
          }
        }
      }
    }
    
    // 生成備註
    if (issues.length > 0) {
      const remarksText = issues.join('、');
      setEditRemarks(remarksText);
    } else {
      // 如果沒有問題，可以清空備註或顯示正常
      if (editRemarks.trim() === '') {
        setEditRemarks(t('attendance.normal'));
      }
    }
  };

  const handleDeleteAttendance = async (attendanceId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('attendance.confirmDelete'),
      text: t('attendance.deleteConfirmMessage'),
      showCancelButton: true,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/attendances/${attendanceId}`);
        await fetchAttendanceComparison();
        
        Swal.fire({
          icon: 'success',
          title: t('attendance.success'),
          text: t('attendance.deleteSuccess')
        });
      } catch (error) {
        console.error('Delete attendance error:', error);
        Swal.fire({
          icon: 'error',
          title: t('attendance.error'),
          text: error.response?.data?.message || t('attendance.deleteFailed')
        });
      }
    }
  };

  // 處理 CSV 文件選擇
  const handleCsvFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        Swal.fire({
          icon: 'error',
          title: t('attendance.error'),
          text: t('attendance.invalidFileType')
        });
        return;
      }
      setCsvFile(file);
    }
  };

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

  // 處理 CSV 匯入
  const handleCsvImport = async () => {
    if (!csvFile) {
      Swal.fire({
        icon: 'warning',
        title: t('attendance.error'),
        text: t('attendance.pleaseSelectFile')
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
        throw new Error(t('attendance.csvEmptyOrInvalid'));
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
        throw new Error(t('attendance.noValidData'));
      }

      // 發送到後端
      const response = await axios.post('/api/attendances/import-csv', { data });

      setCsvImportDialogOpen(false);
      setCsvFile(null);
      
      // 刷新數據
      await fetchAttendanceComparison();
      
      Swal.fire({
        icon: 'success',
        title: t('attendance.success'),
        text: t('attendance.csvImportSuccess', { count: response.data.imported_count })
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'on_time':
        return 'success';
      case 'late':
        return 'warning';
      case 'absent':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'on_time':
        return t('attendance.onTime');
      case 'late':
        return t('attendance.late');
      case 'absent':
        return t('attendance.absent');
      default:
        return '-';
    }
  };

  const formatDateDisplay = (date) => {
    if (!date) return '';
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    return isChinese ? dayjs(date).format('DD/MM') : dayjs(date).format('MM/DD');
  };

  const generateDateRange = () => {
    const dates = [];
    let current = dayjs(startDate);
    if (!current.isValid()) return [];
    current = current.tz('Asia/Hong_Kong').startOf('day');
    
    let end = dayjs(endDate);
    if (!end.isValid()) return [];
    end = end.tz('Asia/Hong_Kong').startOf('day');
    
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current);
      current = current.add(1, 'day');
    }
    
    return dates;
  };

  const dates = generateDateRange();

  // 按員工分組數據
  const groupedData = {};
  comparisonData.forEach(item => {
    if (!groupedData[item.user_id]) {
      groupedData[item.user_id] = {
        user_id: item.user_id,
        employee_number: item.employee_number,
        display_name: item.display_name,
        position_code: item.position_code || null,
        position_name: item.position_name || null,
        position_name_zh: item.position_name_zh || null,
        dates: {}
      };
    }
    groupedData[item.user_id].dates[item.attendance_date] = item;
  });

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
              <AccessTimeIcon sx={{ fontSize: 32 }} />
              {t('attendance.title')}
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>

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
                  <InputLabel>{t('attendance.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('attendance.selectGroup')}
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
                  label={t('attendance.startDate')}
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
                  label={t('attendance.endDate')}
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
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={fetchAttendanceComparison}
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
                    {t('attendance.refresh')}
                  </Button>
                  {canEdit && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => setCsvImportDialogOpen(true)}
                      startIcon={<UploadIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: 1,
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      {t('attendance.importCSV')}
                    </Button>
                  )}
                  {canEdit && selectedGroupId && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleCopyToMonthlySummary}
                      startIcon={<ContentCopyIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: 1,
                        '&:hover': {
                          boxShadow: 3,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      {t('attendance.copyToMonthlySummary') || '複製到月結表'}
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Card>

          {departmentGroups.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('attendance.noPermissionMessage')}
            </Alert>
          ) : loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : selectedGroupId ? (
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
                        {t('attendance.employee')}
                      </TableCell>
                      {dates.map((date, index) => {
                        const bgColor = index % 2 === 0 ? '#1976d2' : '#d4af37';
                        return (
                          <TableCell 
                            key={date.format('YYYY-MM-DD')} 
                            align="center"
                            sx={{
                              bgcolor: bgColor,
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              py: 2,
                              minWidth: 120,
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
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.values(groupedData).map((userData) => (
                      <TableRow key={userData.user_id}>
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
                              {userData.employee_number}
                            </Typography>
                            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                              {userData.display_name}
                            </Typography>
                            {userData.position_code || userData.position_name || userData.position_name_zh ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', mt: 0.5 }}>
                                {userData.position_code || (i18n.language === 'en'
                                  ? (userData.position_name || userData.position_name_zh)
                                  : (userData.position_name_zh || userData.position_name))}
                              </Typography>
                            ) : null}
                          </Box>
                        </TableCell>
                        {dates.map(date => {
                          const dateStr = date.format('YYYY-MM-DD');
                          const item = userData.dates[dateStr];
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
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    // 確保 item 有 attendance_date，如果沒有則使用 dateStr
                                    const itemToEdit = item ? {
                                      ...item,
                                      attendance_date: item.attendance_date || dateStr, // 確保有 attendance_date
                                      clock_records: item.clock_records || [] // 確保有 clock_records 屬性，即使為空
                                    } : {
                                      user_id: userData.user_id,
                                      employee_number: userData.employee_number,
                                      display_name: userData.display_name,
                                      attendance_date: dateStr, // 明確設置 attendance_date
                                      schedule: null,
                                      attendance: null,
                                      clock_records: [] // 確保有 clock_records 屬性
                                    };
                                    console.log('Opening edit dialog with item:', itemToEdit);
                                    console.log('itemToEdit.clock_records:', itemToEdit.clock_records);
                                    console.log('itemToEdit.clock_records type:', typeof itemToEdit.clock_records);
                                    console.log('itemToEdit.clock_records isArray:', Array.isArray(itemToEdit.clock_records));
                                    handleOpenEditDialog(itemToEdit);
                                  }}
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
                                {item && (
                                  <>
                                    {item.schedule && (
                                      <Box sx={{ mb: 0.5 }}>
                                        {/* 只有在有開始時間或結束時間時才顯示排班時間 */}
                                        {(item.schedule.start_time || item.schedule.end_time) && (
                                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: '#1976d2', fontWeight: 600 }}>
                                            {t('attendance.roster')}: {item.schedule.start_time ? item.schedule.start_time.substring(0, 5) : '--:--'} - {item.schedule.end_time ? item.schedule.end_time.substring(0, 5) : '--:--'}
                                          </Typography>
                                        )}
                                        {/* 顯示假期類型（包括已批准的假期和排班中的假期） */}
                                        {item.schedule.leave_type_name_zh && (
                                          <Chip
                                            label={
                                              (() => {
                                                const leaveTypeDisplay = item.schedule.leave_type_name_zh;
                                                // 如果有時段信息，顯示上午/下午
                                                if (item.schedule.leave_session) {
                                                  const sessionText = item.schedule.leave_session === 'AM' 
                                                    ? t('schedule.morning') 
                                                    : t('schedule.afternoon');
                                                  return `${leaveTypeDisplay} (${sessionText})`;
                                                }
                                                return leaveTypeDisplay;
                                              })()
                                            }
                                            size="small"
                                            sx={{ 
                                              fontSize: '0.65rem', 
                                              height: '18px', 
                                              mt: (item.schedule.start_time || item.schedule.end_time) ? 0.25 : 0,
                                              bgcolor: item.schedule.is_approved_leave ? '#28a745' : '#d4af37', // 已批准的假期使用綠色
                                              color: 'white',
                                              '& .MuiChip-label': {
                                                color: 'white',
                                              },
                                            }}
                                          />
                                        )}
                                      </Box>
                                    )}
                                    {/* 顯示打卡時間 */}
                                    {(() => {
                                      // 確保 item 存在且有 employee_number 匹配
                                      if (!item) return null;
                                      
                                      const clockRecords = item.clock_records || [];
                                      const validRecords = clockRecords.filter(r => r.is_valid === true);
                                      const sortedRecords = [...validRecords].sort((a, b) => {
                                        const timeA = a.clock_time || '';
                                        const timeB = b.clock_time || '';
                                        return timeA.localeCompare(timeB);
                                      });
                                      
                                      // 如果有打卡記錄但沒有有效記錄，顯示總記錄數
                                      if (clockRecords.length > 0 && sortedRecords.length === 0) {
                                        return (
                                          <Box sx={{ mb: 0.5 }}>
                                            <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: '#999', mt: 0.5 }}>
                                              {t('attendance.totalRecords')}: {clockRecords.length}
                                            </Typography>
                                          </Box>
                                        );
                                      }
                                      
                                      // 如果有有效記錄，只顯示有效記錄
                                      if (sortedRecords.length > 0) {
                                        return (
                                          <>
                                            <Box sx={{ mb: 0.5 }}>
                                              {sortedRecords.map((record, idx) => {
                                                const timeStr = record.clock_time ? 
                                                  (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : 
                                                  '--:--';
                                                
                                                return (
                                                  <Typography 
                                                    key={idx}
                                                    variant="caption" 
                                                    display="block" 
                                                    sx={{ 
                                                      fontSize: '0.7rem', 
                                                      color: '#1976d2',
                                                      fontWeight: 600
                                                    }}
                                                  >
                                                    {timeStr}
                                                  </Typography>
                                                );
                                              })}
                                            </Box>
                                            {item.attendance?.status && (
                                              <Chip
                                                label={
                                                  item.attendance.status === 'late' && item.attendance.late_minutes
                                                    ? `${getStatusText(item.attendance.status)} (${item.attendance.late_minutes}${t('attendance.minutes')})`
                                                    : getStatusText(item.attendance.status)
                                                }
                                                size="small"
                                                color={getStatusColor(item.attendance.status)}
                                                sx={{ 
                                                  fontSize: '0.7rem', 
                                                  height: '22px', 
                                                  mb: 0.5,
                                                  fontWeight: 600,
                                                  boxShadow: 1,
                                                }}
                                              />
                                            )}
                                          </>
                                        );
                                      }
                                      
                                      return null;
                                    })()}
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
                {t('attendance.selectGroupFirst')}
              </Typography>
            </Card>
          )}
        </Paper>

        {/* 編輯考勤對話框 */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => {
            setEditDialogOpen(false);
            setEditingAttendance(null);
            setEditClockInTime(null);
            setEditClockOutTime(null);
            setEditTimeOffStart(null);
            setEditTimeOffEnd(null);
            setEditRemarks('');
            setEditStoreId(null);
            setEditClockRecords([]);
            setEditClockTimes([]);
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
            {t('attendance.editAttendance')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {editingAttendance && (
                <>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('attendance.employee')}: {editingAttendance.employee_number} - {editingAttendance.display_name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('attendance.date')}: {editingAttendance.attendance_date}
                    </Typography>
                    {editingAttendance.schedule && (editingAttendance.schedule.start_time || editingAttendance.schedule.end_time) && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('attendance.roster')}: {editingAttendance.schedule.start_time ? editingAttendance.schedule.start_time.substring(0, 5) : '--:--'} - {editingAttendance.schedule.end_time ? editingAttendance.schedule.end_time.substring(0, 5) : '--:--'}
                      </Typography>
                    )}
                  </Box>
                  <Divider />
                  {/* 店舖選擇 */}
                  {editingAttendance.schedule && (
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12}>
                        <FormControl fullWidth>
                          <InputLabel>{t('schedule.store')}</InputLabel>
                          <Select
                            value={editStoreId !== null && editStoreId !== undefined ? editStoreId : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditStoreId(value === '' || value === null || value === undefined ? null : Number(value));
                            }}
                            label={t('schedule.store')}
                          >
                            <MenuItem value="">
                              <em>{t('common.none')}</em>
                            </MenuItem>
                            {stores.map(store => (
                              <MenuItem key={store.id} value={store.id}>
                                {store.store_code} {store.store_short_name_ ? `(${store.store_short_name_})` : ''}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>
                  )}
                </>
              )}
              {/* 顯示所有未勾選的打卡記錄，允許選擇有效性 */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('attendance.clockRecords') || '打卡記錄'} - {t('attendance.selectValidRecords') || '選擇有效記錄'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {canEdit && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAddClockTime}
                        startIcon={<ScheduleIcon />}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem'
                        }}
                      >
                        {t('attendance.addClockTime') || '新增時間'}
                      </Button>
                    )}
                    {canEdit && editClockRecords && editClockRecords.length > 0 && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAutoSelectEarliest}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.75rem'
                        }}
                      >
                        {t('attendance.autoSelectEarliest') || '自動選取最早4個'}
                      </Button>
                    )}
                  </Box>
                </Box>
                {editClockRecords && editClockRecords.length > 0 ? (
                  <Box sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <List dense>
                      {editClockRecords
                        .sort((a, b) => {
                          const timeA = a.clock_time || '';
                          const timeB = b.clock_time || '';
                          return timeA.localeCompare(timeB);
                        })
                        .map((record, idx) => {
                          const timeStr = record.clock_time ? 
                            (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : 
                            '--:--';
                          const isValid = record.is_valid === true; // 明確檢查是否為 true
                          const editableTime = record.editableTime !== undefined ? record.editableTime : timeStr;
                          
                          return (
                            <ListItem 
                              key={record.id || record.tempId || `new-${idx}`}
                              sx={{
                                bgcolor: isValid ? 'action.selected' : 'transparent',
                                borderRadius: 1,
                                mb: 0.5,
                                p: 1,
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                <Checkbox
                                  checked={isValid}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    if (!canEdit) return;
                                    const updated = editClockRecords.map(r => {
                                      // 使用 id 或 tempId 來匹配記錄
                                      if (record.id) {
                                        if (r.id === record.id) {
                                          return { ...r, is_valid: e.target.checked === true };
                                        }
                                      } else if (record.tempId) {
                                        // 對於新記錄，使用 tempId 匹配
                                        if (r.tempId === record.tempId) {
                                          return { ...r, is_valid: e.target.checked === true };
                                        }
                                      }
                                      return r;
                                    });
                                    setEditClockRecords(updated);
                                  }}
                                  size="small"
                                />
                                <TextField
                                  label={t('attendance.clockTime') || '打卡時間'}
                                  value={editableTime}
                                  disabled={!canEdit}
                                  onChange={(e) => {
                                    if (!canEdit) return;
                                    const timeValue = e.target.value;
                                    // 允許輸入過程中的中間狀態
                                    let isValidInput = false;
                                    
                                    // 空字符串
                                    if (timeValue === '') {
                                      isValidInput = true;
                                    }
                                    // 單個數字 0-3（小時第一位，支援 0-32）
                                    else if (/^[0-3]$/.test(timeValue)) {
                                      isValidInput = true;
                                    }
                                    // 兩位數字 00-32（小時）
                                    else if (/^([0-2][0-9]|3[0-2])$/.test(timeValue)) {
                                      isValidInput = true;
                                    }
                                    // 小時加冒號，如 "12:" 或 "32:"
                                    else if (/^([0-2][0-9]|3[0-2]):$/.test(timeValue)) {
                                      isValidInput = true;
                                    }
                                    // 小時加冒號加單個數字 0-5（分鐘第一位），如 "12:3" 或 "32:3"
                                    else if (/^([0-2][0-9]|3[0-2]):[0-5]$/.test(timeValue)) {
                                      isValidInput = true;
                                    }
                                    // 完整的 HH:mm 格式
                                    else if (/^([0-2][0-9]|3[0-2]):[0-5][0-9]$/.test(timeValue)) {
                                      isValidInput = true;
                                    }
                                    
                                    if (isValidInput) {
                                      // 直接更新狀態，確保正確匹配記錄
                                      const updated = editClockRecords.map(r => {
                                        if (record.id) {
                                          // 有 id 的記錄，使用 id 匹配
                                          if (r.id === record.id) {
                                            return { ...r, editableTime: timeValue };
                                          }
                                        } else if (record.tempId) {
                                          // 新記錄（沒有 id），使用 tempId 匹配
                                          if (r.tempId === record.tempId) {
                                            return { ...r, editableTime: timeValue };
                                          }
                                        }
                                        return r;
                                      });
                                      setEditClockRecords(updated);
                                    }
                                  }}
                                  placeholder="HH:mm"
                                  size="small"
                                  sx={{ flex: 1, maxWidth: 150 }}
                                  inputProps={{
                                    maxLength: 5
                                  }}
                                />
                                {canEdit && (
                                  <IconButton
                                    color="error"
                                    size="small"
                                    onClick={() => {
                                      if (record.id) {
                                        // 有 id 的記錄，標記為無效
                                        handleRemoveClockTime(record.id);
                                      } else if (record.tempId) {
                                        // 沒有 id 的新記錄，使用 tempId 刪除
                                        handleRemoveClockTime(null, record.tempId);
                                      }
                                    }}
                                    sx={{ flexShrink: 0 }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Box>
                            </ListItem>
                          );
                        })}
                    </List>
                  </Box>
                ) : (
                  <Box sx={{ 
                    border: '1px solid', 
                    borderColor: 'divider', 
                    borderRadius: 1, 
                    p: 2,
                    textAlign: 'center',
                    bgcolor: 'grey.50'
                  }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('attendance.noClockRecords') || '暫無打卡記錄'}
                    </Typography>
                    {editingAttendance && editingAttendance.clock_records && editingAttendance.clock_records.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.75rem' }}>
                        {t('attendance.allRecordsValid', { count: editingAttendance.clock_records.length })}
                      </Typography>
                    )}
                    {editingAttendance && (!editingAttendance.clock_records || editingAttendance.clock_records.length === 0) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.75rem' }}>
                        {t('attendance.noRecordsImportCSV')}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', fontStyle: 'italic' }}>
                      {t('attendance.clickAddToCreate')}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <TextField
                      label={t('attendance.remarks')}
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      fullWidth
                      multiline
                      rows={3}
                    />
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleAutoCompare}
                      sx={{
                        minWidth: 'auto',
                        whiteSpace: 'nowrap',
                        mt: 0.5,
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                      startIcon={<CheckCircleIcon />}
                    >
                      {t('attendance.autoCompare')}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setEditDialogOpen(false);
                setEditingAttendance(null);
                setEditClockInTime(null);
                setEditClockOutTime(null);
                setEditTimeOffStart(null);
                setEditTimeOffEnd(null);
                setEditRemarks('');
                setEditStoreId(null);
                setEditClockRecords([]);
                setEditClockTimes([]);
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
              onClick={handleSaveAttendance} 
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

        {/* CSV 匯入對話框 */}
        <Dialog 
          open={csvImportDialogOpen} 
          onClose={() => {
            if (!importing) {
              setCsvImportDialogOpen(false);
              setCsvFile(null);
            }
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
              bgcolor: 'secondary.main',
              color: 'secondary.contrastText',
              fontWeight: 600,
              py: 2.5,
            }}
          >
            {t('attendance.importCSV')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-file-upload-attendance"
                type="file"
                onChange={handleCsvFileSelect}
                disabled={importing}
              />
              <label htmlFor="csv-file-upload-attendance">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadIcon />}
                  disabled={importing}
                  fullWidth
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    py: 1.5,
                  }}
                >
                  {csvFile ? csvFile.name : t('attendance.selectCSVFile')}
                </Button>
              </label>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setCsvImportDialogOpen(false);
                setCsvFile(null);
              }}
              disabled={importing}
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
              onClick={handleCsvImport} 
              variant="contained" 
              color="secondary"
              disabled={!csvFile || importing}
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
              {importing ? t('attendance.importing') : t('attendance.import')}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );

  return content;
};

export default Attendance;
