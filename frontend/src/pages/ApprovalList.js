import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
  Pagination,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Visibility as VisibilityIcon, Search as SearchIcon } from '@mui/icons-material';
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
  const [allApplications, setAllApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15); // 每頁顯示數量
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingApprovals();
  }, [page]);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/approvals/pending', {
        params: { page, limit }
      });
      const fetchedApplications = response.data.applications || [];
      setAllApplications(fetchedApplications);
      
      // 更新分頁信息
      if (response.data.pagination) {
        setTotal(response.data.pagination.total || 0);
        setTotalPages(response.data.pagination.totalPages || 1);
      }
    } catch (error) {
      console.error('Fetch pending approvals error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
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

  // 過濾申請列表
  const filteredApplications = useMemo(() => {
    let filtered = [...allApplications];

    // 搜尋過濾
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(app => {
        const transactionId = app.transaction_id?.toString().toLowerCase() || '';
        const applicantName = app.applicant_display_name?.toLowerCase() || '';
        const employeeNumber = (app.applicant_employee_number || app.user_employee_number || '').toLowerCase();
        const leaveTypeName = app.leave_type_name_zh?.toLowerCase() || app.leave_type_name?.toLowerCase() || '';
        
        return transactionId.includes(searchLower) ||
               applicantName.includes(searchLower) ||
               employeeNumber.includes(searchLower) ||
               leaveTypeName.includes(searchLower);
      });
    }

    // 階段篩選
    if (stageFilter !== 'all') {
      filtered = filtered.filter(app => {
        const stage = getCurrentStage(app);
        return stage === stageFilter;
      });
    }

    return filtered;
  }, [allApplications, search, stageFilter]);

  // 當過濾後的結果改變時，更新分頁
  useEffect(() => {
    const filteredTotal = filteredApplications.length;
    const filteredTotalPages = Math.ceil(filteredTotal / limit);
    setTotal(filteredTotal);
    setTotalPages(filteredTotalPages);
    // 如果當前頁超過總頁數，重置到第一頁
    if (page > filteredTotalPages && filteredTotalPages > 0) {
      setPage(1);
    }
  }, [filteredApplications, limit, page]);

  // 獲取當前頁的申請
  const paginatedApplications = useMemo(() => {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    return filteredApplications.slice(startIndex, endIndex);
  }, [filteredApplications, page, limit]);

  const canApprove = (application) => {
    const stage = getCurrentStage(application);
    if (stage === 'checker' && application.checker_id === user.id) return true;
    if (stage === 'approver_1' && application.approver_1_id === user.id) return true;
    if (stage === 'approver_2' && application.approver_2_id === user.id) return true;
    if (stage === 'approver_3' && application.approver_3_id === user.id) return true;
    return false;
  };

  const getApplicationTypeText = (app) => {
    if (app.application_type === 'extra_working_hours') {
      return t('approvalList.extraWorkingHoursApplication');
    }
    if (app.application_type === 'outdoor_work') {
      return t('approvalList.outdoorWorkApplication');
    }
    return t('approvalList.leaveApplication');
  };

  const getApplicationTypeDisplay = (app) => {
    if (app.application_type === 'extra_working_hours') {
      return {
        type: t('approvalList.extraWorkingHoursApplication'),
        dateRange: app.start_date && app.end_date 
          ? `${formatDate(app.start_date)} ${app.start_time || ''} ~ ${formatDate(app.end_date)} ${app.end_time || ''}`
          : '-',
        value: `${app.total_hours || 0} ${t('approvalList.hours')}`
      };
    }
    if (app.application_type === 'outdoor_work') {
      return {
        type: t('approvalList.outdoorWorkApplication'),
        dateRange: app.start_date && app.end_date 
          ? `${formatDate(app.start_date)} ${app.start_time || ''} ~ ${formatDate(app.end_date)} ${app.end_time || ''}`
          : '-',
        value: `${app.total_hours || 0} ${t('approvalList.hours')}`
      };
    }
    return {
      type: i18n.language === 'en' 
        ? (app.leave_type_name || app.leave_type_name_zh || '')
        : (app.leave_type_name_zh || app.leave_type_name || ''),
      dateRange: `${formatDate(app.start_date)} ~ ${formatDate(app.end_date)}`,
      value: app.days || app.total_days || 0
    };
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
            <Grid item xs={12}>
              <Chip 
                label={getApplicationTypeText(app)} 
                size="small" 
                color={
                  app.application_type === 'extra_working_hours' ? 'secondary' : 
                  app.application_type === 'outdoor_work' ? 'info' : 
                  'primary'
                } 
                sx={{ mb: 1 }} 
              />
            </Grid>
            {app.application_type === 'extra_working_hours' || app.application_type === 'outdoor_work' ? (
              <>
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('approvalList.timeRange')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {app.start_date && app.end_date 
                      ? `${formatDate(app.start_date)} ${app.start_time || ''} ~ ${formatDate(app.end_date)} ${app.end_time || ''}`
                      : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('approvalList.totalHours')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                    {app.total_hours || 0} {t('approvalList.hours')}
                  </Typography>
                </Grid>
                {app.application_type === 'outdoor_work' && app.start_location && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('approvalList.startLocation')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {app.start_location}
                    </Typography>
                  </Grid>
                )}
                {app.application_type === 'outdoor_work' && app.end_location && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('approvalList.endLocation')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {app.end_location}
                    </Typography>
                  </Grid>
                )}
                {app.application_type === 'outdoor_work' && app.transportation && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('approvalList.transportation')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {app.transportation}
                    </Typography>
                  </Grid>
                )}
                {app.application_type === 'outdoor_work' && app.expense && (
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t('approvalList.expense')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      ${parseFloat(app.expense).toFixed(2)}
                    </Typography>
                  </Grid>
                )}
              </>
            ) : (
              <>
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
              </>
            )}
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Button
            fullWidth
            variant="contained"
            size="small"
            onClick={() => navigate(`/approval/${app.id}?type=${app.application_type || 'leave'}`)}
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
        {/* 搜尋欄和篩選器 */}
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            placeholder={t('approvalList.searchPlaceholder') || t('common.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1); // 重置到第一頁
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            size={isMobile ? "small" : "medium"}
          />
          <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }} size={isMobile ? "small" : "medium"}>
            <InputLabel>{t('approvalList.currentStage')}</InputLabel>
            <Select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1); // 重置到第一頁
              }}
              label={t('approvalList.currentStage')}
            >
              <MenuItem value="all">{t('approvalList.allStages') || t('common.all')}</MenuItem>
              <MenuItem value="checker">{t('approvalList.stageChecker')}</MenuItem>
              <MenuItem value="approver_1">{t('approvalList.stageApprover1')}</MenuItem>
              <MenuItem value="approver_2">{t('approvalList.stageApprover2')}</MenuItem>
              <MenuItem value="approver_3">{t('approvalList.stageApprover3')}</MenuItem>
              <MenuItem value="completed">{t('approvalList.stageCompleted')}</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {isMobile ? (
          // 手機版：卡片式布局
          <Box>
            {paginatedApplications.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('approvalList.noPendingApplications')}
              </Alert>
            ) : (
              paginatedApplications.map((app) => renderMobileCard(app))
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.applicationType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.dateTime')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.daysHours')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.currentStage')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">{t('approvalList.noPendingApplications')}</TableCell>
                  </TableRow>
                ) : (
                  paginatedApplications.map((app) => {
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
                          <Chip 
                            label={getApplicationTypeText(app)} 
                            size="small" 
                            color={
                              app.application_type === 'extra_working_hours' ? 'secondary' : 
                              app.application_type === 'outdoor_work' ? 'info' : 
                              'primary'
                            } 
                            sx={{ mb: 0.5 }} 
                          />
                          <br />
                          {(() => {
                            const display = getApplicationTypeDisplay(app);
                            return display.type;
                          })()}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {(app.application_type === 'extra_working_hours' || app.application_type === 'outdoor_work') ? '-' : (app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-') + t('approvalList.yearSuffix'))}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {(() => {
                            const display = getApplicationTypeDisplay(app);
                            return display.dateRange;
                          })()}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {(() => {
                            const display = getApplicationTypeDisplay(app);
                            return display.value;
                          })()}
                        </TableCell>
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
                            onClick={() => navigate(`/approval/${app.id}?type=${app.application_type || 'leave'}`)}
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
      
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
            showFirstButton
            showLastButton
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default ApprovalList;

