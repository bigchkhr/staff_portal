import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const ShiftUserSchedules = () => {
  const { t } = useTranslation();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [savingAll, setSavingAll] = useState(false);

  const handleSearch = async () => {
    setError('');
    setSuccess('');

    if (!employeeNumber || !startDate || !endDate) {
      setError(t('shiftUserSchedules.errors.missingRequired'));
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setError(t('shiftUserSchedules.errors.invalidDateFormat'));
      return;
    }
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (diffDays <= 0) {
      setError(t('shiftUserSchedules.errors.endBeforeStart'));
      return;
    }
    if (diffDays > 31) {
      setError(t('shiftUserSchedules.errors.rangeTooLong'));
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get('/api/schedules/user-schedules', {
        params: {
          employee_number: employeeNumber,
          start_date: startDate,
          end_date: endDate
        }
      });

      setUserInfo(res.data.user || null);
      const schedules = Array.isArray(res.data.schedules) ? res.data.schedules : [];
      setRows(
        schedules.map((s) => ({
          ...s,
          start_time: s.start_time || '',
          end_time: s.end_time || ''
        }))
      );
      if (schedules.length === 0) {
        setSuccess(t('shiftUserSchedules.messages.noSchedules'));
      }
    } catch (err) {
      console.error('載入排班錯誤', err);
      const message =
        err.response?.data?.message ||
        err.message ||
        t('shiftUserSchedules.errors.fetchFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (id, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );
  };

  const handleSaveAll = async () => {
    setError('');
    setSuccess('');

    const targetRows = rows.filter((r) => r.id);
    if (targetRows.length === 0) {
      setError(t('shiftUserSchedules.errors.nothingToSave'));
      return;
    }

    setSavingAll(true);
    try {
      for (const row of targetRows) {
        await axios.put(`/api/schedules/${row.id}`, {
          start_time: row.start_time || null,
          end_time: row.end_time || null,
          store_id: row.store_id ?? null,
          department_group_id: row.department_group_id ?? null
        });
      }
      setSuccess(t('shiftUserSchedules.messages.saveAllSuccess'));
    } catch (err) {
      console.error('批量儲存排班錯誤', err);
      const message =
        err.response?.data?.message ||
        err.message ||
        t('shiftUserSchedules.errors.saveAllFailed');
      setError(message);
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
          {t('shiftUserSchedules.title')}
        </Typography>

        <Box component={Paper} sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('shiftUserSchedules.fields.employeeNumber')}
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('shiftUserSchedules.fields.startDate')}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label={t('shiftUserSchedules.fields.endDate')}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? <CircularProgress size={20} /> : t('shiftUserSchedules.actions.search')}
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                color="success"
                onClick={handleSaveAll}
                disabled={savingAll || rows.length === 0}
              >
                {savingAll ? <CircularProgress size={20} /> : t('shiftUserSchedules.actions.saveAll')}
              </Button>
            </Grid>
          </Grid>
          {userInfo && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">
                {t('shiftUserSchedules.targetUser', {
                  employeeNumber: userInfo.employee_number,
                  name: userInfo.name_zh || userInfo.display_name
                })}
              </Typography>
            </Box>
          )}
          {error && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="error">{error}</Alert>
            </Box>
          )}
          {success && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="success">{success}</Alert>
            </Box>
          )}
        </Box>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('shiftUserSchedules.table.date')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.departmentGroupId')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.storeId')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.startTime')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.endTime')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.leaveType')}</TableCell>
                <TableCell>{t('shiftUserSchedules.table.leaveSession')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.schedule_date}-${row.id || 'new'}`}>
                  <TableCell>{row.schedule_date}</TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={row.department_group_id ?? ''}
                      onChange={(e) =>
                        handleFieldChange(
                          row.id,
                          'department_group_id',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={row.store_id ?? ''}
                      onChange={(e) =>
                        handleFieldChange(
                          row.id,
                          'store_id',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.start_time ? row.start_time.substring(0, 5) : ''}
                      onChange={(e) =>
                        handleFieldChange(
                          row.id,
                          'start_time',
                          e.target.value ? `${e.target.value}:00` : ''
                        )
                      }
                      inputProps={{ step: 60 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={row.end_time ? row.end_time.substring(0, 5) : ''}
                      onChange={(e) =>
                        handleFieldChange(
                          row.id,
                          'end_time',
                          e.target.value ? `${e.target.value}:00` : ''
                        )
                      }
                      inputProps={{ step: 60 }}
                    />
                  </TableCell>
                  <TableCell>
                    {row.store_short_name || row.store_code || row.store_id || '-'}
                  </TableCell>
                  <TableCell>
                    {row.leave_type_name_zh || row.leave_type_name || row.leave_type_code || '-'}
                  </TableCell>
                  <TableCell>{row.leave_session || '-'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    {t('shiftUserSchedules.messages.pleaseSearch')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Layout>
  );
};

export default ShiftUserSchedules;

