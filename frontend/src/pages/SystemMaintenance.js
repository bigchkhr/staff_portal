import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  CalendarToday as CalendarTodayIcon,
  Storefront as StorefrontIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const SystemMaintenance = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const maintenanceItems = [
    {
      key: 'userManagement',
      icon: <PeopleIcon sx={{ fontSize: 48 }} />,
      path: '/admin/users',
      translationKey: 'userManagement'
    },
    {
      key: 'leaveTypeManagement',
      icon: <EventNoteIcon sx={{ fontSize: 48 }} />,
      path: '/admin/leave-types',
      translationKey: 'leaveTypeManagement'
    },
    {
      key: 'departmentManagement',
      icon: <BusinessIcon sx={{ fontSize: 48 }} />,
      path: '/admin/departments',
      translationKey: 'departmentManagement'
    },
    {
      key: 'positionManagement',
      icon: <WorkIcon sx={{ fontSize: 48 }} />,
      path: '/admin/positions',
      translationKey: 'positionManagement'
    },
    {
      key: 'groupManagement',
      icon: <GroupIcon sx={{ fontSize: 48 }} />,
      path: '/admin/groups',
      translationKey: 'groupManagement'
    },
    {
      key: 'publicHolidayManagement',
      icon: <CalendarTodayIcon sx={{ fontSize: 48 }} />,
      path: '/admin/public-holidays',
      translationKey: 'publicHolidayManagement'
    },
    {
      key: 'storeManagement',
      icon: <StorefrontIcon sx={{ fontSize: 48 }} />,
      path: '/admin/stores',
      translationKey: 'storeManagement'
    },
    {
      key: 'yearManagement',
      icon: <DateRangeIcon sx={{ fontSize: 48 }} />,
      path: '/admin/years',
      translationKey: 'yearManagement'
    }
  ];

  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('layout.systemMaintenance')}
        </Typography>
        <Grid container spacing={3}>
          {maintenanceItems.map((item) => (
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

export default SystemMaintenance;

