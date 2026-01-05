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
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const Schedule = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs().add(6, 'day'));
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
      const response = await axios.get('/api/schedules', {
        params: {
          department_group_id: selectedGroupId,
          start_date: startDate.format('YYYY-MM-DD'),
          end_date: endDate.format('YYYY-MM-DD')
        }
      });
      const schedulesData = response.data.schedules || [];
      console.log('Fetched schedules:', schedulesData);
      console.log('Schedule dates:', schedulesData.map(s => ({ id: s.id, user_id: s.user_id, schedule_date: s.schedule_date, type: typeof s.schedule_date })));
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
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    // 確保 user_id 類型一致（都轉為數字）
    const userIdNum = Number(userId);
    const found = schedules.find(s => {
      const sUserId = Number(s.user_id);
      // 處理 schedule_date 可能是 Date 對象或字符串的情況
      let sDateStr = s.schedule_date;
      if (sDateStr instanceof Date) {
        sDateStr = dayjs(sDateStr).format('YYYY-MM-DD');
      } else if (sDateStr && typeof sDateStr === 'string') {
        // 如果包含時間部分，只取日期部分
        sDateStr = sDateStr.split('T')[0];
      }
      return sUserId === userIdNum && sDateStr === dateStr;
    });
    if (found) {
      console.log('Found schedule:', { userId, dateStr, found });
    }
    return found;
  };

  const handleOpenEditDialog = (userId, date) => {
    if (!editMode || !canEdit) return;

    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const existingSchedule = getScheduleForUserAndDate(userId, dateStr);

    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      setEditStartTime(existingSchedule.start_time ? dayjs(existingSchedule.start_time, 'HH:mm:ss') : null);
      setEditEndTime(existingSchedule.end_time ? dayjs(existingSchedule.end_time, 'HH:mm:ss') : null);
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
      setEditLeaveTypeId('');
      setEditIsMorningLeave(false);
      setEditIsAfternoonLeave(false);
    }
    setEditDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;

    try {
      const scheduleData = {
        user_id: editingSchedule.user_id,
        department_group_id: selectedGroupId,
        schedule_date: editingSchedule.schedule_date,
        start_time: editStartTime ? editStartTime.format('HH:mm:ss') : null,
        end_time: editEndTime ? editEndTime.format('HH:mm:ss') : null,
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
      setEditLeaveTypeId('');
      setEditIsMorningLeave(false);
      setEditIsAfternoonLeave(false);
      fetchSchedules();
      
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
        selectedUsers.forEach(userId => {
          schedulesData.push({
            user_id: userId,
            schedule_date: dayjs(date).format('YYYY-MM-DD'),
            is_morning_leave: batchMorningLeave,
            is_afternoon_leave: batchAfternoonLeave
          });
        });
      });

      await axios.post('/api/schedules/batch', { schedules: schedulesData });
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.batchUpdateSuccess')
      });
      
      setBatchEditDialogOpen(false);
      setSelectedUsers([]);
      setSelectedDates([]);
      setBatchMorningLeave(false);
      setBatchAfternoonLeave(false);
      fetchSchedules();
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
        Swal.fire({
          icon: 'success',
          title: t('schedule.success'),
          text: t('schedule.deleteSuccess')
        });
        fetchSchedules();
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
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    
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
                                          {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
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
                                          {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
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
                  <TimePicker
                    label={t('schedule.endTime')}
                    value={editEndTime}
                    onChange={(newValue) => setEditEndTime(newValue)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
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
                      checked={selectedDates.some(d => dayjs(d).isSame(date, 'day'))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDates([...selectedDates, date]);
                        } else {
                          setSelectedDates(selectedDates.filter(d => !dayjs(d).isSame(date, 'day')));
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
