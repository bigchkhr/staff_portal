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
  useMediaQuery
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
  Schedule as ScheduleIcon
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

const Attendance = () => {
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
    setEditingAttendance(item);
    setEditClockInTime(item.attendance?.clock_in_time ? dayjs(item.attendance.clock_in_time, 'HH:mm:ss') : null);
    setEditClockOutTime(item.attendance?.clock_out_time ? dayjs(item.attendance.clock_out_time, 'HH:mm:ss') : null);
    setEditTimeOffStart(item.attendance?.time_off_start ? dayjs(item.attendance.time_off_start, 'HH:mm:ss') : null);
    setEditTimeOffEnd(item.attendance?.time_off_end ? dayjs(item.attendance.time_off_end, 'HH:mm:ss') : null);
    setEditRemarks(item.attendance?.remarks || '');
    setEditDialogOpen(true);
  };

  const handleSaveAttendance = async () => {
    if (!editingAttendance) return;

    try {
      const attendanceData = {
        user_id: editingAttendance.user_id,
        department_group_id: selectedGroupId,
        attendance_date: editingAttendance.attendance_date,
        clock_in_time: editClockInTime ? editClockInTime.format('HH:mm:ss') : null,
        clock_out_time: editClockOutTime ? editClockOutTime.format('HH:mm:ss') : null,
        time_off_start: editTimeOffStart ? editTimeOffStart.format('HH:mm:ss') : null,
        time_off_end: editTimeOffEnd ? editTimeOffEnd.format('HH:mm:ss') : null,
        remarks: editRemarks || null
      };

      if (editingAttendance.attendance?.id) {
        // 更新現有記錄
        await axios.put(`/api/attendances/${editingAttendance.attendance.id}`, attendanceData);
      } else {
        // 建立新記錄
        await axios.post('/api/attendances', attendanceData);
      }

      setEditDialogOpen(false);
      setEditingAttendance(null);
      setEditClockInTime(null);
      setEditClockOutTime(null);
      setEditTimeOffStart(null);
      setEditTimeOffEnd(null);
      setEditRemarks('');
      
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

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
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
                                  onClick={() => handleOpenEditDialog(item || {
                                    user_id: userData.user_id,
                                    employee_number: userData.employee_number,
                                    display_name: userData.display_name,
                                    attendance_date: dateStr,
                                    schedule: null,
                                    attendance: null
                                  })}
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
                                    {item.attendance && (
                                      <>
                                        <Box sx={{ mb: 0.5 }}>
                                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: '#1976d2', fontWeight: 600 }}>
                                            {t('attendance.clockIn')}: {item.attendance.clock_in_time ? item.attendance.clock_in_time.substring(0, 5) : '--:--'}
                                          </Typography>
                                          <Typography variant="caption" display="block" sx={{ fontSize: '0.7rem', color: '#1976d2', fontWeight: 600 }}>
                                            {t('attendance.clockOut')}: {item.attendance.clock_out_time ? item.attendance.clock_out_time.substring(0, 5) : '--:--'}
                                          </Typography>
                                          {item.attendance.time_off_start && item.attendance.time_off_end && (
                                            <Typography variant="caption" display="block" sx={{ fontSize: '0.65rem', color: '#d4af37', mt: 0.25 }}>
                                              {t('attendance.timeOff')}: {item.attendance.time_off_start.substring(0, 5)} - {item.attendance.time_off_end.substring(0, 5)}
                                            </Typography>
                                          )}
                                        </Box>
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
                                        {item.attendance.id && (
                                          <IconButton
                                            size="small"
                                            onClick={() => handleDeleteAttendance(item.attendance.id)}
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
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TimePicker
                    label={t('attendance.clockIn')}
                    value={editClockInTime}
                    onChange={(newValue) => setEditClockInTime(newValue)}
                    ampm={true}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TimePicker
                    label={t('attendance.clockOut')}
                    value={editClockOutTime}
                    onChange={(newValue) => setEditClockOutTime(newValue)}
                    ampm={true}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TimePicker
                    label={t('attendance.timeOffStart')}
                    value={editTimeOffStart}
                    onChange={(newValue) => setEditTimeOffStart(newValue)}
                    ampm={true}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TimePicker
                    label={t('attendance.timeOffEnd')}
                    value={editTimeOffEnd}
                    onChange={(newValue) => setEditTimeOffEnd(newValue)}
                    ampm={true}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </Grid>
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
      </Container>
    </LocalizationProvider>
  );
};

export default Attendance;
