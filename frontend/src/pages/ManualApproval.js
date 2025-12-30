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
  Description as DescriptionIcon,
  Work as WorkIcon,
  Assignment as AssignmentIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const ManualApproval = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const manualApprovalItems = [
    {
      key: 'paperFlow',
      icon: <DescriptionIcon sx={{ fontSize: 48 }} />,
      path: '/admin/paper-flow',
      translationKey: 'paperFlow'
    },
    {
      key: 'extraWorkingHoursPaperFlow',
      icon: <WorkIcon sx={{ fontSize: 48 }} />,
      path: '/admin/extra-working-hours-paper-flow',
      translationKey: 'extraWorkingHoursPaperFlow'
    },
    {
      key: 'outdoorWorkPaperFlow',
      icon: <AssignmentIcon sx={{ fontSize: 48 }} />,
      path: '/admin/outdoor-work-paper-flow',
      translationKey: 'outdoorWorkPaperFlow'
    },
    {
      key: 'balanceManagement',
      icon: <AccountBalanceWalletIcon sx={{ fontSize: 48 }} />,
      path: '/admin/balances',
      translationKey: 'balanceManagement'
    }
  ];

  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('layout.manualApproval')}
        </Typography>
        <Grid container spacing={3}>
          {manualApprovalItems.map((item) => (
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

export default ManualApproval;

