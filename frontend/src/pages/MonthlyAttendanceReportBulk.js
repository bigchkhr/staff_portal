import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import Swal from 'sweetalert2';
import Layout from '../components/Layout';
import { store } from '../store';
import { setMonthlyReportGeneratePreference } from '../store/slices/monthlyReportGeneratePreferenceSlice';
import { setMonthlyAttendanceSummaryDateRange } from '../store/slices/monthlyAttendanceSummaryDateRangeSlice';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

function getInitialDateRange() {
  try {
    const { start_date, end_date } = store.getState().monthlyAttendanceSummaryDateRange;
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (!start_date || !end_date || !ymd.test(start_date) || !ymd.test(end_date)) {
      const hk = dayjs().tz('Asia/Hong_Kong');
      return { start: hk.startOf('month'), end: hk.startOf('day') };
    }
    const [ys, ms, ds] = start_date.split('-').map(Number);
    const [ye, me, de] = end_date.split('-').map(Number);
    const s = dayjs.tz({ year: ys, month: ms - 1, day: ds }, 'Asia/Hong_Kong').startOf('day');
    const e = dayjs.tz({ year: ye, month: me - 1, day: de }, 'Asia/Hong_Kong').startOf('day');
    if (!s.isValid() || !e.isValid() || s.isAfter(e, 'day')) {
      const hk = dayjs().tz('Asia/Hong_Kong');
      return { start: hk.startOf('month'), end: hk.startOf('day') };
    }
    const days = e.diff(s, 'day') + 1;
    if (days < 1 || days > 45) {
      const hk = dayjs().tz('Asia/Hong_Kong');
      return { start: hk.startOf('month'), end: hk.startOf('day') };
    }
    return { start: s, end: e };
  } catch {
    const hk = dayjs().tz('Asia/Hong_Kong');
    return { start: hk.startOf('month'), end: hk.startOf('day') };
  }
}

