import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
  EventNote as EventNoteIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Layout from '../components/Layout';

const ShiftManagement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, isSystemAdmin } = useAuth();
  const [canViewApproverFeatures, setCanViewApproverFeatures] = useState(false);
  const [canViewAttendanceManagement, setCanViewAttendanceManagement] = useState(false);

  useEffect(() => {
    const checkApproverPermission = async () => {
      // 系統管理員可以看到批核者功能（月結表、群組假期週曆）
      if (isSystemAdmin) {
        setCanViewApproverFeatures(true);
        return;
      }

      if (!user || !user.delegation_groups || user.delegation_groups.length === 0) {
        setCanViewApproverFeatures(false);
        return;
      }

      try {
        // 獲取所有部門群組
        const response = await axios.get('/api/groups/department');
        const departmentGroups = response.data.groups || [];
        
        // 獲取用戶所屬的授權群組 ID
        const userDelegationGroupIds = user.delegation_groups.map(g => Number(g.id));
        
        // 檢查是否有任何部門群組的 approver_1_id、approver_2_id、approver_3_id 匹配用戶的授權群組（不包括 checker）
        const isApprover = departmentGroups.some(group => {
          const approver1Id = group.approver_1_id ? Number(group.approver_1_id) : null;
          const approver2Id = group.approver_2_id ? Number(group.approver_2_id) : null;
          const approver3Id = group.approver_3_id ? Number(group.approver_3_id) : null;
          
          return (approver1Id !== null && userDelegationGroupIds.includes(approver1Id)) ||
                 (approver2Id !== null && userDelegationGroupIds.includes(approver2Id)) ||
                 (approver3Id !== null && userDelegationGroupIds.includes(approver3Id));
        });
        
        setCanViewApproverFeatures(isApprover);
      } catch (error) {
        console.error('檢查批核者權限錯誤:', error);
        setCanViewApproverFeatures(false);
      }
    };

    const checkApprovalMemberPermission = async () => {
      // 系統管理員可以看到打卡管理
      if (isSystemAdmin) {
        setCanViewAttendanceManagement(true);
        return;
      }

      if (!user || !user.delegation_groups || user.delegation_groups.length === 0) {
        setCanViewAttendanceManagement(false);
        return;
      }

      try {
        // 獲取所有部門群組
        const response = await axios.get('/api/groups/department');
        const departmentGroups = response.data.groups || [];
        
        // 獲取用戶所屬的授權群組 ID
        const userDelegationGroupIds = user.delegation_groups.map(g => Number(g.id));
        
        // 檢查是否有任何部門群組的 checker_id、approver_1_id、approver_2_id、approver_3_id 匹配用戶的授權群組
        const isApprovalMember = departmentGroups.some(group => {
          const checkerId = group.checker_id ? Number(group.checker_id) : null;
          const approver1Id = group.approver_1_id ? Number(group.approver_1_id) : null;
          const approver2Id = group.approver_2_id ? Number(group.approver_2_id) : null;
          const approver3Id = group.approver_3_id ? Number(group.approver_3_id) : null;
          
          return (checkerId !== null && userDelegationGroupIds.includes(checkerId)) ||
                 (approver1Id !== null && userDelegationGroupIds.includes(approver1Id)) ||
                 (approver2Id !== null && userDelegationGroupIds.includes(approver2Id)) ||
                 (approver3Id !== null && userDelegationGroupIds.includes(approver3Id));
        });
        
        setCanViewAttendanceManagement(isApprovalMember);
      } catch (error) {
        console.error('檢查批核成員權限錯誤:', error);
        setCanViewAttendanceManagement(false);
      }
    };

    checkApproverPermission();
    checkApprovalMemberPermission();
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
      icon: <CalendarTodayIcon sx={{ fontSize: 48 }} />,
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
      key: 'groupLeaveCalendar',
      icon: <EventNoteIcon sx={{ fontSize: 48 }} />,
      path: '/group-leave-calendar',
      translationKey: 'groupLeaveCalendar',
      show: canViewApproverFeatures
    },
    {
      key: 'monthlyAttendanceSummary',
      icon: <AssessmentIcon sx={{ fontSize: 48 }} />,
      path: '/monthly-attendance-summary',
      translationKey: 'monthlyAttendanceSummary',
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

