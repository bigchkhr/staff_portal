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
  ListItemSecondaryAction
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
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchDepartmentGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers();
      fetchAttendanceComparison();
    }
  }, [selectedGroupId, startDate, endDate]);

  const fetchDepartmentGroups = async () => {
    try {
      const response = await axios.get('/api/schedules/accessible-groups');
      setDepartmentGroups(response.data.groups || []);
      
      if (response.data.groups && response.data.groups.length === 1) {
        setSelectedGroupId(response.data.groups[0].id);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: t('attendance.fetchGroupsFailed')
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
        title: t('attendance.error'),
        text: error.response?.data?.message || t('attendance.fetchMembersFailed')
      });
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

  const handleOpenEditDialog = (item) => {
    console.log('handleOpenEditDialog - item:', item);
    console.log('item.attendance_date:', item?.attendance_date);
    
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
        text: '缺少考勤日期信息，請重新選擇'
      });
      return;
    }
    
    setEditingAttendance(item);
    setEditClockInTime(item.attendance?.clock_in_time ? dayjs(item.attendance.clock_in_time, 'HH:mm:ss') : null);
    setEditClockOutTime(item.attendance?.clock_out_time ? dayjs(item.attendance.clock_out_time, 'HH:mm:ss') : null);
    setEditTimeOffStart(item.attendance?.time_off_start ? dayjs(item.attendance.time_off_start, 'HH:mm:ss') : null);
    setEditTimeOffEnd(item.attendance?.time_off_end ? dayjs(item.attendance.time_off_end, 'HH:mm:ss') : null);
    setEditRemarks(item.attendance?.remarks || '');
    
    // 初始化打卡記錄列表，顯示所有記錄（包括有效的和無效的）
    const clockRecords = item?.clock_records || [];
    console.log('Opening edit dialog, clock_records:', clockRecords);
    console.log('clock_records length:', clockRecords.length);
    
    // 顯示所有記錄，保留它們當前的 is_valid 狀態
    setEditClockRecords(clockRecords.map(record => ({
      ...record,
      is_valid: record.is_valid === true // 保留當前的有效性狀態
    })));
    setEditDialogOpen(true);
  };

  // 自動勾選最早的4個時間
  const handleAutoSelectEarliest = () => {
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

  const handleSaveAttendance = async () => {
    if (!editingAttendance) return;

    try {
      // 如果有打卡記錄，更新它們的有效性
      // 使用 editClockRecords 中的所有記錄（因為現在顯示所有記錄）
      if (editClockRecords && editClockRecords.length > 0) {
        // 構建更新列表：只包含有 id 的記錄
        const updates = editClockRecords
          .filter(record => record.id) // 只包含有 id 的記錄
          .map(record => ({
            id: record.id,
            is_valid: record.is_valid === true // 明確轉換為 boolean
          }));
        
        console.log('Saving clock records updates:', updates);
        
        if (updates.length > 0) {
          // 調用 API 更新打卡記錄的有效性
          await axios.put('/api/attendances/update-clock-records', {
            clock_records: updates
          });
        }
      }

      // 只有在有手動輸入的時間或備註時，才更新考勤記錄
      const hasManualTimeInput = editClockInTime || editClockOutTime || editTimeOffStart || editTimeOffEnd;
      const hasRemarks = editRemarks && editRemarks.trim() !== '';
      
      if (hasManualTimeInput || hasRemarks) {
        // 確保有必要的參數：優先使用 employee_number，如果沒有則使用 user_id
        console.log('Saving attendance - editingAttendance:', editingAttendance);
        console.log('attendance_date:', editingAttendance?.attendance_date);
        
        if (!editingAttendance || !editingAttendance.attendance_date) {
          const errorMsg = editingAttendance 
            ? '缺少必要的參數：attendance_date' 
            : '編輯數據不存在，請重新打開編輯對話框';
          throw new Error(errorMsg);
        }
        
        if (!editingAttendance.employee_number && !editingAttendance.user_id) {
          throw new Error('缺少必要的參數：employee_number 或 user_id');
        }

        const attendanceData = {
          employee_number: editingAttendance.employee_number, // 優先使用 employee_number
          user_id: editingAttendance.user_id, // 如果沒有 employee_number，使用 user_id
          department_group_id: selectedGroupId,
          attendance_date: editingAttendance.attendance_date, // 確保使用正確的日期格式
          clock_in_time: editClockInTime ? editClockInTime.format('HH:mm:ss') : null,
          clock_out_time: editClockOutTime ? editClockOutTime.format('HH:mm:ss') : null,
          time_off_start: editTimeOffStart ? editTimeOffStart.format('HH:mm:ss') : null,
          time_off_end: editTimeOffEnd ? editTimeOffEnd.format('HH:mm:ss') : null,
          remarks: editRemarks || null
        };
        
        console.log('Sending attendanceData:', attendanceData);

        if (editingAttendance.attendance?.id) {
          // 更新現有記錄
          await axios.put(`/api/attendances/${editingAttendance.attendance.id}`, attendanceData);
        } else if (hasManualTimeInput) {
          // 建立新記錄（只有在有時間輸入時）
          await axios.post('/api/attendances', attendanceData);
        }
      }

      setEditDialogOpen(false);
      setEditingAttendance(null);
      setEditClockInTime(null);
      setEditClockOutTime(null);
      setEditTimeOffStart(null);
      setEditTimeOffEnd(null);
      setEditRemarks('');
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
        text: error.response?.data?.message || t('attendance.updateFailed')
      });
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
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error(t('attendance.csvEmptyOrInvalid'));
      }

      // 解析 CSV（假設第一行是標題）
      const headers = lines[0].split(',').map(h => h.trim());
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 6) continue; // 跳過不完整的行

        // 根據 POS CSV 格式：欄A=employee_number, 欄B=name, 欄C=branch_code, 欄D=date, 欄E=clock_time, 欄F=in_out
        const row = {
          employee_number: values[0] || '',
          name: values[1] || '',
          branch_code: values[2] || '',
          date: values[3] || '',
          clock_time: values[4] || '',
          in_out: values[5] || ''
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
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || error.message || t('attendance.csvImportFailed')
      });
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
                                      attendance_date: item.attendance_date || dateStr // 確保有 attendance_date
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
                                        <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: '#1976d2', fontWeight: 600 }}>
                                          {t('attendance.roster')}: {item.schedule.start_time ? item.schedule.start_time.substring(0, 5) : '--:--'} - {item.schedule.end_time ? item.schedule.end_time.substring(0, 5) : '--:--'}
                                        </Typography>
                                        {item.schedule.leave_type_name_zh && (
                                          <Chip
                                            label={item.schedule.leave_type_name_zh}
                                            size="small"
                                            sx={{ 
                                              fontSize: '0.65rem', 
                                              height: '18px', 
                                              mt: 0.25,
                                              bgcolor: '#d4af37',
                                              color: 'white',
                                              '& .MuiChip-label': {
                                                color: 'white',
                                              },
                                            }}
                                          />
                                        )}
                                      </Box>
                                    )}
                                    {/* 顯示打卡時間 - 只顯示有效時間 */}
                                    {(() => {
                                      // 確保 item 存在且有 employee_number 匹配
                                      if (!item) return null;
                                      
                                      // 只顯示有效的 clock_records，按時間排序
                                      const clockRecords = item.clock_records || [];
                                      const validRecords = clockRecords.filter(r => r.is_valid === true);
                                      const sortedRecords = [...validRecords].sort((a, b) => {
                                        const timeA = a.clock_time || '';
                                        const timeB = b.clock_time || '';
                                        return timeA.localeCompare(timeB);
                                      });
                                      
                                      if (sortedRecords.length === 0) {
                                        return null;
                                      }
                                      
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
                                            {clockRecords.length > 0 && (
                                              <Typography variant="caption" display="block" sx={{ fontSize: '0.6rem', color: '#999', mt: 0.5 }}>
                                                {t('attendance.totalRecords')}: {clockRecords.length}
                                              </Typography>
                                            )}
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
            setEditClockRecords([]);
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
                    {editingAttendance.schedule && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('attendance.roster')}: {editingAttendance.schedule.start_time ? editingAttendance.schedule.start_time.substring(0, 5) : '--:--'} - {editingAttendance.schedule.end_time ? editingAttendance.schedule.end_time.substring(0, 5) : '--:--'}
                      </Typography>
                    )}
                  </Box>
                  <Divider />
                </>
              )}
              {/* 顯示所有未勾選的打卡記錄，允許選擇有效性 */}
              {editClockRecords && editClockRecords.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('attendance.clockRecords') || '打卡記錄'} - {t('attendance.selectValidRecords') || '選擇有效記錄'}
                    </Typography>
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
                  </Box>
                  <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
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
                          const isValid = record.is_valid || false;
                          
                          return (
                            <ListItem 
                              key={record.id || idx}
                              sx={{
                                bgcolor: isValid ? 'action.selected' : 'transparent',
                                borderRadius: 1,
                                mb: 0.5,
                                '&:hover': {
                                  bgcolor: 'action.hover'
                                }
                              }}
                            >
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={isValid}
                                    onChange={(e) => {
                                      const updated = [...editClockRecords];
                                      // 找到對應的記錄並更新
                                      const recordIndex = updated.findIndex(r => r.id === record.id);
                                      if (recordIndex >= 0) {
                                        updated[recordIndex].is_valid = e.target.checked;
                                        setEditClockRecords(updated);
                                      }
                                    }}
                                    size="small"
                                  />
                                }
                                label={
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {timeStr}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          );
                        })}
                    </List>
                  </Box>
                </>
              ) : (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('attendance.noClockRecords') || '暫無打卡記錄'}
                  </Typography>
                  {editingAttendance && editingAttendance.clock_records && editingAttendance.clock_records.length > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.75rem' }}>
                      （共有 {editingAttendance.clock_records.length} 條打卡記錄，但所有記錄都已被標記為有效）
                    </Typography>
                  )}
                  {editingAttendance && (!editingAttendance.clock_records || editingAttendance.clock_records.length === 0) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: '0.75rem' }}>
                      （該日期暫無打卡記錄，請先匯入 CSV 數據）
                    </Typography>
                  )}
                </Box>
              )}
              
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12}>
                  <TextField
                    label={t('attendance.remarks')}
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                  />
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
                setEditClockRecords([]);
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
              <Typography variant="body2" color="text.secondary">
                {t('attendance.csvFormatDescription')}
              </Typography>
              <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {t('attendance.csvFormatExample')}
                </Typography>
              </Box>
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
