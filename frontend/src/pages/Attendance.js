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
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Upload as UploadIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  // 默認設定為當天到當月最後一天
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').endOf('month'));
  const [loading, setLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [editClockInTime, setEditClockInTime] = useState(null);
  const [editClockOutTime, setEditClockOutTime] = useState(null);
  const [editTimeOffStart, setEditTimeOffStart] = useState(null);
  const [editTimeOffEnd, setEditTimeOffEnd] = useState(null);
  const [editClockRecords, setEditClockRecords] = useState([]); // 存儲所有打卡記錄，用於選擇有效性
  const [editClockTimes, setEditClockTimes] = useState([]); // 存儲可編輯的打卡時間列表 [{id, time, is_valid}, ...]
  const [editStoreId, setEditStoreId] = useState(null);
  const [stores, setStores] = useState([]);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [canEdit, setCanEdit] = useState(false); // 檢查用戶是否為 approver1、approver2、approver3（不包含 checker）
  const [pendingError, setPendingError] = useState(null); // 待顯示的錯誤訊息
  const [isEditMode, setIsEditMode] = useState(false); // 編輯模式狀態

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

  // 處理開始日期變更，自動將結束日期設定為該月的最後一天
  const handleStartDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) return;
    
    setStartDate(newValue);
    
    // 自動將結束日期設定為該月的最後一天
    const lastDayOfMonth = newValue.endOf('month');
    setEndDate(lastDayOfMonth);
  };

  // 處理結束日期變更，確保在同一個月內
  const handleEndDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) return;
    
    // 如果開始日期存在，確保結束日期在同一個月
    if (startDate && startDate.isValid()) {
      const startMonth = startDate.month();
      const startYear = startDate.year();
      const endMonth = newValue.month();
      const endYear = newValue.year();
      
      // 如果不在同一個月，調整為該月的最後一天
      if (startMonth !== endMonth || startYear !== endYear) {
        const lastDayOfMonth = startDate.endOf('month');
        setEndDate(lastDayOfMonth);
        return;
      }
    }
    
    setEndDate(newValue);
  };

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
      editableTime: record.clock_time ? (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : '', // 可編輯的時間字符串
      editableBranchCode: record.branch_code || '', // 可編輯的分行代碼
      editableRemarks: record.remarks || '' // 可編輯的備註
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
      editableBranchCode: '', // 可編輯的分行代碼
      editableRemarks: '', // 可編輯的備註
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
      const timeUpdates = []; // 更新時間、branch_code 和 remarks 的記錄
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

          // 處理 branch_code 和 remarks 更新（如果有修改）
          const originalBranchCode = record.branch_code || '';
          const originalRemarks = record.remarks || '';
          const editableBranchCode = record.editableBranchCode !== undefined ? record.editableBranchCode : originalBranchCode;
          const editableRemarks = record.editableRemarks !== undefined ? record.editableRemarks : originalRemarks;
          
          // 檢查是否有 branch_code 或 remarks 的變化
          const branchCodeChanged = editableBranchCode !== originalBranchCode;
          const remarksChanged = editableRemarks !== originalRemarks;
          
          if (branchCodeChanged || remarksChanged) {
            // branch_code 或 remarks 有變化，需要更新
            const existingUpdate = timeUpdates.find(u => u.id === record.id);
            if (existingUpdate) {
              // 如果已經有時間更新，添加 branch_code 和 remarks
              if (branchCodeChanged) {
                existingUpdate.branch_code = editableBranchCode || null;
              }
              if (remarksChanged) {
                existingUpdate.remarks = editableRemarks || null;
              }
            } else {
              // 如果時間更新列表中沒有這個記錄，創建一個新的更新項
              const updateItem = { id: record.id };
              if (branchCodeChanged) {
                updateItem.branch_code = editableBranchCode || null;
              }
              if (remarksChanged) {
                updateItem.remarks = editableRemarks || null;
              }
              timeUpdates.push(updateItem);
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
            const editableBranchCode = record.editableBranchCode !== undefined ? record.editableBranchCode : '';
            const editableRemarks = record.editableRemarks !== undefined ? record.editableRemarks : '';
            creates.push({
              employee_number: editingAttendance.employee_number,
              user_id: editingAttendance.user_id,
              department_group_id: selectedGroupId,
              attendance_date: editingAttendance.attendance_date,
              clock_time: timeStr,
              branch_code: editableBranchCode || null,
              remarks: editableRemarks || null
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
        await axios.put('/api/attendances/update-clock-records-details', {
          clock_records: timeUpdates
        });
      }

      if (creates.length > 0) {
        // 先創建所有記錄，然後批量更新 branch_code 和 remarks
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
        
        // 如果有新記錄需要更新 branch_code 或 remarks，查詢並更新
        const recordsToUpdate = [];
        for (const createData of creates) {
          if (createData.branch_code || createData.remarks) {
            // 查詢剛創建的記錄（通過員工編號、日期和時間）
            const clockTimeStr = createData.clock_time.includes(':') && createData.clock_time.split(':').length === 2 
              ? createData.clock_time + ':00' 
              : createData.clock_time;
            const clockTimeForMatch = clockTimeStr.substring(0, 5); // HH:mm
            
            try {
              const recordsResponse = await axios.get('/api/attendances/user-clock-records', {
                params: {
                  employee_number: createData.employee_number,
                  attendance_date: createData.attendance_date
                }
              });
              
              // 找到匹配的記錄（通過時間匹配，選擇最接近的記錄）
              const matchingRecord = recordsResponse.data.clock_records?.find(r => {
                const recordTime = r.clock_time ? (typeof r.clock_time === 'string' ? r.clock_time.substring(0, 5) : r.clock_time) : '';
                return recordTime === clockTimeForMatch;
              });
              
              if (matchingRecord && matchingRecord.id) {
                const updateData = { id: matchingRecord.id };
                if (createData.branch_code) {
                  updateData.branch_code = createData.branch_code;
                }
                if (createData.remarks) {
                  updateData.remarks = createData.remarks;
                }
                recordsToUpdate.push(updateData);
              }
            } catch (error) {
              console.error('Error querying new record for update:', error);
              // 繼續處理其他記錄
            }
          }
        }
        
        // 批量更新新創建的記錄的 branch_code 和 remarks
        if (recordsToUpdate.length > 0) {
          await axios.put('/api/attendances/update-clock-records-details', {
            clock_records: recordsToUpdate
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
                  onChange={handleStartDateChange}
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
                  onChange={handleEndDateChange}
                  format="DD/MM/YYYY"
                  minDate={startDate?.startOf('month')}
                  maxDate={startDate?.endOf('month')}
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
                    <>
                      <Button
                        variant={isEditMode ? "contained" : "outlined"}
                        color={isEditMode ? "success" : "primary"}
                        onClick={() => setIsEditMode(!isEditMode)}
                        startIcon={<EditIcon />}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          boxShadow: isEditMode ? 3 : 1,
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s',
                          },
                        }}
                      >
                        {isEditMode ? t('schedule.exitEdit') : t('common.edit')}
                      </Button>
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
                    </>
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
                          bgcolor: '#2c3e50',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          py: 2.5,
                          px: 2,
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                          borderRight: '2px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {t('attendance.employee')}
                      </TableCell>
                      {dates.map((date, index) => {
                        const bgColor = index % 2 === 0 ? '#34495e' : '#2c3e50';
                        return (
                          <TableCell 
                            key={date.format('YYYY-MM-DD')} 
                            align="center"
                            sx={{
                              bgcolor: bgColor,
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                              py: 2.5,
                              px: 1.5,
                              minWidth: 120,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: index % 2 === 0 ? '#3d566e' : '#354a5f',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
                              },
                            }}
                          >
                            <Box>
                              <Typography variant="body2" display="block" sx={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                                {formatDateDisplay(date)}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ opacity: 0.85, mt: 0.5, fontSize: '0.7rem', letterSpacing: '0.3px' }}>
                                {date.format('ddd')}
                              </Typography>
                            </Box>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groupMembers.map((member) => {
                      const userData = groupedData[member.id] || {
                        user_id: member.id,
                        employee_number: member.employee_number,
                        display_name: member.display_name || member.name_zh || member.name,
                        position_code: member.position_code || null,
                        position_name: member.position_name || null,
                        position_name_zh: member.position_name_zh || null,
                        dates: {}
                      };
                      return (
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
                            {canEdit ? (
                              <Typography 
                                variant="body2" 
                                fontWeight="bold" 
                                component={Link}
                                to={`/monthly-attendance-summary?employee_number=${userData.employee_number}`}
                                sx={{ 
                                  color: 'primary.main', 
                                  mb: 0.5,
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                    color: 'primary.dark',
                                  },
                                  cursor: 'pointer',
                                }}
                              >
                                {userData.employee_number}
                              </Typography>
                            ) : (
                              <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main', mb: 0.5 }}>
                                {userData.employee_number}
                              </Typography>
                            )}
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
                                {isEditMode && (
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
                                      borderColor: '#bdbdbd',
                                      color: '#bdbdbd',
                                      '&:hover': {
                                        bgcolor: '#e0e0e0',
                                        color: '#757575',
                                        transform: 'scale(1.05)',
                                        transition: 'all 0.2s',
                                      },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </Button>
                                )}
                                {item && (
                                  <>
                                    {item.schedule && (
                                      <Box sx={{ mb: 0.5 }}>
                                        {/* 只有在有開始時間或結束時間時才顯示排班時間 */}
                                        {(item.schedule.start_time || item.schedule.end_time) && (
                                          <Box
                                            component="div"
                                            sx={{
                                              display: 'inline-block',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              color: '#1565c0', // 深藍色文字
                                              padding: '2px 6px'
                                            }}
                                          >
                                            {item.schedule.start_time ? item.schedule.start_time.substring(0, 5) : '--:--'} - {item.schedule.end_time ? item.schedule.end_time.substring(0, 5) : '--:--'}
                                          </Box>
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
                                              bgcolor: '#c62828', // 偏深紅色
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
                                            <Box sx={{ mb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                                              {sortedRecords.map((record, idx) => {
                                                const timeStr = record.clock_time ? 
                                                  (typeof record.clock_time === 'string' ? record.clock_time.substring(0, 5) : record.clock_time) : 
                                                  '--:--';
                                                
                                                return (
                                                  <Typography 
                                                    key={idx}
                                                    variant="caption" 
                                                    sx={{ 
                                                      fontSize: '0.7rem', 
                                                      color: '#757575',
                                                      fontWeight: 400
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
                    );})}
                    {/* 統計行：顯示每日 FT 和 PT 數量（與 Schedule 一致） */}
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
                        let ftCount = 0;
                        let ptCount = 0;
                        groupMembers.forEach(member => {
                          const item = groupedData[member.id]?.dates[dateStr];
                          const hasScheduleTime = item?.schedule && (
                            item.schedule.start_time || item.schedule.end_time
                          );
                          if (hasScheduleTime) {
                            const employmentMode = member.position_employment_mode || member.employment_mode;
                            if (employmentMode === 'FT') ftCount++;
                            else if (employmentMode === 'PT') ptCount++;
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
                              <em>{t('schedule.selectStore')}</em>
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
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
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
                                  <TextField
                                    label={t('attendance.branchCode') || '分行代碼'}
                                    value={record.editableBranchCode !== undefined ? record.editableBranchCode : (record.branch_code || '')}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      if (!canEdit) return;
                                      const updated = editClockRecords.map(r => {
                                        if (record.id) {
                                          if (r.id === record.id) {
                                            return { ...r, editableBranchCode: e.target.value };
                                          }
                                        } else if (record.tempId) {
                                          if (r.tempId === record.tempId) {
                                            return { ...r, editableBranchCode: e.target.value };
                                          }
                                        }
                                        return r;
                                      });
                                      setEditClockRecords(updated);
                                    }}
                                    size="small"
                                    sx={{ flex: 1, maxWidth: 120 }}
                                  />
                                  <TextField
                                    label={t('attendance.remarks') || '備註'}
                                    value={record.editableRemarks !== undefined ? record.editableRemarks : (record.remarks || '')}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      if (!canEdit) return;
                                      const updated = editClockRecords.map(r => {
                                        if (record.id) {
                                          if (r.id === record.id) {
                                            return { ...r, editableRemarks: e.target.value };
                                          }
                                        } else if (record.tempId) {
                                          if (r.tempId === record.tempId) {
                                            return { ...r, editableRemarks: e.target.value };
                                          }
                                        }
                                        return r;
                                      });
                                      setEditClockRecords(updated);
                                    }}
                                    size="small"
                                    sx={{ flex: 1 }}
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
