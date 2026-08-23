import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import TableChartIcon from '@mui/icons-material/TableChart';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

const StoreHoursReport = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').endOf('month'));
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);

  const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';

  const formatDateHeader = (date) => (isChinese ? date.format('DD/MM') : date.format('MM/DD'));

  const dates = useMemo(() => {
    const list = [];
    let current = dayjs(startDate);
    let end = dayjs(endDate);
    if (!current.isValid() || !end.isValid()) return [];
    current = current.tz('Asia/Hong_Kong').startOf('day');
    end = end.tz('Asia/Hong_Kong').startOf('day');
    while (current.isBefore(end) || current.isSame(end, 'day')) {
      list.push(current);
      current = current.add(1, 'day');
    }
    return list;
  }, [startDate, endDate]);

  useEffect(() => {
    if (!user) return;
    const fetchDepartmentGroups = async () => {
      try {
        const response = await axios.get('/api/schedules/accessible-groups');
        const groups = response.data.groups || [];
        const userDelegationGroupIds = (user.delegation_groups || []).map((g) => Number(g.id));
        const filtered = user.is_system_admin
          ? groups
          : groups.filter((group) =>
            [group.approver_1_id, group.approver_2_id, group.approver_3_id]
              .some((id) => id && userDelegationGroupIds.includes(Number(id)))
          );
        if (!user.is_system_admin && filtered.length === 0) {
          navigate('/shift-management');
          return;
        }
        setDepartmentGroups(filtered);
        if (filtered.length === 1) {
          setSelectedGroupId(filtered[0].id);
        }
      } catch (error) {
        console.error('Fetch department groups error:', error);
      }
    };
    fetchDepartmentGroups();
  }, [user, navigate]);

  const handleStartDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) return;
    setStartDate(newValue);
    setEndDate(newValue.endOf('month'));
  };

  const handleEndDateChange = (newValue) => {
    if (!newValue || !newValue.isValid()) return;
    if (startDate && startDate.isValid()) {
      if (newValue.month() !== startDate.month() || newValue.year() !== startDate.year()) {
        setEndDate(startDate.endOf('month'));
        return;
      }
    }
    setEndDate(newValue);
  };

  const fetchReport = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      const response = await axios.get('/api/monthly-attendance-summaries/store-hours-report', {
        params: {
          department_group_id: selectedGroupId,
          start_date: dayjs(startDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD'),
          end_date: dayjs(endDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD')
        }
      });
      setEmployees(response.data.employees || []);
      setGroupInfo(response.data.group || null);
    } catch (error) {
      console.error('Fetch store hours report error:', error);
      Swal.fire({
        icon: 'error',
        title: t('storeHoursReport.error'),
        text: error.response?.data?.message || t('storeHoursReport.fetchFailed')
      });
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId && startDate && endDate) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, startDate, endDate]);

  const formatMinutes = (minutes) => {
    if (minutes == null || Number.isNaN(minutes) || minutes < 0) return '--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const getEmployeeName = (emp) => {
    if (isChinese) {
      return emp.display_name || emp.name_zh || [emp.surname, emp.given_name].filter(Boolean).join(' ') || emp.employee_number;
    }
    return emp.display_name || [emp.given_name, emp.surname].filter(Boolean).join(' ') || emp.name_zh || emp.employee_number;
  };

  const getPositionLabel = (emp) => {
    if (isChinese) return emp.position_name_zh || emp.position_name || '';
    return emp.position_name || emp.position_name_zh || '';
  };

  const canViewEmployeeTerminationDate = () => {
    if (user?.is_system_admin) return true;
    const group = departmentGroups.find((g) => g.id === selectedGroupId);
    if (!group) return false;
    const userDelegationGroupIds = (user?.delegation_groups || []).map((g) => Number(g.id));
    const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));
    return isChecker || isApprover1 || isApprover2 || isApprover3;
  };

  const renderTerminationDateBelowPosition = (terminationDate) => {
    if (!canViewEmployeeTerminationDate() || !terminationDate) return null;
    const d = dayjs(terminationDate);
    if (!d.isValid()) return null;
    const dateStr = i18n.language === 'en' ? d.format('MMM D, YYYY') : d.format('YYYY-MM-DD');
    return (
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontSize: '0.7rem',
          color: '#4a4944',
          fontWeight: 500,
          mt: 0.25,
          lineHeight: 1.2
        }}
      >
        {t('schedule.terminationDateLabel', { date: dateStr })}
      </Typography>
    );
  };

  const dailyTotals = useMemo(() => {
    const totals = {};
    dates.forEach((date) => {
      totals[date.format('YYYY-MM-DD')] = { overtime: 0, work: 0 };
    });
    employees.forEach((emp) => {
      dates.forEach((date) => {
        const dateStr = date.format('YYYY-MM-DD');
        const cell = emp.days?.[dateStr];
        if (!cell || cell.minutes == null) return;
        if (cell.hours_type === 'work') totals[dateStr].work += cell.minutes;
        else totals[dateStr].overtime += cell.minutes;
      });
    });
    return totals;
  }, [dates, employees]);

  const employeeTotals = useMemo(() => {
    const map = {};
    employees.forEach((emp) => {
      let total = 0;
      Object.values(emp.days || {}).forEach((cell) => {
        if (cell?.minutes) total += cell.minutes;
      });
      map[emp.user_id] = total;
    });
    return map;
  }, [employees]);

  const handleExportCsv = () => {
    if (!employees.length) return;
    const headers = [
      t('storeHoursReport.employeeNumber'),
      t('storeHoursReport.employee'),
      'FT/PT',
      t('storeHoursReport.position'),
      ...dates.map((d) => d.format('YYYY-MM-DD')),
      t('storeHoursReport.total')
    ];
    const rows = employees.map((emp) => [
      emp.employee_number || '',
      getEmployeeName(emp),
      emp.employment_mode || '',
      getPositionLabel(emp),
      ...dates.map((date) => {
        const cell = emp.days?.[date.format('YYYY-MM-DD')];
        return cell ? formatMinutes(cell.minutes) : '';
      }),
      formatMinutes(employeeTotals[emp.user_id] || 0)
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const groupLabel = (isChinese ? groupInfo?.name_zh : groupInfo?.name) || groupInfo?.name || selectedGroupId;
    link.href = url;
    link.download = `group-hours-${groupLabel}-${dayjs(startDate).format('YYYYMMDD')}-${dayjs(endDate).format('YYYYMMDD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderCell = (emp, date) => {
    const cell = emp.days?.[date.format('YYYY-MM-DD')];
    if (!cell) {
      return <Typography variant="caption" color="text.secondary">---</Typography>;
    }
    const isPt = cell.hours_type === 'work';
    const hasValue = cell.minutes != null && cell.minutes >= 0;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
        {(cell.clock_start_time || cell.clock_end_time) ? (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: '#1565c0', fontWeight: 600 }}>
            {cell.clock_start_time || '--:--'} - {cell.clock_end_time || '--:--'}
          </Typography>
        ) : (cell.schedule_start_time || cell.schedule_end_time) ? (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
            {cell.schedule_start_time || '--:--'} - {cell.schedule_end_time || '--:--'}
          </Typography>
        ) : null}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            fontSize: '0.8rem',
            color: hasValue ? (isPt ? 'secondary.main' : '#e65100') : 'text.disabled'
          }}
        >
          {hasValue ? formatMinutes(cell.minutes) : '--'}
        </Typography>
      </Box>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 3,
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)'
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="h4"
              gutterBottom
              sx={{ fontWeight: 600, color: 'primary.main', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <TableChartIcon sx={{ fontSize: 32 }} />
              {t('storeHoursReport.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('storeHoursReport.subtitle')}
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>

          <Card
            elevation={2}
            sx={{
              mb: 3,
              p: 3,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('storeHoursReport.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('storeHoursReport.selectGroup')}
                    sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
                  >
                    {departmentGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {isChinese ? (group.name_zh || group.name) : group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label={t('storeHoursReport.startDate')}
                  value={startDate}
                  onChange={handleStartDateChange}
                  format="DD/MM/YYYY"
                  slotProps={{
                    textField: { fullWidth: true, sx: { bgcolor: 'background.paper', borderRadius: 1 } }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker
                  label={t('storeHoursReport.endDate')}
                  value={endDate}
                  onChange={handleEndDateChange}
                  format="DD/MM/YYYY"
                  minDate={startDate?.startOf('month')}
                  maxDate={startDate?.endOf('month')}
                  slotProps={{
                    textField: { fullWidth: true, sx: { bgcolor: 'background.paper', borderRadius: 1 } }
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExportCsv}
                  disabled={!employees.length}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, bgcolor: 'background.paper' }}
                >
                  {t('storeHoursReport.exportCsv')}
                </Button>
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip size="small" label={t('storeHoursReport.legendOt')} sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }} />
              <Chip size="small" label={t('storeHoursReport.legendPt')} color="secondary" variant="outlined" />
            </Box>
          </Card>

          {!selectedGroupId ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('storeHoursReport.selectGroupFirst')}
              </Typography>
            </Box>
          ) : loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : employees.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('storeHoursReport.noData')}
              </Typography>
            </Box>
          ) : (
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
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          minWidth: 140
                        }}
                      >
                        {t('storeHoursReport.employee')}
                      </TableCell>
                      {dates.map((date) => (
                        <TableCell
                          key={date.format('YYYY-MM-DD')}
                          align="center"
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 600,
                            minWidth: 90,
                            py: 1.5
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {formatDateHeader(date)}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.9 }}>
                              {date.format('ddd')}
                            </Typography>
                          </Box>
                        </TableCell>
                      ))}
                      <TableCell
                        align="center"
                        sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600, minWidth: 80 }}
                      >
                        {t('storeHoursReport.total')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.user_id} hover>
                        <TableCell
                          sx={{
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                            bgcolor: 'grey.50',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            minWidth: 140
                          }}
                        >
                          <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main' }}>
                            {emp.employee_number}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {getEmployeeName(emp)}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip
                              label={emp.employment_mode === 'PT' ? 'PT' : 'FT'}
                              size="small"
                              color={emp.employment_mode === 'PT' ? 'secondary' : 'primary'}
                              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                            />
                            {getPositionLabel(emp) ? (
                              <Typography variant="caption" color="text.secondary">
                                {getPositionLabel(emp)}
                              </Typography>
                            ) : null}
                          </Box>
                          {renderTerminationDateBelowPosition(emp.termination_date)}
                        </TableCell>
                        {dates.map((date) => (
                          <TableCell
                            key={date.format('YYYY-MM-DD')}
                            align="center"
                            sx={{ borderRight: '1px solid', borderColor: 'divider', py: 1 }}
                          >
                            {renderCell(emp, date)}
                          </TableCell>
                        ))}
                        <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>
                          {formatMinutes(employeeTotals[emp.user_id] || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          bgcolor: 'grey.100',
                          fontWeight: 600,
                          borderRight: '2px solid',
                          borderColor: 'divider'
                        }}
                      >
                        {t('storeHoursReport.summary')}
                      </TableCell>
                      {dates.map((date) => {
                        const dateStr = date.format('YYYY-MM-DD');
                        const tot = dailyTotals[dateStr] || { overtime: 0, work: 0 };
                        return (
                          <TableCell key={dateStr} align="center" sx={{ bgcolor: 'grey.100', fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#e65100', fontSize: '0.7rem' }}>
                                OT: {formatMinutes(tot.overtime)}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main', fontSize: '0.7rem' }}>
                                PT: {formatMinutes(tot.work)}
                              </Typography>
                            </Box>
                          </TableCell>
                        );
                      })}
                      <TableCell sx={{ bgcolor: 'grey.100' }} />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default StoreHoursReport;
