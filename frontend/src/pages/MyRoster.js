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
  CalendarToday as CalendarIcon
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

const MyRoster = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentWeek, setCurrentWeek] = useState(() => dayjs().tz('Asia/Hong_Kong').startOf('isoWeek'));
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchMySchedules();
    }
  }, [user?.id, currentWeek]);

  const fetchMySchedules = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const weekStart = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek');
      const weekEnd = weekStart.clone().add(6, 'day');
      const startDateStr = weekStart.format('YYYY-MM-DD');
      const endDateStr = weekEnd.format('YYYY-MM-DD');
      
      const response = await axios.get('/api/schedules', {
        params: {
          user_id: user.id,
          start_date: startDateStr,
          end_date: endDateStr
        }
      });
      
      setSchedules(response.data.schedules || []);
    } catch (error) {
      console.error('Fetch my schedules error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = () => {
    const weekStart = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek');
    return Array.from({ length: 7 }, (_, i) =>
      dayjs.tz(weekStart.format('YYYY-MM-DD'), 'Asia/Hong_Kong').add(i, 'day')
    );
  };

  const getScheduleForDate = (date) => {
    const dateStr = dayjs.tz(date, 'Asia/Hong_Kong').format('YYYY-MM-DD');
    return schedules.find(s => {
      if (!s || !s.schedule_date) return false;
      const sDateStr = typeof s.schedule_date === 'string'
        ? s.schedule_date.split('T')[0].substring(0, 10)
        : dayjs(s.schedule_date).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      return sDateStr === dateStr;
    });
  };

  const formatTime = (time) => {
    if (!time) return '--:--';
    if (typeof time === 'string') {
      return time.length >= 5 ? time.substring(0, 5) : time;
    }
    return time.toString().substring(0, 5);
  };

  const formatEndTime = (endTime) => {
    if (!endTime) return '--:--';
    if (typeof endTime === 'string') {
      return endTime.length >= 5 ? endTime.substring(0, 5) : endTime;
    }
    return endTime.toString().substring(0, 5);
  };

  const getLeaveDisplayText = (schedule) => {
    if (!schedule) return null;
    
    if (schedule.leave_type_name_zh || schedule.leave_type_name || schedule.leave_type_code) {
      const leaveTypeDisplay = i18n.language === 'en'
        ? (schedule.leave_type_code || schedule.leave_type_name)
        : (schedule.leave_type_name_zh || schedule.leave_type_name);
      
      if (schedule.leave_session) {
        const sessionText = schedule.leave_session === 'AM' 
          ? t('schedule.morning') 
          : t('schedule.afternoon');
        return `${leaveTypeDisplay} (${sessionText})`;
      }
      return leaveTypeDisplay;
    }
    
    return null;
  };

  const formatDateDisplay = (date) => {
    if (!date) return '';
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    return isChinese ? date.format('DD/MM') : date.format('MM/DD');
  };

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => prev.tz('Asia/Hong_Kong').subtract(1, 'week').startOf('isoWeek'));
  };

  const handleNextWeek = () => {
    setCurrentWeek(prev => prev.tz('Asia/Hong_Kong').add(1, 'week').startOf('isoWeek'));
  };

  const handleToday = () => {
    setCurrentWeek(dayjs().tz('Asia/Hong_Kong').startOf('isoWeek'));
  };

  const weekDates = getWeekDates();
  const weekStartHK = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek');
  const weekEndHK = weekStartHK.clone().add(6, 'day');
  const weekStartStr = weekStartHK.format('YYYY-MM-DD');
  const weekEndStr = weekEndHK.format('YYYY-MM-DD');

  return (
    <Layout>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4">
                {t('myRoster.title')}
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
                  {t('myRoster.today')}
                </Button>
                <IconButton onClick={handleNextWeek} size="small">
                  <ChevronRightIcon />
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                {weekStartStr} ~ {weekEndStr}
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {weekDates.map((date) => {
                  const schedule = getScheduleForDate(date);
                  const todayHK = dayjs().tz('Asia/Hong_Kong');
                  const isToday = dayjs.tz(date, 'Asia/Hong_Kong').isSame(todayHK, 'day');
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

                          {schedule ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {(schedule.start_time || schedule.end_time) && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('myRoster.workTime')}
                                  </Typography>
                                  <Chip
                                    label={`${formatTime(schedule.start_time)} - ${formatEndTime(schedule.end_time)}`}
                                    color="primary"
                                    size="small"
                                    sx={{ fontWeight: 600, mt: 0.5 }}
                                  />
                                </Box>
                              )}
                              
                              {getLeaveDisplayText(schedule) && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('myRoster.leave')}
                                  </Typography>
                                  <Chip
                                    label={getLeaveDisplayText(schedule)}
                                    color="info"
                                    size="small"
                                    sx={{ fontWeight: 600, mt: 0.5 }}
                                  />
                                </Box>
                              )}

                              {(schedule.store_code || schedule.store_short_name) && (
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {t('schedule.store')}
                                  </Typography>
                                  <Chip
                                    label={schedule.store_short_name || schedule.store_code}
                                    color="secondary"
                                    size="small"
                                    sx={{ fontWeight: 600, mt: 0.5 }}
                                  />
                                </Box>
                              )}

                              {!schedule.start_time && !schedule.end_time && !getLeaveDisplayText(schedule) && !schedule.store_code && !schedule.store_short_name && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                                  {t('myRoster.noSchedule')}
                                </Typography>
                              )}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                              {t('myRoster.noSchedule')}
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

export default MyRoster;

