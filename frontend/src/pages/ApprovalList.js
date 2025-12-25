import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  Button,
  Card,
  CardContent,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormat';

const ApprovalList = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/approvals/pending');
      setApplications(response.data.applications || []);
    } catch (error) {
      console.error('Fetch pending approvals error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStage = (application) => {
    // 優先使用後端返回的 current_approval_stage
    if (application.current_approval_stage) {
      return application.current_approval_stage;
    }
    // Fallback: 如果沒有 current_approval_stage，使用舊的邏輯
    if (!application.checker_at && application.checker_id) return 'checker';
    if (!application.approver_1_at && application.approver_1_id) return 'approver_1';
    if (!application.approver_2_at && application.approver_2_id) return 'approver_2';
    if (!application.approver_3_at && application.approver_3_id) return 'approver_3';
    return 'completed';
  };

  const canApprove = (application) => {
    const stage = getCurrentStage(application);
    if (stage === 'checker' && application.checker_id === user.id) return true;
    if (stage === 'approver_1' && application.approver_1_id === user.id) return true;
    if (stage === 'approver_2' && application.approver_2_id === user.id) return true;
    if (stage === 'approver_3' && application.approver_3_id === user.id) return true;
    return false;
  };

  const getStageText = (stage) => {
    const stageMap = {
      checker: t('approvalList.stageChecker'),
      approver_1: t('approvalList.stageApprover1'),
      approver_2: t('approvalList.stageApprover2'),
      approver_3: t('approvalList.stageApprover3'),
      completed: t('approvalList.stageCompleted')
    };
    return stageMap[stage] || stage;
  };

  const renderMobileCard = (app) => {
    const stage = getCurrentStage(app);
    const canApproveThis = canApprove(app);

    return (
      <Card key={app.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.transactionId')}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {app.transaction_id}
              </Typography>
            </Box>
            <Chip
              label={getStageText(stage)}
              color={canApproveThis ? 'warning' : 'default'}
              size="small"
            />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.applicant')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {app.applicant_display_name}
                {(app.applicant_employee_number || app.user_employee_number) && (
                  <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                    ({app.applicant_employee_number || app.user_employee_number})
                  </Typography>
                )}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.leaveType')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {i18n.language === 'en' 
                  ? (app.leave_type_name || app.leave_type_name_zh || '')
                  : (app.leave_type_name_zh || app.leave_type_name || '')}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.year')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('approvalList.yearSuffix')}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.date')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDate(app.start_date)} ~ {formatDate(app.end_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.days')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                {app.days}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={() => navigate(`/approval/${app.id}`)}
            startIcon={<VisibilityIcon />}
          >
            {t('approvalList.viewDetails')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
      <Typography 
        variant="h5" 
        gutterBottom
        sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}
      >
        {t('approvalList.title')}
      </Typography>

      <Paper sx={{ mt: 2, p: { xs: 1.5, sm: 2 } }}>
        {isMobile ? (
          // 手機版：卡片式布局
          <Box>
            {applications.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('approvalList.noPendingApplications')}
              </Alert>
            ) : (
              applications.map((app) => renderMobileCard(app))
            )}
          </Box>
        ) : (
          // 桌面版：表格布局（帶橫向滾動）
          <TableContainer sx={{ 
            maxWidth: '100%',
            overflowX: 'auto',
            '& .MuiTableCell-root': {
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              padding: { xs: '8px', sm: '16px' },
              whiteSpace: 'nowrap'
            }
          }}>
            <Table size={isTablet ? "small" : "medium"}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.transactionId')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.applicant')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.leaveType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.date')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.days')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.currentStage')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">{t('approvalList.noPendingApplications')}</TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => {
                    const stage = getCurrentStage(app);
                    const canApproveThis = canApprove(app);
                    
                    return (
                      <TableRow key={app.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.transaction_id}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {app.applicant_display_name}
                          {(app.applicant_employee_number || app.user_employee_number) && (
                            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                              ({app.applicant_employee_number || app.user_employee_number})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {i18n.language === 'en' 
                            ? (app.leave_type_name || app.leave_type_name_zh || '')
                            : (app.leave_type_name_zh || app.leave_type_name || '')
                          }
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('approvalList.yearSuffix')}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDate(app.start_date)} ~ {formatDate(app.end_date)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.days}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            label={getStageText(stage)}
                            color={canApproveThis ? 'warning' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => navigate(`/approval/${app.id}`)}
                            startIcon={<VisibilityIcon />}
                          >
                            {t('approvalList.viewDetails')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default ApprovalList;

