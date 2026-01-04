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

  useEffect(() => {
    fetchDepartmentGroups();
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
    try {
      const response = await axios.get(`/api/schedules/groups/${selectedGroupId}/members`);
      const members = response.data.members || [];
      members.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setGroupMembers(members);
    } catch (error) {
      console.error('Fetch group members error:', error);
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
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Fetch schedules error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: t('schedule.fetchSchedulesFailed')
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
    return schedules.find(s => 
      s.user_id === userId && s.schedule_date === dateStr
    );
  };

  const handleToggleSchedule = async (userId, date, field) => {
    if (!editMode || !canEdit) return;

    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const existingSchedule = getScheduleForUserAndDate(userId, dateStr);

    try {
      if (existingSchedule) {
        // 更新現有記錄
        const updateData = {
          ...existingSchedule,
          [field]: !existingSchedule[field]
        };
        await axios.put(`/api/schedules/${existingSchedule.id}`, {
          is_morning_leave: updateData.is_morning_leave,
          is_afternoon_leave: updateData.is_afternoon_leave
        });
      } else {
        // 建立新記錄
        await axios.post('/api/schedules', {
          user_id: userId,
          department_group_id: selectedGroupId,
          schedule_date: dateStr,
          is_morning_leave: field === 'is_morning_leave' ? true : false,
          is_afternoon_leave: field === 'is_afternoon_leave' ? true : false
        });
      }
      fetchSchedules();
    } catch (error) {
      console.error('Toggle schedule error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
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
                                  <Checkbox
                                    size="small"
                                    checked={schedule?.is_morning_leave || false}
                                    onChange={() => handleToggleSchedule(member.id, date, 'is_morning_leave')}
                                    sx={{ p: 0.5 }}
                                  />
                                  <Typography variant="caption">{t('schedule.morning')}</Typography>
                                  <Checkbox
                                    size="small"
                                    checked={schedule?.is_afternoon_leave || false}
                                    onChange={() => handleToggleSchedule(member.id, date, 'is_afternoon_leave')}
                                    sx={{ p: 0.5 }}
                                  />
                                  <Typography variant="caption">{t('schedule.afternoon')}</Typography>
                                  {schedule && (
                                    <IconButton
                                      size="small"
                                      onClick={() => handleDeleteSchedule(schedule.id)}
                                      color="error"
                                    >
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  )}
                                </>
                              ) : (
                                <>
                                  {schedule?.is_morning_leave && (
                                    <Chip label={t('schedule.morning')} size="small" color="warning" />
                                  )}
                                  {schedule?.is_afternoon_leave && (
                                    <Chip label={t('schedule.afternoon')} size="small" color="error" />
                                  )}
                                  {!schedule?.is_morning_leave && !schedule?.is_afternoon_leave && (
                                    <Typography variant="caption" color="text.secondary">
                                      -
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
