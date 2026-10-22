import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Badge,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  EventNote as EventNoteIcon,
  Assessment as AssessmentIcon,
  Description as DescriptionIcon,
  FileDownload as FileDownloadIcon,
  TableChart as TableChartIcon,
  AttachMoney as AttachMoneyIcon,
  PlaylistAddCheck as PlaylistAddCheckIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Layout from '../components/Layout';
import ShiftUserSchedules from './ShiftUserSchedules';

const ShiftManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, isSystemAdmin } = useAuth();
  const [canViewApproverFeatures, setCanViewApproverFeatures] = useState(false);
  const [canViewAttendanceManagement, setCanViewAttendanceManagement] = useState(false);
  const [schedulePendingCount, setSchedulePendingCount] = useState(0);

  useEffect(() => {
    const checkShiftMenuPermissions = async () => {
      if (isSystemAdmin) {
        setCanViewApproverFeatures(true);
        setCanViewAttendanceManagement(true);
        return;
      }

      if (!user || !user.delegation_groups || user.delegation_groups.length === 0) {
        setCanViewApproverFeatures(false);
        setCanViewAttendanceManagement(false);
        return;
      }

      try {
        const response = await axios.get('/api/groups/department');
        const departmentGroups = response.data.groups || [];
        const userDelegationGroupIds = user.delegation_groups.map(g => Number(g.id));
        const hasRole = (group, field) => {
          const id = group[field] ? Number(group[field]) : null;
          return id !== null && userDelegationGroupIds.includes(id);
        };
        const isApprover = departmentGroups.some(group =>
          hasRole(group, 'approver_1_id') || hasRole(group, 'approver_2_id') || hasRole(group, 'approver_3_id')
        );
        const isSupervisor = departmentGroups.some(group => hasRole(group, 'supervisor_id'));
        const isObserver = departmentGroups.some(group => hasRole(group, 'observer_id'));
        const isChecker = departmentGroups.some(group => hasRole(group, 'checker_id'));

        setCanViewApproverFeatures(isApprover || isSupervisor || isObserver);
        setCanViewAttendanceManagement(isChecker || isApprover || isSupervisor || isObserver);
      } catch (error) {
        console.error('檢查編更選單權限錯誤:', error);
        setCanViewApproverFeatures(false);
        setCanViewAttendanceManagement(false);
      }
    };

    checkShiftMenuPermissions();
    const fetchSchedulePendingCount = async () => {
      try {
        const response = await axios.get('/api/schedules/changes/pending-count');
        setSchedulePendingCount(response.data.pending_count || 0);
      } catch (error) {
        console.error('獲取待批核編更數量錯誤:', error);
        setSchedulePendingCount(0);
      }
    };
    fetchSchedulePendingCount();
  }, [user, isSystemAdmin]);

  const shiftItems = [
    {
      key: 'myRoster',
      icon: <CalendarTodayIcon sx={{ fontSize: 48 }} />,
      path: '/my-roster',
      translationKey: 'myRoster',
      show: true
    },
    {
      key: 'myAttendance',
      icon: <AccessTimeIcon sx={{ fontSize: 48 }} />,
      path: '/my-attendance',
      translationKey: 'myAttendance',
      show: true
    },
    {
      key: 'schedule',
      icon: (
        <Badge badgeContent={schedulePendingCount} color="warning" max={99999}>
          <CalendarTodayIcon sx={{ fontSize: 48 }} />
        </Badge>
      ),
      path: '/schedule',
      translationKey: 'schedule',
      show: true
    },
    {
      key: 'attendance',
      icon: <AccessTimeIcon sx={{ fontSize: 48 }} />,
      path: '/attendance',
      translationKey: 'attendance',
      show: canViewAttendanceManagement
    },
    {
      key: 'storeHoursReport',
      icon: <TableChartIcon sx={{ fontSize: 48 }} />,
      path: '/shift-management/store-hours-report',
      translationKey: 'storeHoursReport',
      show: canViewApproverFeatures
    },
    {
      key: 'storeWageCostReport',
      icon: <AttachMoneyIcon sx={{ fontSize: 48 }} />,
      path: '/shift-management/store-wage-cost',
      translationKey: 'storeWageCostReport',
      show: canViewApproverFeatures
    },
    {
      key: 'groupLeaveCalendar',
      icon: <EventNoteIcon sx={{ fontSize: 48 }} />,
      path: '/group-leave-calendar',
      translationKey: 'groupLeaveCalendar',
      show: canViewApproverFeatures
    },
    {
      key: 'userSchedules',
      icon: <EventNoteIcon sx={{ fontSize: 48 }} />,
      path: '/shift-management/user-schedules',
      translationKey: 'userSchedules',
      show: canViewApproverFeatures
    },
    {
      key: 'monthlyAttendanceSummary',
      icon: <AssessmentIcon sx={{ fontSize: 48 }} />,
      path: '/monthly-attendance-summary',
      translationKey: 'monthlyAttendanceSummary',
      show: canViewApproverFeatures
    },
    {
      key: 'bulkMonthlyAttendanceReport',
      icon: <PlaylistAddCheckIcon sx={{ fontSize: 48 }} />,
      path: '/shift-management/monthly-report-bulk',
      translationKey: 'bulkMonthlyAttendanceReport',
      show: canViewApproverFeatures
    },
    {
      key: 'monthlyAttendanceReport',
      icon: <DescriptionIcon sx={{ fontSize: 48 }} />,
      path: '/monthly-attendance-report',
      translationKey: 'monthlyAttendanceReport',
      show: canViewApproverFeatures
    },
    {
      key: 'monthlyAttendanceReportExport',
      icon: <FileDownloadIcon sx={{ fontSize: 48 }} />,
      path: '/monthly-attendance-report-export',
      translationKey: 'monthlyAttendanceReportExport',
      show: canViewApproverFeatures
    }
  ];


  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('shiftManagement.title')}
        </Typography>
        <Grid container spacing={3}>
          {shiftItems.filter(item => item.show).map((item) => (
            <Grid item xs={6} sm={4} md={3} key={item.key}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardActionArea
                  onClick={() => handleItemClick(item.path)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3
                  }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      '&:last-child': {
                        pb: 3
                      }
                    }}
                  >
                    <Box
                      sx={{
                        color: 'primary.main',
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
                      {t(`layout.${item.translationKey}`)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Layout>
  );
};

export default ShiftManagement;

