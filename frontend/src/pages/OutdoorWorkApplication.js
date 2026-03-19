import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  LinearProgress,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack
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
import { AddCircleOutline, DeleteOutline, ContentCopy } from '@mui/icons-material';

const OutdoorWorkApplication = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [useBatchMode, setUseBatchMode] = useState(false);
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

  const createEmptyRow = () => ({
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

  const [batchRows, setBatchRows] = useState([createEmptyRow()]);

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

  const updateBatchRow = (rowIndex, patch) => {
    setBatchRows(prev => {
      const next = prev.map((row, idx) => (idx === rowIndex ? { ...row, ...patch } : row));
      const row = next[rowIndex];
      if (row.start_date && row.start_time && row.end_date && row.end_time) {
        const totalHours = calculateTotalHours(row.start_date, row.start_time, row.end_date, row.end_time);
        next[rowIndex] = { ...row, total_hours: totalHours > 0 ? totalHours.toFixed(2) : '' };
      }
      return next;
    });
  };

  const cloneBatchRowToNew = (rowIndex) => {
    setBatchRows(prev => {
      const source = prev[rowIndex] || createEmptyRow();
      const cloned = { ...source };
      return [...prev, cloned];
    });
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const invalidRowIndexes = batchRows
      .map((row, idx) => {
        const missingRequired =
          !row.start_date || !row.start_time || !row.end_date || !row.end_time || !row.total_hours;
        return missingRequired ? idx : null;
      })
      .filter(v => v !== null);

    if (invalidRowIndexes.length > 0) {
      await Swal.fire({
        icon: 'warning',
        title: t('outdoorWorkApplication.validationFailed'),
        text: t('outdoorWorkApplication.batchFillAllFields', { rows: invalidRowIndexes.map(i => i + 1).join(', ') }),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      setLoading(false);
      return;
    }

    try {
      const payloads = batchRows.map(row => ({
        user_id: user.id,
        start_date: row.start_date.format('YYYY-MM-DD'),
        start_time: row.start_time.format('HH:mm:ss'),
        end_date: row.end_date.format('YYYY-MM-DD'),
        end_time: row.end_time.format('HH:mm:ss'),
        total_hours: parseFloat(row.total_hours),
        start_location: row.start_location || null,
        end_location: row.end_location || null,
        transportation: row.transportation || null,
        expense: row.expense ? parseFloat(row.expense) : null,
        purpose: row.purpose || null,
        application_date: new Date().toISOString().split('T')[0]
      }));

      const results = await Promise.allSettled(payloads.map(p => axios.post('/api/outdoor-work', p)));
      const successes = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value?.data?.application?.transaction_id)
        .filter(Boolean);
      const failures = results.filter(r => r.status === 'rejected');

      if (failures.length === 0) {
        await Swal.fire({
          icon: 'success',
          title: t('outdoorWorkApplication.batchSubmitSuccess', { count: successes.length }),
          text: successes.length > 0
            ? t('outdoorWorkApplication.batchTransactionIds', { transactionIds: successes.join(', ') })
            : t('outdoorWorkApplication.submitSuccess'),
          confirmButtonText: t('common.confirm'),
          confirmButtonColor: '#3085d6'
        });
        setBatchRows([createEmptyRow()]);
      } else {
        const firstError = failures[0]?.reason?.response?.data?.message || failures[0]?.reason?.message;
        await Swal.fire({
          icon: 'warning',
          title: t('outdoorWorkApplication.batchSubmitPartial', { successCount: successes.length, failCount: failures.length }),
          text: firstError || t('outdoorWorkApplication.submitError'),
          confirmButtonText: t('common.confirm'),
          confirmButtonColor: '#3085d6'
        });
      }
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
    <Container
      maxWidth={false}
      sx={{ maxWidth: { xs: 'md', md: 1200, lg: 1600 }, mx: 'auto' }}
    >
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('outdoorWorkApplication.title')}
        </Typography>

        <FormControlLabel
          sx={{ mb: 2 }}
          control={
            <Switch
              checked={useBatchMode}
              onChange={(e) => setUseBatchMode(e.target.checked)}
            />
          }
          label={useBatchMode ? t('outdoorWorkApplication.batchMode') : t('outdoorWorkApplication.singleMode')}
        />

        {useBatchMode ? (
          <Box component="form" onSubmit={handleBatchSubmit}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <TableContainer sx={{ mb: 2, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 56 }}>#</TableCell>
                      <TableCell>{t('outdoorWorkApplication.startDate')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.startTime')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.endDate')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.endTime')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.totalHours')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.startLocation')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.endLocation')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.transportation')}</TableCell>
                      <TableCell>{t('outdoorWorkApplication.purpose')}</TableCell>
                      <TableCell sx={{ width: 96 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {batchRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell sx={{ minWidth: 210 }}>
                          <DatePicker
                            value={row.start_date}
                            onChange={(date) => updateBatchRow(idx, { start_date: date })}
                            format="DD/MM/YYYY"
                            slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 190 }}>
                          <TimePicker
                            value={row.start_time}
                            onChange={(time) => updateBatchRow(idx, { start_time: time })}
                            slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 210 }}>
                          <DatePicker
                            value={row.end_date}
                            onChange={(date) => updateBatchRow(idx, { end_date: date })}
                            format="DD/MM/YYYY"
                            minDate={row.start_date}
                            slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 190 }}>
                          <TimePicker
                            value={row.end_time}
                            onChange={(time) => updateBatchRow(idx, { end_time: time })}
                            slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            value={row.total_hours}
                            onChange={(e) => updateBatchRow(idx, { total_hours: e.target.value })}
                            required
                            inputProps={{ min: 0, step: 0.5 }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.start_location}
                            onChange={(e) => updateBatchRow(idx, { start_location: e.target.value })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.end_location}
                            onChange={(e) => updateBatchRow(idx, { end_location: e.target.value })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.transportation}
                            onChange={(e) => updateBatchRow(idx, { transportation: e.target.value })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={row.purpose}
                            onChange={(e) => updateBatchRow(idx, { purpose: e.target.value })}
                          />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              onClick={() => setBatchRows(prev => [...prev, createEmptyRow()])}
                              aria-label={t('outdoorWorkApplication.addRow')}
                            >
                              <AddCircleOutline fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => cloneBatchRowToNew(idx)}
                              aria-label={t('outdoorWorkApplication.copyRow')}
                            >
                              <ContentCopy fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => setBatchRows(prev => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))}
                              disabled={batchRows.length <= 1}
                              aria-label={t('outdoorWorkApplication.removeRow')}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </LocalizationProvider>

            {loading && (
              <LinearProgress sx={{ mb: 2 }} />
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
            >
              {loading ? t('outdoorWorkApplication.submitting') : t('outdoorWorkApplication.batchSubmit')}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={12}>
                  <DatePicker
                    label={t('outdoorWorkApplication.startDate')}
                    value={formData.start_date}
                    onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                    format="DD/MM/YYYY"
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={12}>
                  <TimePicker
                    label={t('outdoorWorkApplication.startTime')}
                    value={formData.start_time}
                    onChange={(time) => setFormData(prev => ({ ...prev, start_time: time }))}
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                  />
                </Grid>
                <Grid item xs={12} sm={12}>
                  <DatePicker
                    label={t('outdoorWorkApplication.endDate')}
                    value={formData.end_date}
                    onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                    format="DD/MM/YYYY"
                    slotProps={{ textField: { fullWidth: true, required: true } }}
                    minDate={formData.start_date}
                  />
                </Grid>
                <Grid item xs={12} sm={12}>
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
        )}
      </Paper>
    </Container>
  );
};

export default OutdoorWorkApplication;

