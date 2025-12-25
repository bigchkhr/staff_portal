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
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import { Search as SearchIcon, Undo as UndoIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/dateFormat';

const LeaveHistory = () => {
  const { t, i18n } = useTranslation();
  const { user, isSystemAdmin, isDeptHead } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [applications, setApplications] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();
  
  // 獲取當前年份作為預設值
  const currentYear = new Date().getFullYear();
  
  // 進階搜尋狀態
  const [advancedSearchExpanded, setAdvancedSearchExpanded] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterFlowType, setFilterFlowType] = useState('');
  const [filterYear, setFilterYear] = useState(currentYear.toString());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveTypes, setLeaveTypes] = useState([]);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchLeaveTypes();
    }
  }, [user]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchApplications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 構建查詢參數
      const params = {};
      
      // 進階搜尋參數
      if (filterStatus) params.status = filterStatus;
      if (filterLeaveType) params.leave_type_id = filterLeaveType;
      if (filterFlowType) params.flow_type = filterFlowType;
      if (filterYear && filterYear.trim()) {
        const yearNum = parseInt(filterYear);
        if (!isNaN(yearNum) && yearNum > 0) {
          params.year = yearNum;
        }
      }
      if (dateFrom) params.start_date_from = dateFrom;
      if (dateTo) params.end_date_to = dateTo;

      const response = await axios.get('/api/leaves', { params });
      const fetchedApplications = response.data.applications || [];
      
      // 過濾只顯示使用者本人的申請，且必須是 e-flow 或 paper-flow
      const myApplications = fetchedApplications.filter(app => {
        // 確保是使用者本人的申請
        const isMyApplication = app.user_id === user.id;
        
        // 確保是 e-flow 或 paper-flow
        const isEFlow = app.flow_type === 'e-flow';
        const isPaperFlow = app.flow_type === 'paper-flow' || app.is_paper_flow === true;
        
        return isMyApplication && (isEFlow || isPaperFlow);
      });
      
      setAllApplications(myApplications);
      setApplications(myApplications);
    } catch (error) {
      console.error('Fetch applications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    fetchApplications();
  };

  const handleClearFilter = () => {
    setFilterStatus('');
    setFilterLeaveType('');
    setFilterFlowType('');
    setFilterYear(currentYear.toString()); // 清除時重置為當前年份
    setDateFrom('');
    setDateTo('');
    fetchApplications();
  };

  const getStatusColor = (application) => {
    // 如果已被銷假，顯示特殊顏色
    if (application.is_reversed === true) {
      return 'info';
    }
    
    const statusMap = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error'
    };
    return statusMap[application.status] || 'default';
  };

  const getStatusText = (application) => {
    // 如果已被銷假，顯示「已銷假」
    if (application.is_reversed === true) {
      return t('leaveHistory.reversed');
    }
    
    const statusMap = {
      pending: t('leaveHistory.pending'),
      approved: t('leaveHistory.approved'),
      rejected: t('leaveHistory.rejected')
    };
    return statusMap[application.status] || application.status;
  };

  const handleReversalClick = (application) => {
    setSelectedApplication(application);
    setReversalDialogOpen(true);
  };

  const handleReversalConfirm = async () => {
    if (!selectedApplication) return;

    try {
      setReversing(true);
      const response = await axios.post('/api/leaves/reverse', {
        application_id: selectedApplication.id
      });
      
      // 使用後端返回的消息
      const message = response.data.message || t('leaveHistory.reversalSubmitted');
      
      setSnackbar({
        open: true,
        message,
        severity: 'success'
      });
      
      setReversalDialogOpen(false);
      setSelectedApplication(null);
      
      // 重新載入申請列表
      await fetchApplications();
    } catch (error) {
      console.error('Reversal error:', error);
      const errorMessage = error.response?.data?.message || t('leaveHistory.reversalError');
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setReversing(false);
    }
  };

  const handleReversalCancel = () => {
    setReversalDialogOpen(false);
    setSelectedApplication(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const canShowReversalButton = (application) => {
    // 只有已批核的申請才能銷假
    if (application.status !== 'approved') {
      return false;
    }
    
    // 如果已經被銷假，不顯示按鈕
    if (application.is_reversed) {
      return false;
    }
    
    // 如果是銷假交易本身，不顯示按鈕
    if (application.is_reversal_transaction) {
      return false;
    }
    
    // 檢查是否為 paper-flow 申請
    const isPaperFlow = application.is_paper_flow === true || application.flow_type === 'paper-flow';
    const isHRMember = user?.is_hr_member || user?.is_system_admin;
    
    // 如果是 paper-flow，只有 HR 成員可以看到銷假按鈕
    if (isPaperFlow) {
      return isHRMember;
    }
    
    // 如果是 e-flow，只有申請者本人才能看到銷假按鈕
    return application.user_id === user.id;
  };

  const getFlowTypeText = (application) => {
    const isPaperFlow = application.is_paper_flow === true || application.flow_type === 'paper-flow';
    return isPaperFlow ? t('leaveHistory.paperFlow') : t('leaveHistory.eFlow');
  };

  const filteredApplications = applications.filter(app => {
    // 如果沒有搜尋關鍵字，顯示所有通過進階搜尋的結果
    if (!search.trim()) {
      return true;
    }

    const keyword = search.toLowerCase().trim();
    const transactionId = app.transaction_id?.toString().toLowerCase() || '';
    // 根據語言選擇假期類型名稱用於搜索
    const leaveTypeName = i18n.language === 'en'
      ? (app.leave_type_name || app.leave_type_name_zh || '').toLowerCase()
      : (app.leave_type_name_zh || app.leave_type_name || '').toLowerCase();
    const applicantNameZh = app.applicant_display_name?.toLowerCase() || '';
    const flowTypeText = getFlowTypeText(app).toLowerCase();

    return (
      transactionId.includes(keyword) ||
      leaveTypeName.includes(keyword) ||
      applicantNameZh.includes(keyword) ||
      flowTypeText.includes(keyword)
    );
  });

  const renderMobileCard = (app) => {
    const leaveTypeName = i18n.language === 'en' 
      ? (app.leave_type_name || app.leave_type_name_zh || '')
      : (app.leave_type_name_zh || app.leave_type_name || '');
    
    const displayLeaveType = app.is_reversal_transaction === true
      ? `${leaveTypeName} (${t('leaveHistory.reversal')})`
      : leaveTypeName;

    return (
      <Card key={app.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.transactionId')}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {app.transaction_id}
              </Typography>
            </Box>
            <Chip
              label={getStatusText(app)}
              color={getStatusColor(app)}
              size="small"
            />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.applicant')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {app.applicant_display_name}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.year')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('leaveHistory.yearSuffix')}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.leaveType')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {displayLeaveType}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.flowType')}
              </Typography>
              <Chip
                label={getFlowTypeText(app)}
                color={app.is_paper_flow === true || app.flow_type === 'paper-flow' ? 'secondary' : 'primary'}
                size="small"
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.days')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                {app.days}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.startDate')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDate(app.start_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('leaveHistory.endDate')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDate(app.end_date)}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={() => navigate(`/approval/${app.id}`)}
            >
              {t('leaveHistory.viewDetails')}
            </Button>
            {canShowReversalButton(app) && (
              <Button
                fullWidth
                size="small"
                variant="contained"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => handleReversalClick(app)}
              >
                {t('leaveHistory.reversal')}
              </Button>
            )}
          </Box>
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
        {t('leaveHistory.title')}
      </Typography>

      <Paper sx={{ mt: 2, p: { xs: 1.5, sm: 2 } }}>
        <TextField
          fullWidth
          placeholder={t('leaveHistory.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2 }}
          label={t('leaveHistory.searchKeyword')}
          size={isMobile ? "small" : "medium"}
        />

        {/* 進階搜尋 */}
        <Accordion expanded={advancedSearchExpanded} onChange={(e, expanded) => setAdvancedSearchExpanded(expanded)} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('leaveHistory.advancedSearch')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('leaveHistory.statusFilter')}</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label={t('leaveHistory.statusFilter')}
                  >
                    <MenuItem value="">{t('leaveHistory.allStatus')}</MenuItem>
                    <MenuItem value="pending">{t('leaveHistory.pending')}</MenuItem>
                    <MenuItem value="approved">{t('leaveHistory.approved')}</MenuItem>
                    <MenuItem value="rejected">{t('leaveHistory.rejected')}</MenuItem>
                    <MenuItem value="reversed">{t('leaveHistory.reversed')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('leaveHistory.leaveTypeFilter')}</InputLabel>
                  <Select
                    value={filterLeaveType}
                    onChange={(e) => setFilterLeaveType(e.target.value)}
                    label={t('leaveHistory.leaveTypeFilter')}
                  >
                    <MenuItem value="">{t('leaveHistory.allLeaveTypes')}</MenuItem>
                    {leaveTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {i18n.language === 'en' ? (type.name || type.name_zh) : (type.name_zh || type.name)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('leaveHistory.flowTypeFilter')}</InputLabel>
                  <Select
                    value={filterFlowType}
                    onChange={(e) => setFilterFlowType(e.target.value)}
                    label={t('leaveHistory.flowTypeFilter')}
                  >
                    <MenuItem value="">{t('leaveHistory.allFlowTypes')}</MenuItem>
                    <MenuItem value="e-flow">{t('leaveHistory.eFlow')}</MenuItem>
                    <MenuItem value="paper-flow">{t('leaveHistory.paperFlow')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('leaveHistory.yearFilter')}
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  placeholder={t('leaveHistory.allYears')}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('leaveHistory.dateFrom')}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('leaveHistory.dateTo')}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: { xs: 1, sm: 2 }, 
                  justifyContent: 'flex-end',
                  flexDirection: { xs: 'column', sm: 'row' }
                }}>
                  <Button 
                    variant="outlined" 
                    onClick={handleClearFilter}
                    fullWidth={isMobile}
                  >
                    {t('leaveHistory.clearFilter')}
                  </Button>
                  <Button 
                    variant="contained" 
                    onClick={handleApplyFilter}
                    fullWidth={isMobile}
                  >
                    {t('leaveHistory.applyFilter')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {isMobile ? (
          // 手機版：卡片式布局
          <Box>
            {filteredApplications.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('leaveHistory.noApplications')}
              </Alert>
            ) : (
              filteredApplications.map((app) => renderMobileCard(app))
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.transactionId')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.applicant')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.leaveType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.flowType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.startDate')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.endDate')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.days')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('leaveHistory.status')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">{t('leaveHistory.noApplications')}</TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((app) => (
                    <TableRow key={app.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.transaction_id}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.applicant_display_name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {(() => {
                          const leaveTypeName = i18n.language === 'en' 
                            ? (app.leave_type_name || app.leave_type_name_zh || '')
                            : (app.leave_type_name_zh || app.leave_type_name || '');
                          
                          // 如果是銷假交易，在假期類型後面加上「銷假」
                          if (app.is_reversal_transaction === true) {
                            return `${leaveTypeName} (${t('leaveHistory.reversal')})`;
                          }
                          
                          return leaveTypeName;
                        })()}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={getFlowTypeText(app)}
                          color={app.is_paper_flow === true || app.flow_type === 'paper-flow' ? 'secondary' : 'primary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('leaveHistory.yearSuffix')}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(app.start_date)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(app.end_date)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.days}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={getStatusText(app)}
                          color={getStatusColor(app)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => navigate(`/approval/${app.id}`)}
                          >
                            {t('leaveHistory.viewDetails')}
                          </Button>
                          {canShowReversalButton(app) && (
                            <Button
                              size="small"
                              variant="contained"
                              color="warning"
                              startIcon={<UndoIcon />}
                              onClick={() => handleReversalClick(app)}
                            >
                              {t('leaveHistory.reversal')}
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 銷假確認對話框 */}
      <Dialog
        open={reversalDialogOpen}
        onClose={handleReversalCancel}
        aria-labelledby="reversal-dialog-title"
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="reversal-dialog-title">{t('leaveHistory.confirmReversal')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('leaveHistory.confirmReversalMessage')}
            {selectedApplication && (
              <>
                <br />
                <br />
                <strong>{t('leaveHistory.applicationDetails')}</strong>
                <br />
                {t('leaveHistory.transactionIdLabel')}{selectedApplication.transaction_id}
                <br />
                {t('leaveHistory.leaveTypeLabel')}
                {i18n.language === 'en' 
                  ? (selectedApplication.leave_type_name || selectedApplication.leave_type_name_zh || '')
                  : (selectedApplication.leave_type_name_zh || selectedApplication.leave_type_name || '')
                }
                <br />
                {t('leaveHistory.dateLabel')}{formatDate(selectedApplication.start_date)} ~ {formatDate(selectedApplication.end_date)}
                <br />
                {t('leaveHistory.daysLabel')}{selectedApplication.days} {t('leaveHistory.days')}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleReversalCancel} disabled={reversing}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleReversalConfirm}
            color="warning"
            variant="contained"
            disabled={reversing}
          >
            {reversing ? t('leaveHistory.reversing') : t('leaveHistory.confirmReversal')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 成功/錯誤提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LeaveHistory;