const MonthlyAttendanceReportBulk = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const monthlyReportGeneratePreference = useSelector((state) => state.monthlyReportGeneratePreference);

  const initialRange = useMemo(() => getInitialDateRange(), []);
  const [selectedStartDate, setSelectedStartDate] = useState(initialRange.start);
  const [selectedEndDate, setSelectedEndDate] = useState(initialRange.end);

  const reportYearOptions = useMemo(() => {
    const hkNow = dayjs().tz('Asia/Hong_Kong');
    const maxY = hkNow.year() + 1;
    const minY = 2020;
    const list = [];
    for (let y = minY; y <= maxY; y += 1) list.push(y);
    return list;
  }, []);

  const [reportYear, setReportYear] = useState(() => {
    const prefY = monthlyReportGeneratePreference.year;
    const minY = 2020;
    const maxY = dayjs().tz('Asia/Hong_Kong').year() + 1;
    const y = prefY != null ? prefY : initialRange.start.year();
    return Math.min(maxY, Math.max(minY, y));
  });
  const [reportMonth, setReportMonth] = useState(() => {
    const prefM = monthlyReportGeneratePreference.month;
    const m = prefM != null ? prefM : initialRange.start.month() + 1;
    return Math.min(12, Math.max(1, m));
  });

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [results, setResults] = useState([]);
  const cancelRef = useRef(false);

  const startStr = selectedStartDate?.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
  const endStr = selectedEndDate?.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
  const rangeDays = selectedStartDate && selectedEndDate
    ? selectedEndDate.tz('Asia/Hong_Kong').startOf('day').diff(selectedStartDate.tz('Asia/Hong_Kong').startOf('day'), 'day') + 1
    : 0;
  const rangeValid = Boolean(startStr && endStr && rangeDays >= 1 && rangeDays <= 45);

  useEffect(() => {
    if (!startStr || !endStr) return;
    dispatch(setMonthlyAttendanceSummaryDateRange({ start_date: startStr, end_date: endStr }));
  }, [startStr, endStr, dispatch]);

  const fetchUsers = async () => {
    if (!rangeValid) {
      setRows([]);
      setError(t('bulkMonthlyReport.invalidRange'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/monthly-attendance-reports/clocked-users', {
        params: {
          start_date: startStr,
          end_date: endStr,
          year: reportYear,
          month: reportMonth
        }
      });
      const list = (response.data.users || []).map((user) => ({
        ...user,
        selected: true
      }));
      setRows(list);
      if (list.length === 0) {
        setError(t('bulkMonthlyReport.noClockedUsers'));
      }
    } catch (err) {
      console.error('Fetch clocked users error:', err);
      setRows([]);
      setError(err.response?.data?.message || t('bulkMonthlyReport.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResults([]);
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startStr, endStr, reportYear, reportMonth]);

  const filteredRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const number = String(row.employee_number || '').toLowerCase();
      const display = String(row.display_name || '').toLowerCase();
      const nameZh = String(row.name_zh || '').toLowerCase();
      return number.includes(q) || display.includes(q) || nameZh.includes(q);
    });
  }, [rows, searchInput]);

  const selectedRows = rows.filter((row) => row.selected);
  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((row) => row.selected);
  const someFilteredSelected = filteredRows.some((row) => row.selected) && !allFilteredSelected;

  const toggleAllFiltered = (checked) => {
    const ids = new Set(filteredRows.map((row) => row.user_id));
    setRows((prev) => prev.map((row) => (ids.has(row.user_id) ? { ...row, selected: checked } : row)));
  };

  const toggleRow = (userId, checked) => {
    setRows((prev) => prev.map((row) => (row.user_id === userId ? { ...row, selected: checked } : row)));
  };

  const handleStartDateChange = (value) => {
    if (!value) return;
    const next = value.tz('Asia/Hong_Kong').startOf('day');
    setSelectedStartDate(next);
    if (selectedEndDate && selectedEndDate.isBefore(next, 'day')) {
      setSelectedEndDate(next);
    } else if (selectedEndDate && selectedEndDate.diff(next, 'day') > 44) {
      setSelectedEndDate(next.add(44, 'day'));
    }
  };

  const handleEndDateChange = (value) => {
    if (!value) return;
    setSelectedEndDate(value.tz('Asia/Hong_Kong').startOf('day'));
  };

  const handleGenerate = async () => {
    if (!rangeValid || selectedRows.length === 0 || generating) return;

    const confirm = await Swal.fire({
      title: t('bulkMonthlyReport.confirmTitle'),
      html: t('bulkMonthlyReport.confirmHtml', {
        count: selectedRows.length,
        year: reportYear,
        month: reportMonth,
        start: startStr,
        end: endStr
      }),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('attendance.confirmGenerateReport'),
      cancelButtonText: t('common.cancel')
    });
    if (!confirm.isConfirmed) return;

    dispatch(setMonthlyReportGeneratePreference({ year: reportYear, month: reportMonth }));
    cancelRef.current = false;
    setGenerating(true);
    setResults([]);

    const nextResults = [];
    const targets = [...selectedRows];
    for (let i = 0; i < targets.length; i += 1) {
      if (cancelRef.current) break;
      const user = targets[i];
      const name = user.display_name || user.name_zh || user.employee_number;
      setProgress({ current: i + 1, total: targets.length, name });
      try {
        const response = await axios.post('/api/monthly-attendance-reports/generate', {
          user_id: user.user_id,
          year: reportYear,
          month: reportMonth,
          start_date: startStr,
          end_date: endStr
        });
        nextResults.push({
          user_id: user.user_id,
          employee_number: user.employee_number,
          display_name: name,
          success: true,
          message: response.data.message,
          attendance_bonus: response.data.report?.attendance_bonus ?? 0,
          attendance_bonus_eligible: !!response.data.attendance_bonus_eligible,
          report_id: response.data.report?.id || null
        });
      } catch (err) {
        nextResults.push({
          user_id: user.user_id,
          employee_number: user.employee_number,
          display_name: name,
          success: false,
          message: err.response?.data?.message || t('attendance.generateReportFailed'),
          attendance_bonus: null,
          attendance_bonus_eligible: false,
          report_id: null
        });
      }
      setResults([...nextResults]);
    }

    setGenerating(false);
    const successCount = nextResults.filter((r) => r.success).length;
    const failCount = nextResults.filter((r) => !r.success).length;
    const cancelled = cancelRef.current;
    await Swal.fire({
      icon: failCount === 0 && !cancelled ? 'success' : failCount === nextResults.length ? 'error' : 'warning',
      title: cancelled ? t('bulkMonthlyReport.cancelled') : t('bulkMonthlyReport.doneTitle'),
      text: t('bulkMonthlyReport.doneText', { success: successCount, fail: failCount })
    });
    await fetchUsers();
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  return (
    <Layout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Container maxWidth="xl">
          <Box sx={{ mb: 3 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/shift-management')}
              sx={{ mb: 2 }}
              disabled={generating}
            >
              {t('common.back')}
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
              {t('bulkMonthlyReport.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('bulkMonthlyReport.subtitle')}
            </Typography>
          </Box>

          <Card elevation={2} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label={t('attendance.startDate')}
                  value={selectedStartDate}
                  onChange={handleStartDateChange}
                  format="YYYY-MM-DD"
                  disabled={generating}
                  maxDate={selectedEndDate || undefined}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label={t('attendance.endDate')}
                  value={selectedEndDate}
                  onChange={handleEndDateChange}
                  format="YYYY-MM-DD"
                  disabled={generating}
                  minDate={selectedStartDate || undefined}
                  maxDate={selectedStartDate ? selectedStartDate.add(44, 'day') : undefined}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('attendance.reportYear')}</InputLabel>
                  <Select
                    label={t('attendance.reportYear')}
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    disabled={generating}
                  >
                    {reportYearOptions.map((y) => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('attendance.reportMonth')}</InputLabel>
                  <Select
                    label={t('attendance.reportMonth')}
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                    disabled={generating}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={fetchUsers}
                  disabled={generating || loading || !rangeValid}
                  sx={{ height: 40 }}
                >
                  {loading ? t('common.loading') : t('bulkMonthlyReport.reload')}
                </Button>
              </Grid>
            </Grid>
          </Card>

          {error && !loading && (
            <Alert severity={rows.length === 0 ? 'info' : 'error'} sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
              <TextField
                size="small"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('attendance.searchPlaceholder')}
                disabled={generating}
                sx={{ minWidth: 260, flex: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                {t('bulkMonthlyReport.selectedCount', {
                  selected: selectedRows.length,
                  total: rows.length
                })}
              </Typography>
              <Button
                variant="contained"
                startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PlaylistAddCheckIcon />}
                onClick={handleGenerate}
                disabled={generating || loading || selectedRows.length === 0}
              >
                {generating
                  ? t('bulkMonthlyReport.generatingProgress', { current: progress.current, total: progress.total })
                  : t('bulkMonthlyReport.generateSelected')}
              </Button>
              {generating && (
                <Button color="inherit" onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
              )}
            </Box>

            {generating && (
              <Box sx={{ mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress.total ? (progress.current / progress.total) * 100 : 0}
                />
                <Typography variant="caption" color="text.secondary">
                  {t('bulkMonthlyReport.generatingName', { name: progress.name })}
                </Typography>
              </Box>
            )}

            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allFilteredSelected}
                        indeterminate={someFilteredSelected}
                        onChange={(e) => toggleAllFiltered(e.target.checked)}
                        disabled={generating || filteredRows.length === 0}
                      />
                    </TableCell>
                    <TableCell>{t('attendance.employeeNumber')}</TableCell>
                    <TableCell>{t('attendance.employeeName')}</TableCell>
                    <TableCell>{t('bulkMonthlyReport.employmentMode')}</TableCell>
                    <TableCell>{t('bulkMonthlyReport.clockDays')}</TableCell>
                    <TableCell>{t('bulkMonthlyReport.status')}</TableCell>
                    <TableCell>{t('bulkMonthlyReport.existingReport')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow key={row.user_id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!row.selected}
                            onChange={(e) => toggleRow(row.user_id, e.target.checked)}
                            disabled={generating}
                          />
                        </TableCell>
                        <TableCell>{row.employee_number}</TableCell>
                        <TableCell>{row.display_name || row.name_zh || '—'}</TableCell>
                        <TableCell>{(row.position_employment_mode || '').toString().toUpperCase() || '—'}</TableCell>
                        <TableCell>{row.clock_days}</TableCell>
                        <TableCell>
                          {row.deactivated && (
                            <Chip size="small" color="warning" label={t('bulkMonthlyReport.deactivated')} sx={{ mr: 0.5, mb: 0.5 }} />
                          )}
                          {row.termination_date && (
                            <Chip size="small" color="default" label={t('bulkMonthlyReport.terminated')} sx={{ mr: 0.5, mb: 0.5 }} />
                          )}
                          {!row.deactivated && !row.termination_date && '—'}
                        </TableCell>
                        <TableCell>
                          {row.existing_report_id ? (
                            <Chip size="small" color="info" label={t('bulkMonthlyReport.willUpdate')} />
                          ) : (
                            <Chip size="small" variant="outlined" label={t('bulkMonthlyReport.newReport')} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {results.length > 0 && (
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t('bulkMonthlyReport.resultsTitle')}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('attendance.employeeNumber')}</TableCell>
                      <TableCell>{t('attendance.employeeName')}</TableCell>
                      <TableCell>{t('common.status')}</TableCell>
                      <TableCell>{t('attendance.attendanceBonus')}</TableCell>
                      <TableCell>{t('common.description')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((row) => (
                      <TableRow key={row.user_id}>
                        <TableCell>{row.employee_number}</TableCell>
                        <TableCell>{row.display_name}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={row.success ? 'success' : 'error'}
                            label={row.success ? t('common.success') : t('common.error')}
                          />
                        </TableCell>
                        <TableCell>
                          {row.success ? Number(row.attendance_bonus || 0).toFixed(0) : '—'}
                        </TableCell>
                        <TableCell>{row.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Container>
      </LocalizationProvider>
    </Layout>
  );
};

export default MonthlyAttendanceReportBulk;
