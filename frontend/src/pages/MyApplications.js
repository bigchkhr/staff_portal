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
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  AccountBalance as AccountBalanceIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const MyApplications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const applicationItems = [
    {
      key: 'applyLeave',
      icon: <AssignmentIcon sx={{ fontSize: 48 }} />,
      path: '/leave/apply',
      translationKey: 'applyLeave'
    },
    {
      key: 'leaveHistory',
      icon: <HistoryIcon sx={{ fontSize: 48 }} />,
      path: '/leave/history',
      translationKey: 'leaveHistory'
    },
    {
      key: 'leaveBalance',
      icon: <AccountBalanceIcon sx={{ fontSize: 48 }} />,
      path: '/leave/balance',
      translationKey: 'leaveBalance'
    },
    {
      key: 'applyExtraWorkingHours',
      icon: <WorkIcon sx={{ fontSize: 48 }} />,
      path: '/extra-working-hours/apply',
      translationKey: 'applyExtraWorkingHours'
    },
    {
      key: 'extraWorkingHoursHistory',
      icon: <HistoryIcon sx={{ fontSize: 48 }} />,
      path: '/extra-working-hours/history',
      translationKey: 'extraWorkingHoursHistory'
    },
    // {
    //   key: 'applyOutdoorWork',
    //   icon: <WorkIcon sx={{ fontSize: 48 }} />,
    //   path: '/outdoor-work/apply',
    //   translationKey: 'applyOutdoorWork'
    // },
    // {
    //   key: 'outdoorWorkHistory',
    //   icon: <HistoryIcon sx={{ fontSize: 48 }} />,
    //   path: '/outdoor-work/history',
    //   translationKey: 'outdoorWorkHistory'
    // }
  ];

  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('layout.myApplications')}
        </Typography>
        <Grid container spacing={3}>
          {applicationItems.map((item) => (
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

export default MyApplications;

