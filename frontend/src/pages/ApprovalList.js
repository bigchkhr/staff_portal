import React, { useState, useEffect, useRef } from 'react';
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
import { Visibility as VisibilityIcon, Search as SearchIcon, Flag as FlagIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateFormat';

const ApprovalList = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(15); // 每頁顯示數量（與後端預設一致）
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const appliedFilterKey = useRef(`${search}|${stageFilter}`);
  const [openingId, setOpeningId] = useState(null);
  const navigate = useNavigate();

  const handleView = async (app) => {
    // 外勤工作：按下查看時即時檢測該申請者有幾多筆待批核外勤，
    // 如多於 1 筆就自動 redirect 去批量批核頁（避免只靠當前頁資料而漏判）
    if (app.application_type === 'outdoor_work') {
      const applicantId = app.user_id;
      if (applicantId) {
        try {
          setOpeningId(app.id);
          const res = await axios.get(`/api/approvals/pending/outdoor-work/applicant/${applicantId}`);
          const apps = res.data.applications || [];
          if (apps.length > 1) {
            navigate(`/approval/outdoor-work/bulk/${applicantId}`);
            return;
          }
        } catch (e) {
          console.error('Detect outdoor work count error:', e);
          // 失敗就 fallback 去單筆詳情
        } finally {
          setOpeningId(null);
        }
      }
    }

    navigate(`/approval/${app.id}?type=${app.application_type || 'leave'}`);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const filterKey = `${search}|${stageFilter}`;
    if (appliedFilterKey.current !== filterKey) {
      appliedFilterKey.current = filterKey;
      if (page !== 1) {
        setPage(1);
        return;
      }
    }

    let cancelled = false;
    const fetchPendingApprovals = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/approvals/pending', {
          params: {
            page,
            limit,
            keyword: search || undefined,
            stage: stageFilter !== 'all' ? stageFilter : undefined
          }
        });
        if (cancelled) return;
        setApplications(response.data.applications || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        if (response.data.pagination?.page && response.data.pagination.page !== page) {
          setPage(response.data.pagination.page);
        }
      } catch (error) {
        if (!cancelled) console.error('Fetch pending approvals error:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPendingApprovals();
    return () => {
      cancelled = true;
    };
  }, [page, limit, search, stageFilter]);

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

  const needsMyApproval = (application) => application.view_only !== true;

  const renderYourTurnFlag = () => (
    <FlagIcon color="warning" fontSize="small" sx={{ ml: 0.5 }} />
  );

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
      applicant: t('approvalList.stageApplicant'),
      completed: t('approvalList.stageCompleted')
    };
    return stageMap[stage] || stage;
  };

  const renderMobileCard = (app) => {
    const stage = getCurrentStage(app);
    const canApproveThis = needsMyApproval(app);

    return (
      <Card
        key={app.id}
        sx={{
          mb: 2,
          ...(canApproveThis ? { borderLeft: 4, borderColor: 'warning.main' } : {})
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalList.transactionId')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {app.transaction_id}
                </Typography>
                {canApproveThis && renderYourTurnFlag()}
              </Box>
            </Box>
            <Box>
              <Chip
                label={getStageText(stage)}
                color={canApproveThis ? 'warning' : 'default'}
                size="small"
              />
              {app.return_reason && (
                <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5, maxWidth: 180 }}>
                  {t('approvalList.returnReason')}：{app.return_reason}
                </Typography>
              )}
            </Box>
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
            onClick={() => handleView(app)}
            disabled={openingId === app.id}
            startIcon={<VisibilityIcon />}
          >
            {t('approvalList.viewDetails')}
          </Button>
        </CardContent>
      </Card>
    );
  };

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
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
              onChange={(e) => setStageFilter(e.target.value)}
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

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="240px">
            <CircularProgress />
          </Box>
        ) : isMobile ? (
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.applicationType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.dateTime')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalList.daysHours')}</TableCell>
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
                    const canApproveThis = needsMyApproval(app);
                    
                    return (
                      <TableRow
                        key={app.id}
                        hover
                        sx={canApproveThis ? { boxShadow: 'inset 4px 0 0 #ed6c02' } : undefined}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {app.transaction_id}
                            {canApproveThis && renderYourTurnFlag()}
                          </Box>
                        </TableCell>
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
                        <TableCell>
                          <Chip
                            label={getStageText(stage)}
                            color={canApproveThis ? 'warning' : 'default'}
                            size="small"
                          />
                          {app.return_reason && (
                            <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 0.5, whiteSpace: 'normal', maxWidth: 220 }}>
                              {t('approvalList.returnReason')}：{app.return_reason}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleView(app)}
                            disabled={openingId === app.id}
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

