import React, { useState, useEffect } from 'react';
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
  useMediaQuery,
  Badge
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  History as HistoryIcon,
  AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import Layout from '../components/Layout';

const MyApprovals = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/api/approvals/pending');
      const count = response.data.applications?.length || 0;
      setPendingCount(count);
    } catch (error) {
      console.error('獲取待批核數量錯誤:', error);
      setPendingCount(0);
    }
  };

  const approvalItems = [
    {
      key: 'pendingApproval',
      icon: (
        <Badge badgeContent={pendingCount} color="error" max={99}>
          <CheckCircleIcon sx={{ fontSize: 48 }} />
        </Badge>
      ),
      path: '/approval/list',
      translationKey: 'pendingApproval'
    },
    {
      key: 'approvalHistory',
      icon: <HistoryIcon sx={{ fontSize: 48 }} />,
      path: '/approval/history',
      translationKey: 'approvalHistory'
    },
    {
      key: 'departmentGroupBalances',
      icon: <AccountBalanceIcon sx={{ fontSize: 48 }} />,
      path: '/department-group-balances',
      translationKey: 'departmentGroupBalances'
    }
  ];

  const handleItemClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
          {t('layout.myApprovals')}
        </Typography>
        <Grid container spacing={3}>
          {approvalItems.map((item) => (
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

export default MyApprovals;

