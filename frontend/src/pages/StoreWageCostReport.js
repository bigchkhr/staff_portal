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
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
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

const StoreWageCostReport = () => {
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
      const response = await axios.get('/api/monthly-attendance-summaries/store-wage-cost-report', {
        params: {
          department_group_id: selectedGroupId,
          start_date: dayjs(startDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD'),
          end_date: dayjs(endDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD')
        }
      });
      setEmployees(response.data.employees || []);
      setGroupInfo(response.data.group || null);
    } catch (error) {
      console.error('Fetch store wage cost report error:', error);
      Swal.fire({
        icon: 'error',
        title: t('storeWageCostReport.error'),
        text: error.response?.data?.message || t('storeWageCostReport.fetchFailed')
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

  const formatLeaveLabel = (cell) => {
    if (!cell?.is_leave) return '';
    const name = isChinese
      ? (cell.leave_type_name_zh || cell.leave_type_name || t('storeWageCostReport.leave'))
      : (cell.leave_type_name || cell.leave_type_name_zh || t('storeWageCostReport.leave'));
    if (cell.leave_session === 'AM') return `${name} (${t('storeWageCostReport.leaveAm')})`;
    if (cell.leave_session === 'PM') return `${name} (${t('storeWageCostReport.leavePm')})`;
    return name;
  };

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

  const renderTerminationDate = (terminationDate) => {
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

  const employeeDayCounts = useMemo(() => {
    const map = {};
    employees.forEach((emp) => {
      let withLeave = 0;
      let withoutLeave = 0;
      Object.values(emp.days || {}).forEach((cell) => {
        if (!cell) return;
        withLeave += 1;
        const hasWork = (cell.minutes != null && cell.minutes > 0) || !!(cell.clock_start_time || cell.clock_end_time);
        if (hasWork) withoutLeave += 1;
      });
      map[emp.user_id] = { withLeave, withoutLeave };
    });
    return map;
  }, [employees]);

  const dailyHeadcounts = useMemo(() => {
    const map = {};
    dates.forEach((date) => {
      map[date.format('YYYY-MM-DD')] = { ft: 0, pt: 0 };
    });
    employees.forEach((emp) => {
      const isPt = emp.employment_mode === 'PT';
      dates.forEach((date) => {
        const dateStr = date.format('YYYY-MM-DD');
        const cell = emp.days?.[dateStr];
        if (!cell || cell.is_leave) return;
        const hasWork = (cell.minutes != null && cell.minutes > 0) || !!(cell.clock_start_time || cell.clock_end_time);
        if (!hasWork) return;
        if (isPt) map[dateStr].pt += 1;
        else map[dateStr].ft += 1;
      });
    });
    return map;
  }, [dates, employees]);

  const storeTotals = useMemo(() => {
    const map = {};
    employees.forEach((emp) => {
      Object.values(emp.days || {}).forEach((cell) => {
        if (!cell || cell.minutes == null) return;
        const key = cell.store_code || cell.store_short_name_ || 'unknown';
        if (!map[key]) {
          map[key] = {
            store_code: cell.store_code,
            store_short_name_: cell.store_short_name_,
            overtime: 0,
            work: 0
          };
        }
        if (cell.hours_type === 'work') map[key].work += cell.minutes;
        else map[key].overtime += cell.minutes;
      });
    });
    return Object.values(map).sort((a, b) =>
      String(a.store_short_name_ || a.store_code || '').localeCompare(String(b.store_short_name_ || b.store_code || ''))
    );
  }, [employees]);

  const grandTotals = useMemo(() => {
    let overtime = 0;
    let work = 0;
    Object.values(dailyTotals).forEach((tot) => {
      overtime += tot.overtime || 0;
      work += tot.work || 0;
    });
    return { overtime, work };
  }, [dailyTotals]);

  const handleExportCsv = () => {
    if (!employees.length) return;
    const dateHeader = (date) => (isChinese ? date.format('D/M') : date.format('M/D'));
    const headers = [
      t('storeWageCostReport.employeeNumber'),
      t('storeWageCostReport.employee'),
      'FT/PT',
      t('storeWageCostReport.position'),
      ...dates.flatMap((d) => [dateHeader(d), dateHeader(d)]),
      t('storeWageCostReport.total'),
      t('storeWageCostReport.daysWithLeave'),
      t('storeWageCostReport.daysWithoutLeave')
    ];
    const rows = employees.map((emp) => [
      emp.employee_number || '',
      getEmployeeName(emp),
      emp.employment_mode || '',
      getPositionLabel(emp),
      ...dates.flatMap((date) => {
        const cell = emp.days?.[date.format('YYYY-MM-DD')];
        if (!cell) return ['', ''];
        const storeLabel = cell.store_short_name_ || cell.store_code || '';
        const leaveLabel = formatLeaveLabel(cell);
        const hoursLabel = (cell.minutes == null || Number.isNaN(cell.minutes) || cell.minutes <= 0)
          ? '0'
          : formatMinutes(cell.minutes);
        return [storeLabel, [leaveLabel, hoursLabel].filter(Boolean).join(' ')];
      }),
      formatMinutes(employeeTotals[emp.user_id] || 0),
      employeeDayCounts[emp.user_id]?.withLeave ?? 0,
      employeeDayCounts[emp.user_id]?.withoutLeave ?? 0
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const groupLabel = (isChinese ? groupInfo?.name_zh : groupInfo?.name) || groupInfo?.name || selectedGroupId;
    link.href = url;
    link.download = `store-wage-cost-${groupLabel}-${dayjs(startDate).format('YYYYMMDD')}-${dayjs(endDate).format('YYYYMMDD')}.csv`;
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
        {formatLeaveLabel(cell) && (
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#2e7d32', fontWeight: 700 }}>
            {formatLeaveLabel(cell)}
          </Typography>
        )}
        {(cell.store_short_name_ || cell.store_code) && (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 600 }}>
            {cell.store_short_name_ || cell.store_code}
            {cell.store_short_name_ && cell.store_code ? ` ${cell.store_code}` : ''}
          </Typography>
        )}
        {(hasValue || (!cell.is_leave && (cell.clock_start_time || cell.clock_end_time))) && (
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
        )}
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
              <AttachMoneyIcon sx={{ fontSize: 32 }} />
              {t('storeWageCostReport.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('storeWageCostReport.subtitle')}
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
                  <InputLabel>{t('storeWageCostReport.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('storeWageCostReport.selectGroup')}
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
                  label={t('storeWageCostReport.startDate')}
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
                  label={t('storeWageCostReport.endDate')}
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
                  {t('storeWageCostReport.exportCsv')}
                </Button>
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip size="small" label={t('storeWageCostReport.legendOt')} sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }} />
              <Chip size="small" label={t('storeWageCostReport.legendPt')} color="secondary" variant="outlined" />
              <Chip size="small" label={t('storeWageCostReport.legendIn1')} variant="outlined" />
              <Chip size="small" label={t('storeWageCostReport.legendLeave')} sx={{ bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 600 }} />
              <Chip size="small" label={t('storeWageCostReport.legendSchedule')} variant="outlined" />
            </Box>
          </Card>

          {!selectedGroupId ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('storeWageCostReport.selectGroupFirst')}
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
                {t('storeWageCostReport.noData')}
              </Typography>
            </Box>
          ) : (
            <>
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
                        {t('storeWageCostReport.employee')}
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
                        {t('storeWageCostReport.total')}
                      </TableCell>
                      <TableCell
                        align="center"
                        sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600, minWidth: 130 }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {t('storeWageCostReport.days')}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', lineHeight: 1.2 }}>
                            {t('storeWageCostReport.daysWithLeave')}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', lineHeight: 1.2 }}>
                            {t('storeWageCostReport.daysWithoutLeave')}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow key={emp.user_id || emp.employee_number} hover>
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
                            {!emp.is_group_member && (
                              <Chip
                                label={t('storeWageCostReport.helper')}
                                size="small"
                                color="warning"
                                variant="outlined"
                                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
                              />
                            )}
                            {getPositionLabel(emp) ? (
                              <Typography variant="caption" color="text.secondary">
                                {getPositionLabel(emp)}
                              </Typography>
                            ) : null}
                          </Box>
                          {renderTerminationDate(emp.termination_date)}
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
                        <TableCell align="center" sx={{ bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.2 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                              {t('storeWageCostReport.daysWithLeave')}: {employeeDayCounts[emp.user_id]?.withLeave ?? 0}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                              {t('storeWageCostReport.daysWithoutLeave')}: {employeeDayCounts[emp.user_id]?.withoutLeave ?? 0}
                            </Typography>
                          </Box>
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
                        {t('storeWageCostReport.summary')}
                      </TableCell>
                      {dates.map((date) => {
                        const dateStr = date.format('YYYY-MM-DD');
                        const tot = dailyTotals[dateStr] || { overtime: 0, work: 0 };
                        const head = dailyHeadcounts[dateStr] || { ft: 0, pt: 0 };
                        return (
                          <TableCell key={dateStr} align="center" sx={{ bgcolor: 'grey.100', fontWeight: 600 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#e65100', fontSize: '0.7rem' }}>
                                OT: {formatMinutes(tot.overtime)}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main', fontSize: '0.7rem' }}>
                                PT: {formatMinutes(tot.work)}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '0.7rem' }}>
                                {t('storeWageCostReport.headcountFt')}: {head.ft}
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.dark', fontSize: '0.7rem' }}>
                                {t('storeWageCostReport.headcountPt')}: {head.pt}
                              </Typography>
                            </Box>
                          </TableCell>
                        );
                      })}
                      <TableCell align="center" sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#e65100', fontSize: '0.7rem' }}>
                            OT: {formatMinutes(grandTotals.overtime)}
                          </Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'secondary.main', fontSize: '0.7rem' }}>
                            PT: {formatMinutes(grandTotals.work)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ bgcolor: 'grey.100' }} />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
            {storeTotals.length > 0 && (
              <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden', mt: 3 }}>
                <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.main' }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.contrastText', fontWeight: 600 }}>
                    {t('storeWageCostReport.storeSummary')}
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>{t('storeWageCostReport.store')}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{t('storeWageCostReport.legendOt')}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{t('storeWageCostReport.legendPt')}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{t('storeWageCostReport.total')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {storeTotals.map((row) => (
                        <TableRow key={row.store_code || row.store_short_name_} hover>
                          <TableCell>
                            {row.store_short_name_ || row.store_code || '--'}
                            {row.store_short_name_ && row.store_code ? ` (${row.store_code})` : ''}
                          </TableCell>
                          <TableCell align="center" sx={{ color: '#e65100', fontWeight: 600 }}>
                            {formatMinutes(row.overtime)}
                          </TableCell>
                          <TableCell align="center" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                            {formatMinutes(row.work)}
                          </TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>
                            {formatMinutes((row.overtime || 0) + (row.work || 0))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            )}
            </>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default StoreWageCostReport;
