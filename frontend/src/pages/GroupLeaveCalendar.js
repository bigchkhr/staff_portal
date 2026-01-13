import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  CircularProgress,
  Alert
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
import { getSessionForDate, sessionToFlags } from '../utils/leaveSessionUtils';
import 'dayjs/locale/zh-tw';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

// 設置默認時區為香港（UTC+8）
dayjs.tz.setDefault('Asia/Hong_Kong');

const GroupLeaveCalendar = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('isoWeek'));
  const [schedules, setSchedules] = useState([]); // 存儲假期申請數據
  const [loading, setLoading] = useState(false);
  const [groupMembers, setGroupMembers] = useState({}); // { groupId: [members] }

  useEffect(() => {
    fetchDepartmentGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupIds.length > 0) {
      fetchGroupMembers();
    }
  }, [selectedGroupIds]);

  useEffect(() => {
    if (selectedGroupIds.length > 0 && Object.keys(groupMembers).length > 0) {
      // 確保群組成員數據已加載後再獲取假期申請
      fetchLeaveApplications();
    }
  }, [selectedGroupIds, currentWeek, groupMembers]);

  const fetchDepartmentGroups = async () => {
    try {
      const response = await axios.get('/api/groups/department?closed=false');
      const groups = response.data.groups || [];
      setDepartmentGroups(groups);
      
      // 如果用戶只屬於一個群組，自動選擇
      if (groups.length === 1) {
        setSelectedGroupIds([groups[0].id]);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
    }
  };

  const fetchGroupMembers = async () => {
    const membersMap = {};
    
    for (const groupId of selectedGroupIds) {
      try {
        const response = await axios.get(`/api/groups/department/${groupId}/members`);
        const members = response.data.members || [];
        members.sort((a, b) => {
          const aNum = a.employee_number || '';
          const bNum = b.employee_number || '';
          return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
        });
        membersMap[groupId] = members;
      } catch (error) {
        console.error(`Fetch group members error for group ${groupId}:`, error);
        membersMap[groupId] = [];
      }
    }
    
    setGroupMembers(membersMap);
  };

  const fetchLeaveApplications = async () => {
    if (selectedGroupIds.length === 0) return;
    
    setLoading(true);
    try {
      // 確保不修改原始的 currentWeek，使用香港時區
      const weekStart = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = currentWeek.clone().tz('Asia/Hong_Kong').endOf('isoWeek').format('YYYY-MM-DD');
      
      console.log('Fetching leave applications with params:', {
        selectedGroupIds,
        weekStart,
        weekEnd,
        currentWeek: currentWeek.format('YYYY-MM-DD')
      });
      
      // 為每個選中的群組獲取假期申請數據
      const allLeaveApplications = [];
      
      for (const groupId of selectedGroupIds) {
        const members = groupMembers[groupId] || [];
        
        // 為每個群組成員獲取已批准的假期申請
        for (const member of members) {
          try {
            // 先不帶日期範圍查詢，看看是否有任何已批准的申請
            const testParams = {
              user_id: member.id,
              status: 'approved'
            };
            
            const testResponse = await axios.get('/api/leaves', { params: testParams });
            const allApplications = testResponse.data.applications || [];
            
            console.log(`All approved leave applications for user ${member.id} (${member.employee_number}):`, allApplications.length, 'applications');
            
            if (allApplications.length > 0) {
              console.log(`Sample application dates:`, allApplications.slice(0, 3).map(app => ({
                id: app.id,
                start_date: app.start_date,
                end_date: app.end_date,
                status: app.status,
                is_reversed: app.is_reversed,
                is_cancellation_request: app.is_cancellation_request,
                start_session: app.start_session,
                end_session: app.end_session
              })));
              
              // 檢查是否有與本週重疊的申請（使用香港時區）
              const weekStartDate = dayjs.tz(weekStart, 'Asia/Hong_Kong').startOf('day');
              const weekEndDate = dayjs.tz(weekEnd, 'Asia/Hong_Kong').startOf('day');
              const overlappingApps = allApplications.filter(app => {
                // 處理日期字符串，轉換為香港時區
                let appStart, appEnd;
                
                if (app.start_date.includes('T') && app.start_date.includes('Z')) {
                  appStart = dayjs.utc(app.start_date).tz('Asia/Hong_Kong').startOf('day');
                } else if (app.start_date.includes('T')) {
                  appStart = dayjs.tz(app.start_date, 'Asia/Hong_Kong').startOf('day');
                } else {
                  appStart = dayjs.tz(app.start_date, 'Asia/Hong_Kong').startOf('day');
                }
                
                if (app.end_date.includes('T') && app.end_date.includes('Z')) {
                  appEnd = dayjs.utc(app.end_date).tz('Asia/Hong_Kong').startOf('day');
                } else if (app.end_date.includes('T')) {
                  appEnd = dayjs.tz(app.end_date, 'Asia/Hong_Kong').startOf('day');
                } else {
                  appEnd = dayjs.tz(app.end_date, 'Asia/Hong_Kong').startOf('day');
                }
                
                // 檢查是否有重疊：申請的開始日期 <= 週的結束日期 且 申請的結束日期 >= 週的開始日期
                return appStart.isSameOrBefore(weekEndDate, 'day') && appEnd.isSameOrAfter(weekStartDate, 'day');
              });
              
              console.log(`Overlapping applications for user ${member.id}:`, overlappingApps.length, overlappingApps);
            }
            
            // 擴大查詢範圍，確保包含所有相關假期
            // 如果假期是 8/12 - 12/12，而週是 8/12 - 14/12，我們需要確保能查到這個假期
            // 所以我們擴大查詢範圍：從週開始前7天到週結束後7天
            const expandedWeekStart = dayjs.tz(weekStart, 'Asia/Hong_Kong').subtract(7, 'day').format('YYYY-MM-DD');
            const expandedWeekEnd = dayjs.tz(weekEnd, 'Asia/Hong_Kong').add(7, 'day').format('YYYY-MM-DD');
            
            const params = {
              user_id: member.id,
              status: 'approved', // 只獲取已批准的申請
              start_date_from: expandedWeekStart,
              end_date_to: expandedWeekEnd
            };
            
            console.log(`Fetching leave applications for user ${member.id} (${member.employee_number}) with expanded date range params:`, {
              ...params,
              weekStart,
              weekEnd,
              expandedWeekStart,
              expandedWeekEnd
            });
            
            const response = await axios.get('/api/leaves', { params });
            
            const applications = response.data.applications || [];
            console.log(`Leave applications for user ${member.id} in expanded date range:`, applications.length, 'applications');
            
            if (applications.length > 0) {
              console.log(`Application details:`, applications.map(app => ({
                id: app.id,
                start_date: app.start_date,
                end_date: app.end_date,
                status: app.status
              })));
            }
            
            // 過濾掉已取消或已銷假的申請
            const validApplications = applications.filter(app => 
              app.status === 'approved' && 
              !app.is_cancellation_request && 
              !app.is_reversed
            );
            
            // 將申請轉換為日期範圍內的每日記錄
            validApplications.forEach(app => {
              // 處理日期字符串，考慮香港時區（UTC+8）
              // 如果日期是 UTC 格式（如 '2025-12-12T16:00:00.000Z'），需要轉換為香港時區
              let startDate, endDate;
              
              if (app.start_date.includes('T') && app.start_date.includes('Z')) {
                // UTC 時間字符串，轉換為香港時區
                startDate = dayjs.utc(app.start_date).tz('Asia/Hong_Kong').startOf('day');
              } else if (app.start_date.includes('T')) {
                // 有時區信息的時間字符串
                startDate = dayjs.tz(app.start_date, 'Asia/Hong_Kong').startOf('day');
              } else {
                // 純日期字符串，假設是香港時區
                startDate = dayjs.tz(app.start_date, 'Asia/Hong_Kong').startOf('day');
              }
              
              if (app.end_date.includes('T') && app.end_date.includes('Z')) {
                // UTC 時間字符串，轉換為香港時區
                endDate = dayjs.utc(app.end_date).tz('Asia/Hong_Kong').startOf('day');
              } else if (app.end_date.includes('T')) {
                // 有時區信息的時間字符串
                endDate = dayjs.tz(app.end_date, 'Asia/Hong_Kong').startOf('day');
              } else {
                // 純日期字符串，假設是香港時區
                endDate = dayjs.tz(app.end_date, 'Asia/Hong_Kong').startOf('day');
              }
              
              // 週的日期也使用香港時區
              const weekStartDate = dayjs.tz(weekStart, 'Asia/Hong_Kong').startOf('day');
              const weekEndDate = dayjs.tz(weekEnd, 'Asia/Hong_Kong').startOf('day');
              
              console.log(`Processing application ${app.id}:`, {
                original_start: app.start_date,
                original_end: app.end_date,
                parsed_start: startDate.format('YYYY-MM-DD'),
                parsed_end: endDate.format('YYYY-MM-DD'),
                week_start: weekStartDate.format('YYYY-MM-DD'),
                week_end: weekEndDate.format('YYYY-MM-DD')
              });
              
              // 使用日期字符串數組來確保包含所有日期
              const dateRange = [];
              let currentDate = startDate.clone();
              
              // 確保包含結束日期
              while (currentDate.isSameOrBefore(endDate, 'day')) {
                dateRange.push(currentDate.format('YYYY-MM-DD'));
                currentDate = currentDate.add(1, 'day').clone();
              }
              
              console.log(`Date range for application ${app.id}:`, {
                start: startDate.format('YYYY-MM-DD'),
                end: endDate.format('YYYY-MM-DD'),
                dates: dateRange,
                weekStart,
                weekEnd
              });
              
              // 遍歷所有日期
              dateRange.forEach((currentDateStr, index) => {
                // 檢查日期是否在本週範圍內（使用字符串比較確保準確）
                const isInWeek = currentDateStr >= weekStart && currentDateStr <= weekEnd;
                
                if (isInWeek) {
                  // 確保日期格式一致：使用已解析的日期字符串
                  const normalizedApp = {
                    ...app,
                    start_date: startDate.format('YYYY-MM-DD'), // 使用已解析的日期格式
                    end_date: endDate.format('YYYY-MM-DD')      // 使用已解析的日期格式
                  };
                  
                  // 使用統一的工具函數計算該日期的時段
                  const session = getSessionForDate(normalizedApp, currentDateStr);
                  const { isMorning, isAfternoon } = sessionToFlags(session);
                  
                  allLeaveApplications.push({
                    user_id: member.id,
                    employee_number: member.employee_number,
                    user_name: member.name,
                    user_name_zh: member.name_zh,
                    schedule_date: currentDateStr,
                    leave_type_id: app.leave_type_id,
                    leave_type_code: app.leave_type_code,
                    leave_type_name: app.leave_type_name,
                    leave_type_name_zh: app.leave_type_name_zh,
                    is_morning_leave: isMorning,
                    is_afternoon_leave: isAfternoon,
                    leave_session: session, // 保存 session 以便後續使用
                    department_group_id: groupId
                  });
                }
              });
            });
          } catch (error) {
            console.error(`Fetch leave applications error for user ${member.id}:`, {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status
            });
          }
        }
      }
      
      // 合併同一天多個假期申請的記錄
      // 使用 Map 來存儲每個用戶每個日期的假期記錄
      const leaveMap = new Map();
      
      allLeaveApplications.forEach(leave => {
        const key = `${leave.user_id}_${leave.schedule_date}`;
        const existing = leaveMap.get(key);
        
        if (existing) {
          // 如果已存在，合併上午假和下午假標記
          const newIsMorning = leave.is_morning_leave === true || leave.is_morning_leave === 1;
          const newIsAfternoon = leave.is_afternoon_leave === true || leave.is_afternoon_leave === 1;
          const existingIsMorning = existing.is_morning_leave === true || existing.is_morning_leave === 1;
          const existingIsAfternoon = existing.is_afternoon_leave === true || existing.is_afternoon_leave === 1;
          
          // 合併：如果任一記錄有上午假，則為上午假；如果任一記錄有下午假，則為下午假
          const mergedIsMorning = existingIsMorning || newIsMorning;
          const mergedIsAfternoon = existingIsAfternoon || newIsAfternoon;
          
          // 如果合併後是全天假，清除 leave_session；否則保留其中一個 session
          let mergedSession = null;
          if (mergedIsMorning && mergedIsAfternoon) {
            // 全天假，session 為 null
            mergedSession = null;
          } else if (mergedIsMorning) {
            // 只有上午假
            mergedSession = 'AM';
          } else if (mergedIsAfternoon) {
            // 只有下午假
            mergedSession = 'PM';
          }
          
          console.log(`Merging leave records for user ${leave.user_id} on ${leave.schedule_date}:`, {
            existing: {
              is_morning_leave: existing.is_morning_leave,
              is_afternoon_leave: existing.is_afternoon_leave,
              leave_session: existing.leave_session
            },
            new: {
              is_morning_leave: leave.is_morning_leave,
              is_afternoon_leave: leave.is_afternoon_leave,
              leave_session: leave.leave_session
            },
            merged: {
              is_morning_leave: mergedIsMorning,
              is_afternoon_leave: mergedIsAfternoon,
              leave_session: mergedSession
            }
          });
          
          leaveMap.set(key, {
            ...existing,
            is_morning_leave: mergedIsMorning,
            is_afternoon_leave: mergedIsAfternoon,
            leave_session: mergedSession
          });
        } else {
          leaveMap.set(key, leave);
        }
      });
      
      const mergedLeaves = Array.from(leaveMap.values());
      
      console.log('All leave applications (before merge):', allLeaveApplications.length);
      console.log('Merged leave applications:', mergedLeaves.length);
      
      // 按用戶和日期排序，方便調試
      mergedLeaves.sort((a, b) => {
        if (a.user_id !== b.user_id) return a.user_id - b.user_id;
        return a.schedule_date.localeCompare(b.schedule_date);
      });
      
      console.log('Sample merged leaves (first 10):', mergedLeaves.slice(0, 10).map(l => ({
        user_id: l.user_id,
        schedule_date: l.schedule_date,
        is_morning_leave: l.is_morning_leave,
        is_afternoon_leave: l.is_afternoon_leave,
        leave_session: l.leave_session,
        leave_type_name_zh: l.leave_type_name_zh
      })));
      
      setSchedules(mergedLeaves);
    } catch (error) {
      console.error('Fetch leave applications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    const weekStart = currentWeek.clone().tz('Asia/Hong_Kong').startOf('isoWeek');
    for (let i = 0; i < 7; i++) {
      dates.push(weekStart.clone().add(i, 'day'));
    }
    return dates;
  };

  const getScheduleForUserAndDate = (userId, date) => {
    // 確保日期格式一致，使用香港時區
    const dateStr = dayjs(date).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
    const userIdNum = Number(userId);
    
    return schedules.find(s => {
      const sUserId = Number(s.user_id);
      if (sUserId !== userIdNum) return false;
      
      let sDateStr = s.schedule_date;
      if (sDateStr instanceof Date) {
        sDateStr = dayjs(sDateStr).format('YYYY-MM-DD');
      } else if (sDateStr && typeof sDateStr === 'string') {
        // 如果包含時間部分，只取日期部分
        if (sDateStr.includes('T')) {
          sDateStr = sDateStr.split('T')[0];
        }
        // 確保格式是 YYYY-MM-DD
        if (sDateStr.length > 10) {
          sDateStr = sDateStr.substring(0, 10);
        }
      }
      
      return sDateStr === dateStr;
    });
  };

  const isOnLeave = (schedule) => {
    if (!schedule) return false;
    // 檢查是否有上午假、下午假或假期類型
    // 處理多種可能的數據格式：true, 1, "true", "1"
    const hasMorningLeave = schedule.is_morning_leave === true || 
                           schedule.is_morning_leave === 1 || 
                           schedule.is_morning_leave === '1' || 
                           schedule.is_morning_leave === 'true';
    const hasAfternoonLeave = schedule.is_afternoon_leave === true || 
                              schedule.is_afternoon_leave === 1 || 
                              schedule.is_afternoon_leave === '1' || 
                              schedule.is_afternoon_leave === 'true';
    const hasLeaveType = schedule.leave_type_id !== null && 
                         schedule.leave_type_id !== undefined && 
                         schedule.leave_type_id !== '';
    
    const result = hasMorningLeave || hasAfternoonLeave || hasLeaveType;
    if (result) {
      console.log('isOnLeave check:', {
        schedule_id: schedule.id,
        user_id: schedule.user_id,
        date: schedule.schedule_date,
        is_morning_leave: schedule.is_morning_leave,
        is_afternoon_leave: schedule.is_afternoon_leave,
        leave_type_id: schedule.leave_type_id,
        hasMorningLeave,
        hasAfternoonLeave,
        hasLeaveType,
        result
      });
    }
    return result;
  };

  const getLeaveDisplayText = (schedule) => {
    if (!schedule) return null;
    
    const isMorning = schedule.is_morning_leave === true || schedule.is_morning_leave === 1;
    const isAfternoon = schedule.is_afternoon_leave === true || schedule.is_afternoon_leave === 1;
    
    // 獲取假期類型名稱
    const leaveTypeName = i18n.language === 'en'
      ? (schedule.leave_type_code || schedule.leave_type_name)
      : (schedule.leave_type_name_zh || schedule.leave_type_name);
    
    // 獲取時段文字
    let periodText = '';
    if (isMorning && isAfternoon) {
      periodText = t('schedule.fullDayLeave');
    } else if (isMorning) {
      periodText = t('schedule.morningLeave');
    } else if (isAfternoon) {
      periodText = t('schedule.afternoonLeave');
    }
    
    // 如果有假期類型，返回類型名稱；如果有時段，也加上時段
    if (leaveTypeName && periodText) {
      return `${leaveTypeName} (${periodText})`;
    } else if (leaveTypeName) {
      return leaveTypeName;
    } else if (periodText) {
      return periodText;
    }
    
    return null;
  };
  
  const getLeaveTypeName = (schedule) => {
    if (!schedule) return null;
    
    if (i18n.language === 'en') {
      // 英文環境下顯示 leave code
      return schedule.leave_type_code || schedule.leave_type_name;
    } else {
      // 中文環境下顯示中文名稱
      return schedule.leave_type_name_zh || schedule.leave_type_name;
    }
  };
  
  const getLeavePeriodText = (schedule) => {
    if (!schedule) return null;
    
    const isMorning = schedule.is_morning_leave === true || schedule.is_morning_leave === 1;
    const isAfternoon = schedule.is_afternoon_leave === true || schedule.is_afternoon_leave === 1;
    
    if (isMorning && isAfternoon) {
      return t('schedule.fullDayLeave');
    } else if (isMorning) {
      return t('schedule.morningLeave');
    } else if (isAfternoon) {
      return t('schedule.afternoonLeave');
    }
    
    return null;
  };
  
  const getLeavePeriodColor = (schedule) => {
    if (!schedule) return 'default';
    
    const isMorning = schedule.is_morning_leave === true || schedule.is_morning_leave === 1;
    const isAfternoon = schedule.is_afternoon_leave === true || schedule.is_afternoon_leave === 1;
    
    if (isMorning && isAfternoon) {
      return 'info'; // 全天假 - 使用柔和的藍色
    } else if (isMorning) {
      return 'success'; // 上午假 - 使用柔和的綠色
    } else if (isAfternoon) {
      return 'warning'; // 下午假 - 使用柔和的橙色
    }
    
    return 'default';
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

  const handleGroupChange = (event) => {
    const value = event.target.value;
    setSelectedGroupIds(typeof value === 'string' ? value.split(',') : value);
  };

  const weekDates = getWeekDates();
  const weekStartStr = currentWeek.startOf('isoWeek').format('YYYY-MM-DD');
  const weekEndStr = currentWeek.endOf('isoWeek').format('YYYY-MM-DD');

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h4">
              {t('groupLeaveCalendar.title')}
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
                {t('groupLeaveCalendar.today')}
              </Button>
              <IconButton onClick={handleNextWeek} size="small">
                <ChevronRightIcon />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('groupLeaveCalendar.selectGroups')}</InputLabel>
                  <Select
                    multiple
                    value={selectedGroupIds}
                    onChange={handleGroupChange}
                    label={t('groupLeaveCalendar.selectGroups')}
                    renderValue={(selected) => {
                      if (selected.length === 0) return '';
                      return selected.map(id => {
                        const group = departmentGroups.find(g => g.id === id);
                        return group 
                          ? (i18n.language === 'zh-TW' || i18n.language === 'zh-CN' 
                              ? group.name_zh || group.name 
                              : group.name)
                          : id;
                      }).join(', ');
                    }}
                  >
                    {departmentGroups.map(group => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'zh-TW' || i18n.language === 'zh-CN' 
                          ? group.name_zh || group.name 
                          : group.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body1" sx={{ textAlign: 'right' }}>
                  {weekStartStr} ~ {weekEndStr}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : selectedGroupIds.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('groupLeaveCalendar.selectGroupsFirst')}
            </Alert>
          ) : (
            <Box>
              {selectedGroupIds.map(groupId => {
                const group = departmentGroups.find(g => g.id === groupId);
                const members = groupMembers[groupId] || [];
                const groupSchedules = schedules.filter(s => Number(s.department_group_id) === Number(groupId));
                
                // 檢查本週是否有任何員工放假
                const hasAnyLeave = weekDates.some(date => {
                  return members.some(member => {
                    const schedule = getScheduleForUserAndDate(member.id, date);
                    return isOnLeave(schedule);
                  });
                });

                if (!hasAnyLeave) {
                  return (
                    <Card key={groupId} sx={{ mb: 3 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {i18n.language === 'zh-TW' || i18n.language === 'zh-CN' 
                            ? group?.name_zh || group?.name 
                            : group?.name}
                        </Typography>
                        <Alert severity="info">
                          {t('groupLeaveCalendar.noLeaveThisWeek')}
                        </Alert>
                      </CardContent>
                    </Card>
                  );
                }

                return (
                  <Card key={groupId} sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                        {i18n.language === 'zh-TW' || i18n.language === 'zh-CN' 
                          ? group?.name_zh || group?.name 
                          : group?.name}
                      </Typography>
                      
                      <Grid container spacing={1}>
                        {weekDates.map((date, dateIndex) => {
                          const dateStr = date.format('YYYY-MM-DD');
                          const isToday = date.tz('Asia/Hong_Kong').isSame(dayjs().tz('Asia/Hong_Kong'), 'day');
                          // 直接找出當天放假的員工
                          const dayMembersOnLeave = members.filter(member => {
                            const schedule = getScheduleForUserAndDate(member.id, date);
                            const onLeave = isOnLeave(schedule);
                            if (onLeave) {
                              console.log(`Member ${member.employee_number} (${member.name_zh || member.name}) on leave on ${dateStr}:`, schedule);
                            }
                            return onLeave;
                          });

                          return (
                            <Grid item xs={12} sm={6} md={12/7} key={dateIndex}>
                              <Paper 
                                variant="outlined" 
                                sx={{ 
                                  p: 1.5, 
                                  height: '100%',
                                  backgroundColor: isToday ? 'action.selected' : 'background.paper',
                                  border: isToday ? 2 : 1,
                                  borderColor: isToday ? 'primary.main' : 'divider'
                                }}
                              >
                                <Typography 
                                  variant="subtitle2" 
                                  fontWeight="bold" 
                                  gutterBottom
                                  sx={{ mb: 1 }}
                                >
                                  {date.format('MM/DD')} ({date.format('ddd')})
                                </Typography>
                                
                                {dayMembersOnLeave.length === 0 ? (
                                  <Typography variant="caption" color="text.secondary">
                                    {t('groupLeaveCalendar.noLeave')}
                                  </Typography>
                                ) : (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {dayMembersOnLeave.map(member => {
                                      const schedule = getScheduleForUserAndDate(member.id, date);
                                      const leaveTypeName = getLeaveTypeName(schedule);
                                      const leavePeriodText = getLeavePeriodText(schedule);
                                      const leavePeriodColor = getLeavePeriodColor(schedule);
                                      const memberName = i18n.language === 'zh-TW' || i18n.language === 'zh-CN'
                                        ? member.name_zh || member.name
                                        : member.name;
                                      
                                      return (
                                        <Box 
                                          key={member.id} 
                                          sx={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            gap: 0.3,
                                            mb: 0.5
                                          }}
                                        >
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                            <Typography variant="caption" fontWeight="medium">
                                              {member.employee_number}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              {memberName}
                                            </Typography>
                                          </Box>
                                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                            {leaveTypeName && (
                                              <Chip 
                                                label={leaveTypeName} 
                                                size="small" 
                                                sx={{ 
                                                  fontSize: '0.65rem', 
                                                  height: '18px',
                                                  backgroundColor: 'rgba(100, 149, 237, 0.15)',
                                                  color: 'rgba(70, 130, 180, 0.9)',
                                                  fontWeight: 500
                                                }}
                                              />
                                            )}
                                            {leavePeriodText && (
                                              <Chip 
                                                label={leavePeriodText} 
                                                size="small" 
                                                sx={{ 
                                                  fontSize: '0.65rem', 
                                                  height: '18px',
                                                  fontWeight: 500,
                                                  // 根據假期類型設置不同的柔和顏色
                                                  ...(leavePeriodColor === 'info' && {
                                                    // 全天假 - 柔和的藍灰色
                                                    backgroundColor: 'rgba(176, 196, 222, 0.25)',
                                                    color: 'rgba(70, 130, 180, 0.85)'
                                                  }),
                                                  ...(leavePeriodColor === 'success' && {
                                                    // 上午假 - 柔和的綠色
                                                    backgroundColor: 'rgba(144, 238, 144, 0.25)',
                                                    color: 'rgba(60, 179, 113, 0.85)'
                                                  }),
                                                  ...(leavePeriodColor === 'warning' && {
                                                    // 下午假 - 柔和的橙色
                                                    backgroundColor: 'rgba(255, 218, 185, 0.35)',
                                                    color: 'rgba(255, 140, 0, 0.85)'
                                                  })
                                                }}
                                              />
                                            )}
                                          </Box>
                                        </Box>
                                      );
                                    })}
                                  </Box>
                                )}
                              </Paper>
                            </Grid>
                          );
                        })}
                      </Grid>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default GroupLeaveCalendar;

