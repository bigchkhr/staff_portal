import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  InputLabel,
  Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Search as SearchIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import UserSearchDialog from '../components/UserSearchDialog';

const AdminOutdoorWorkPaperFlow = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    user_id: '',
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
    total_hours: '',
    start_location: '',
    end_location: '',
    transportation: '',
    expense: '',
    purpose: ''
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  // 當選擇的用戶改變時，更新表單數據
  useEffect(() => {
    if (selectedUser) {
      setFormData(prev => ({ ...prev, user_id: selectedUser.id }));
    }
  }, [selectedUser]);

  // 計算總時數
  const calculateTotalHours = (startDate, startTime, endDate, endTime) => {
    if (!startDate || !startTime || !endDate || !endTime) return 0;

    const start = dayjs(startDate).hour(startTime.hour()).minute(startTime.minute());
    const end = dayjs(endDate).hour(endTime.hour()).minute(endTime.minute());
    
    const diffInMinutes = end.diff(start, 'minute');
    const diffInHours = diffInMinutes / 60;
    
    return diffInHours > 0 ? diffInHours : 0;
  };

  // 當日期或時間改變時，自動計算總時數
  useEffect(() => {
    if (formData.start_date && formData.start_time && formData.end_date && formData.end_time) {
      const totalHours = calculateTotalHours(
        formData.start_date,
        formData.start_time,
        formData.end_date,
        formData.end_time
      );
      setFormData(prev => ({ ...prev, total_hours: totalHours > 0 ? totalHours.toFixed(2) : '' }));
    }
  }, [formData.start_date, formData.start_time, formData.end_date, formData.end_time]);

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
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.user_id || !formData.start_date || !formData.start_time || 
        !formData.end_date || !formData.end_time || !formData.total_hours) {
      setLoading(false);
      await Swal.fire({
        icon: 'error',
        title: t('adminOutdoorWorkPaperFlow.validationFailed'),
        text: t('adminOutdoorWorkPaperFlow.fillAllFields'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
      return;
    }

    try {
      const payload = {
        user_id: formData.user_id,
        start_date: formData.start_date.format('YYYY-MM-DD'),
        start_time: formData.start_time.format('HH:mm:ss'),
        end_date: formData.end_date.format('YYYY-MM-DD'),
        end_time: formData.end_time.format('HH:mm:ss'),
        total_hours: parseFloat(formData.total_hours),
        start_location: formData.start_location || null,
        end_location: formData.end_location || null,
        transportation: formData.transportation || null,
        expense: formData.expense ? parseFloat(formData.expense) : null,
        purpose: formData.purpose || null,
        flow_type: 'paper-flow'
      };

      const response = await axios.post('/api/outdoor-work', payload);
      
      // 使用 Sweet Alert 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: t('adminOutdoorWorkPaperFlow.applicationSuccess'),
        text: t('adminOutdoorWorkPaperFlow.applicationSubmitted', { transactionId: response.data.application.transaction_id }),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      setFormData({
        user_id: '',
        start_date: null,
        start_time: null,
        end_date: null,
        end_time: null,
        total_hours: '',
        start_location: '',
        end_location: '',
        transportation: '',
        expense: '',
        purpose: ''
      });
      setSelectedUser(null);
    } catch (error) {
      // 使用 Sweet Alert 顯示錯誤訊息
      await Swal.fire({
        icon: 'error',
        title: t('adminOutdoorWorkPaperFlow.submitFailed'),
        text: error.response?.data?.message || t('adminOutdoorWorkPaperFlow.submitError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  // 如果 selectedUser 已經設置，使用它；否則從表單數據中查找
  const displayUser = selectedUser || users.find(u => u.id === parseInt(formData.user_id));

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('adminOutdoorWorkPaperFlow.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('adminOutdoorWorkPaperFlow.description')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ mb: 2 }}>
            <InputLabel required sx={{ mb: 1 }}>{t('adminOutdoorWorkPaperFlow.applicant')}</InputLabel>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SearchIcon />}
              onClick={() => setUserDialogOpen(true)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                height: '56px',
                color: displayUser ? 'text.primary' : 'text.secondary'
              }}
            >
              {displayUser 
                ? `${displayUser.employee_number} - ${displayUser.display_name || displayUser.name_zh || '-'}`
                : t('adminOutdoorWorkPaperFlow.selectApplicant')
              }
            </Button>
          </Box>

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('adminOutdoorWorkPaperFlow.startDate')}
                  value={formData.start_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label={t('adminOutdoorWorkPaperFlow.startTime')}
                  value={formData.start_time}
                  onChange={(time) => setFormData(prev => ({ ...prev, start_time: time }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('adminOutdoorWorkPaperFlow.endDate')}
                  value={formData.end_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                  minDate={formData.start_date}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label={t('adminOutdoorWorkPaperFlow.endTime')}
                  value={formData.end_time}
                  onChange={(time) => setFormData(prev => ({ ...prev, end_time: time }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.totalHours')}
            type="number"
            value={formData.total_hours}
            onChange={(e) => setFormData(prev => ({ ...prev, total_hours: e.target.value }))}
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
            helperText={t('adminOutdoorWorkPaperFlow.totalHoursHelper')}
          />

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.startLocation')}
            value={formData.start_location}
            onChange={(e) => setFormData(prev => ({ ...prev, start_location: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.endLocation')}
            value={formData.end_location}
            onChange={(e) => setFormData(prev => ({ ...prev, end_location: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.transportation')}
            value={formData.transportation}
            onChange={(e) => setFormData(prev => ({ ...prev, transportation: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.expense')}
            type="number"
            value={formData.expense}
            onChange={(e) => setFormData(prev => ({ ...prev, expense: e.target.value }))}
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
            helperText={t('adminOutdoorWorkPaperFlow.expenseHelper')}
          />

          <TextField
            fullWidth
            label={t('adminOutdoorWorkPaperFlow.purpose')}
            multiline
            rows={4}
            value={formData.purpose}
            onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? t('adminOutdoorWorkPaperFlow.submitting') : t('adminOutdoorWorkPaperFlow.submit')}
          </Button>
        </Box>
      </Paper>

      <UserSearchDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSelect={(user) => setSelectedUser(user)}
        selectedUserId={formData.user_id}
      />
    </Container>
  );
};

export default AdminOutdoorWorkPaperFlow;

