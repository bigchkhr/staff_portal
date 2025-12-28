import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  LinearProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const OutdoorWorkApplication = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
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
  const [loading, setLoading] = useState(false);

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
  React.useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.start_date || !formData.start_time || 
        !formData.end_date || !formData.end_time || !formData.total_hours) {
      await Swal.fire({
        icon: 'warning',
        title: t('outdoorWorkApplication.validationFailed'),
        text: t('outdoorWorkApplication.fillAllFields'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        user_id: user.id,
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
        application_date: new Date().toISOString().split('T')[0]
      };

      const response = await axios.post('/api/outdoor-work', payload);
      
      await Swal.fire({
        icon: 'success',
        title: t('outdoorWorkApplication.submitSuccess'),
        text: t('outdoorWorkApplication.transactionId', { transactionId: response.data.application.transaction_id }),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      setFormData({
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
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: t('outdoorWorkApplication.submitFailed'),
        text: error.response?.data?.message || t('outdoorWorkApplication.submitError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('outdoorWorkApplication.title')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('outdoorWorkApplication.startDate')}
                  value={formData.start_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label={t('outdoorWorkApplication.startTime')}
                  value={formData.start_time}
                  onChange={(time) => setFormData(prev => ({ ...prev, start_time: time }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('outdoorWorkApplication.endDate')}
                  value={formData.end_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                  minDate={formData.start_date}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label={t('outdoorWorkApplication.endTime')}
                  value={formData.end_time}
                  onChange={(time) => setFormData(prev => ({ ...prev, end_time: time }))}
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.totalHours')}
            type="number"
            value={formData.total_hours}
            onChange={(e) => setFormData(prev => ({ ...prev, total_hours: e.target.value }))}
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.5 }}
            helperText={t('outdoorWorkApplication.totalHoursHelper')}
          />

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.startLocation')}
            value={formData.start_location}
            onChange={(e) => setFormData(prev => ({ ...prev, start_location: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.endLocation')}
            value={formData.end_location}
            onChange={(e) => setFormData(prev => ({ ...prev, end_location: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.transportation')}
            value={formData.transportation}
            onChange={(e) => setFormData(prev => ({ ...prev, transportation: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.expense')}
            type="number"
            value={formData.expense}
            onChange={(e) => setFormData(prev => ({ ...prev, expense: e.target.value }))}
            sx={{ mb: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
            helperText={t('outdoorWorkApplication.expenseHelper')}
          />

          <TextField
            fullWidth
            label={t('outdoorWorkApplication.purpose')}
            multiline
            rows={4}
            value={formData.purpose}
            onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
            sx={{ mb: 2 }}
          />

          {loading && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? t('outdoorWorkApplication.submitting') : t('outdoorWorkApplication.submit')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default OutdoorWorkApplication;

