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
  useTheme,
  useMediaQuery
} from '@mui/material';
import { 
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

// 設置默認時區為香港（UTC+8）
dayjs.tz.setDefault('Asia/Hong_Kong');

const MyAttendance = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // 使用週視圖（從本週一開始）
  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('isoWeek'));
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchMyAttendance();
    }
  }, [user?.id, currentWeek]);

  const fetchMyAttendance = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const weekStart = currentWeek.clone().startOf('isoWeek');
      const weekEnd = currentWeek.clone().endOf('isoWeek');
      const startDateStr = weekStart.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const endDateStr = weekEnd.tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      
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

  const getWeekDates = () => {
    const dates = [];
    const weekStart = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek');
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.clone().add(i, 'day'));
    }
    return dates;
  };

  const getAttendanceForDate = (date) => {
    const dateStr = dayjs(date).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
    return attendanceData.find(item => {
      if (!item || !item.attendance_date) return false;
      
      let itemDateStr = item.attendance_date;
      
      // 處理 Date 對象
      if (itemDateStr instanceof Date) {
        itemDateStr = dayjs(itemDateStr).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      } 
      // 處理字符串
      else if (typeof itemDateStr === 'string') {
        // 移除時間部分（如果有）
        if (itemDateStr.includes('T')) {
          itemDateStr = itemDateStr.split('T')[0];
        }
        // 移除空格後的時間部分（如果有）
        if (itemDateStr.includes(' ')) {
          itemDateStr = itemDateStr.split(' ')[0];
        }
        // 確保只取前10個字符（YYYY-MM-DD）
        if (itemDateStr.length > 10) {
          itemDateStr = itemDateStr.substring(0, 10);
        }
        // 使用 dayjs 標準化日期格式
        const parsed = dayjs(itemDateStr);
        if (parsed.isValid()) {
          itemDateStr = parsed.format('YYYY-MM-DD');
        }
      }
      
      // 嚴格比較日期字符串
      return itemDateStr === dateStr;
    });
  };

  const formatDateDisplay = (date) => {
    if (!date) return '';
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    return isChinese ? date.format('DD/MM') : date.format('MM/DD');
  };

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => prev.subtract(1, 'week').startOf('isoWeek'));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => prev.add(1, 'week').startOf('isoWeek'));
  };

  const handleToday = () => {
    setCurrentWeek(dayjs().startOf('isoWeek'));
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

            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {currentWeek.startOf('isoWeek').format('YYYY-MM-DD')} ~ {currentWeek.endOf('isoWeek').format('YYYY-MM-DD')}
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {getWeekDates().map((date) => {
                  const item = getAttendanceForDate(date);
                  const isToday = date.isSame(dayjs(), 'day');
                  const dateStr = date.format('YYYY-MM-DD');
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} lg={12/7} key={dateStr}>
                      <Card
                        elevation={isToday ? 4 : 2}
                        sx={{
                          height: '100%',
                          border: isToday ? 2 : 0,
                          borderColor: 'primary.main',
                          bgcolor: isToday ? 'action.selected' : 'background.paper',
                          transition: 'all 0.3s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: 6,
                          },
                        }}
                      >
                        <CardContent>
                          <Box sx={{ mb: 2, textAlign: 'center' }}>
                            <Typography
                              variant="h6"
                              sx={{
                                fontWeight: isToday ? 700 : 600,
                                color: isToday ? 'primary.main' : 'text.primary',
                              }}
                            >
                              {formatDateDisplay(date)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {date.format('ddd')}
                            </Typography>
                          </Box>

                          {item ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {/* 排班信息 */}
                              {item.schedule ? (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('myAttendance.schedule')}
                                  </Typography>
                                  {item.schedule.start_time && item.schedule.end_time && (
                                    <Chip
                                      label={`${formatTime(item.schedule.start_time)} - ${formatTime(item.schedule.end_time)}`}
                                      color="primary"
                                      size="small"
                                      sx={{ fontWeight: 600, mt: 0.5 }}
                                    />
                                  )}
                                  {(item.schedule.leave_type_name_zh || item.schedule.leave_type_name) && (
                                    <Chip
                                      label={i18n.language === 'en'
                                        ? (item.schedule.leave_type_code || item.schedule.leave_type_name)
                                        : (item.schedule.leave_type_name_zh || item.schedule.leave_type_name)}
                                      color="info"
                                      size="small"
                                      sx={{ fontWeight: 600, mt: 0.5, display: 'block' }}
                                    />
                                  )}
                                  {item.schedule.store_code && (
                                    <Chip
                                      label={item.schedule.store_code}
                                      color="secondary"
                                      size="small"
                                      sx={{ fontWeight: 600, mt: 0.5 }}
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('myAttendance.schedule')}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                    {t('myAttendance.noSchedule')}
                                  </Typography>
                                </Box>
                              )}

                              {/* 打卡記錄 */}
                              <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {t('myAttendance.clockRecords')}
                                </Typography>
                                {item.clock_records && item.clock_records.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                                    {item.clock_records.map((record, idx) => {
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
                                          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                                            {formatTime(record.clock_time)} ({record.in_out})
                                            {isUnreviewed && (
                                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                                ({t('myAttendance.pendingReview')})
                                              </Typography>
                                            )}
                                          </Typography>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', mt: 0.5 }}>
                                    {t('myAttendance.noClockRecords')}
                                  </Typography>
                                )}
                              </Box>

                              {/* 狀態 */}
                              <Box>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  {t('myAttendance.status')}
                                </Typography>
                                <Chip
                                  label={getStatusText(item)}
                                  color={getStatusColor(item)}
                                  size="small"
                                  sx={{ fontWeight: 600, mt: 0.5 }}
                                />
                              </Box>

                              {/* 備註 */}
                              {item.attendance?.remarks && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('myAttendance.remarks')}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.85rem' }}>
                                    {item.attendance.remarks}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                              {t('myAttendance.noData')}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        </Container>
      </LocalizationProvider>
    </Layout>
  );
};

export default MyAttendance;

