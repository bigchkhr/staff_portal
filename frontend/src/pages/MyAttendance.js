import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
  Divider
} from '@mui/material';
import { 
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// 設置默認時區為香港（UTC+8）
dayjs.tz.setDefault('Asia/Hong_Kong');

const MyAttendance = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // 默認顯示最近7天（今天往前推6天，加上今天共7天）
  const [startDate, setStartDate] = useState(() => {
    const today = dayjs().tz('Asia/Hong_Kong');
    return today.subtract(6, 'day').startOf('day');
  });
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').endOf('day'));
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchMyAttendance();
    }
  }, [user?.id, startDate, endDate]);

  const fetchMyAttendance = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const startDateStr = dayjs(startDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const endDateStr = dayjs(endDate).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      
      // 直接獲取當前用戶的打卡記錄
      const response = await axios.get('/api/attendances/my-clock-records', {
        params: {
          start_date: startDateStr,
          end_date: endDateStr
        }
      });
      
      // 轉換數據格式以匹配現有的顯示邏輯
      const myData = (response.data.attendance || []).map(item => {
        const mappedItem = {
          user_id: response.data.user?.id || user.id,
          employee_number: response.data.user?.employee_number || user.employee_number,
          display_name: response.data.user?.display_name || user.display_name,
          attendance_date: item.attendance_date,
          schedule: item.schedule,
          attendance: item.attendance,
          clock_records: item.clock_records || []
        };
        
        // 調試日誌
        if (mappedItem.clock_records.length > 0) {
          const validCount = mappedItem.clock_records.filter(r => r.is_valid === true).length;
          const invalidCount = mappedItem.clock_records.filter(r => r.is_valid === false || r.is_valid === null || r.is_valid === undefined).length;
          console.log(`Date ${mappedItem.attendance_date} has ${mappedItem.clock_records.length} clock records (${validCount} valid, ${invalidCount} invalid/unreviewed):`, 
            mappedItem.clock_records.map(r => ({
              time: r.clock_time,
              in_out: r.in_out,
              is_valid: r.is_valid
            }))
          );
        }
        
        return mappedItem;
      });
      
      console.log(`Total attendance data: ${myData.length} days`);
      console.log(`Days with clock records: ${myData.filter(d => d.clock_records && d.clock_records.length > 0).length}`);
      console.log(`Total clock records: ${myData.reduce((sum, d) => sum + (d.clock_records ? d.clock_records.length : 0), 0)}`);
      
      setAttendanceData(myData);
    } catch (error) {
      console.error('Fetch my attendance error:', error);
      // 如果 API 不存在或出錯，設置空數組
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    if (typeof time === 'string') {
      return time.length >= 5 ? time.substring(0, 5) : time;
    }
    return time.toString().substring(0, 5);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    return isChinese 
      ? dayjs(date).format('DD/MM/YYYY')
      : dayjs(date).format('MM/DD/YYYY');
  };

  const getStatusColor = (item) => {
    if (!item.schedule && !item.attendance) {
      return 'default';
    }
    
    // 如果有假期，顯示為 info
    if (item.schedule?.leave_type_name_zh || item.schedule?.leave_type_name) {
      return 'info';
    }
    
    // 檢查是否有打卡記錄
    const hasClockRecords = item.clock_records && item.clock_records.length > 0;
    const hasValidClockRecords = item.clock_records && item.clock_records.some(r => r.is_valid);
    
    if (hasValidClockRecords) {
      return 'success';
    } else if (hasClockRecords) {
      return 'warning';
    }
    
    return 'error';
  };

  const getStatusText = (item) => {
    if (!item.schedule && !item.attendance) {
      return t('myAttendance.noSchedule');
    }
    
    // 如果有假期
    if (item.schedule?.leave_type_name_zh || item.schedule?.leave_type_name) {
      const leaveType = i18n.language === 'en'
        ? (item.schedule.leave_type_code || item.schedule.leave_type_name)
        : (item.schedule.leave_type_name_zh || item.schedule.leave_type_name);
      return leaveType;
    }
    
    // 檢查打卡記錄
    const hasClockRecords = item.clock_records && item.clock_records.length > 0;
    const hasValidClockRecords = item.clock_records && item.clock_records.some(r => r.is_valid);
    
    if (hasValidClockRecords) {
      return t('myAttendance.attended');
    } else if (hasClockRecords) {
      return t('myAttendance.pendingReview');
    }
    
    return t('myAttendance.absent');
  };

  const handlePreviousWeek = () => {
    const daysDiff = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
    const newEnd = dayjs(startDate).subtract(1, 'day');
    setEndDate(newEnd.endOf('day'));
    setStartDate(newEnd.subtract(daysDiff - 1, 'day').startOf('day'));
  };

  const handleNextWeek = () => {
    const daysDiff = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
    const newStart = dayjs(endDate).add(1, 'day');
    setStartDate(newStart.startOf('day'));
    setEndDate(newStart.add(daysDiff - 1, 'day').endOf('day'));
  };

  const handleToday = () => {
    const today = dayjs().tz('Asia/Hong_Kong');
    // 顯示最近7天
    setStartDate(today.subtract(6, 'day').startOf('day'));
    setEndDate(today.endOf('day'));
  };

  return (
    <Layout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4">
                {t('myAttendance.title')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <IconButton onClick={handlePreviousWeek} size="small">
                  <ChevronLeftIcon />
                </IconButton>
                <Button
                  variant="outlined"
                  onClick={handleToday}
                  startIcon={<CalendarIcon />}
                  size="small"
                >
                  {t('myAttendance.today')}
                </Button>
                <IconButton onClick={handleNextWeek} size="small">
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('myAttendance.startDate')}
                  value={startDate}
                  onChange={(newValue) => {
                    if (newValue) {
                      setStartDate(newValue.startOf('day'));
                      // 如果結束日期早於開始日期，自動調整結束日期為開始日期後6天（共7天）
                      const newEnd = dayjs(newValue).add(6, 'day');
                      if (dayjs(endDate).isBefore(newEnd)) {
                        setEndDate(newEnd.endOf('day'));
                      }
                    }
                  }}
                  format="DD/MM/YYYY"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('myAttendance.endDate')}
                  value={endDate}
                  onChange={(newValue) => {
                    if (newValue) {
                      setEndDate(newValue.endOf('day'));
                      // 如果開始日期晚於結束日期，自動調整開始日期為結束日期前6天（共7天）
                      const newStart = dayjs(newValue).subtract(6, 'day');
                      if (dayjs(startDate).isAfter(newStart)) {
                        setStartDate(newStart.startOf('day'));
                      }
                    }
                  }}
                  format="DD/MM/YYYY"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true
                    } 
                  }}
                />
              </Grid>
            </Grid>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : attendanceData.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('myAttendance.noData')}
              </Alert>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>{t('myAttendance.date')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('myAttendance.schedule')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('myAttendance.clockRecords')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('myAttendance.status')}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{t('myAttendance.remarks')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceData.map((item) => (
                      <TableRow key={`${item.user_id}_${item.attendance_date}`} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {formatDate(item.attendance_date)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {dayjs(item.attendance_date).format('ddd')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {item.schedule ? (
                            <Box>
                              {item.schedule.start_time && item.schedule.end_time && (
                                <Typography variant="body2">
                                  {formatTime(item.schedule.start_time)} - {formatTime(item.schedule.end_time)}
                                </Typography>
                              )}
                              {(item.schedule.leave_type_name_zh || item.schedule.leave_type_name) && (
                                <Chip
                                  label={i18n.language === 'en'
                                    ? (item.schedule.leave_type_code || item.schedule.leave_type_name)
                                    : (item.schedule.leave_type_name_zh || item.schedule.leave_type_name)}
                                  size="small"
                                  color="info"
                                  sx={{ mt: 0.5 }}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('myAttendance.noSchedule')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.clock_records && item.clock_records.length > 0 ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {item.clock_records.map((record, idx) => {
                                // 確保顯示所有記錄，包括未審核的（is_valid 為 false、null 或 undefined）
                                const isValid = record.is_valid === true;
                                const isUnreviewed = record.is_valid === false || record.is_valid === null || record.is_valid === undefined;
                                
                                return (
                                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {isValid ? (
                                      <CheckCircleIcon fontSize="small" color="success" />
                                    ) : isUnreviewed ? (
                                      <CancelIcon fontSize="small" color="warning" />
                                    ) : (
                                      <CancelIcon fontSize="small" color="error" />
                                    )}
                                    <Typography variant="body2">
                                      {formatTime(record.clock_time)} ({record.in_out})
                                      {isUnreviewed && (
                                        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                          (待審核)
                                        </Typography>
                                      )}
                                    </Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {t('myAttendance.noClockRecords')}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusText(item)}
                            color={getStatusColor(item)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {item.attendance?.remarks || '--'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Container>
      </LocalizationProvider>
    </Layout>
  );
};

export default MyAttendance;

