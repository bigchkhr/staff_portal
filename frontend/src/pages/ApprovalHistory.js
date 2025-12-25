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
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  Link,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import { 
  Visibility as VisibilityIcon, 
  Search as SearchIcon,
  AttachFile as AttachFileIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Description as DescriptionIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  Undo as UndoIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatDate } from '../utils/dateFormat';

const ApprovalHistory = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  
  // 獲取當前年份和月份作為預設值
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // getMonth() 返回 0-11，所以需要 +1
  
  // 進階搜尋狀態
  const [advancedSearchExpanded, setAdvancedSearchExpanded] = useState(false);
  const [filterLeaveType, setFilterLeaveType] = useState('');
  const [filterFlowType, setFilterFlowType] = useState('');
  const [filterYear, setFilterYear] = useState(currentYear.toString());
  const [filterMonth, setFilterMonth] = useState(currentMonth.toString());
  const [filterDepartmentGroup, setFilterDepartmentGroup] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reversalDialogOpen, setReversalDialogOpen] = useState(false);
  const [selectedReversalApplication, setSelectedReversalApplication] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchLeaveTypes();
    fetchDepartmentGroups();
    fetchApprovalHistory();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchDepartmentGroups = async () => {
    try {
      const response = await axios.get('/api/groups/department');
      setDepartmentGroups(response.data.groups || []);
    } catch (error) {
      console.error('Fetch department groups error:', error);
    }
  };

  const fetchApprovalHistory = async () => {
    try {
      setLoading(true);
      const params = {};
      
      // 狀態篩選
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      // 進階搜尋參數
      if (filterLeaveType) params.leave_type_id = filterLeaveType;
      if (filterFlowType) params.flow_type = filterFlowType;
      if (filterDepartmentGroup) params.department_group_id = filterDepartmentGroup;
      if (filterYear) {
        const yearStr = String(filterYear).trim();
        if (yearStr) {
          const yearNum = parseInt(yearStr);
          if (!isNaN(yearNum) && yearNum > 0) {
            params.year = yearNum;
          }
        }
      }
      if (filterMonth) {
        const monthStr = String(filterMonth).trim();
        if (monthStr) {
          const monthNum = parseInt(monthStr);
          if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
            params.month = monthNum;
          }
        }
      }
      if (dateFrom) params.start_date_from = dateFrom;
      if (dateTo) params.end_date_to = dateTo;
      
      const response = await axios.get('/api/approvals/history', { params });
      setApplications(response.data.applications || []);
    } catch (error) {
      console.error('Fetch approval history error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    fetchApprovalHistory();
  };

  const handleClearFilter = () => {
    setStatusFilter('all');
    setFilterLeaveType('');
    setFilterFlowType('');
    setFilterYear(currentYear.toString());
    setFilterMonth(currentMonth.toString());
    setFilterDepartmentGroup('');
    setDateFrom('');
    setDateTo('');
    fetchApprovalHistory();
  };

  const getStatusColor = (application) => {
    // 如果已被銷假，顯示特殊顏色
    if (application.is_reversed === true) {
      return 'info';
    }
    
    // 如果 application 是字符串（舊的調用方式），則按字符串處理
    if (typeof application === 'string') {
      const statusMap = {
        pending: 'warning',
        approved: 'success',
        rejected: 'error',
        cancelled: 'default'
      };
      return statusMap[application] || 'default';
    }
    
    const statusMap = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      cancelled: 'default'
    };
    return statusMap[application.status] || 'default';
  };

  const getStatusText = (application) => {
    // 如果已被銷假，顯示「已銷假」
    if (application && application.is_reversed === true) {
      return t('approvalHistory.reversed');
    }
    
    // 如果 application 是字符串（舊的調用方式），則按字符串處理
    if (typeof application === 'string') {
      const statusMap = {
        pending: t('approvalHistory.pending'),
        approved: t('approvalHistory.approved'),
        rejected: t('approvalHistory.rejected'),
        cancelled: t('approvalHistory.cancelled')
      };
      return statusMap[application] || application;
    }
    
    const statusMap = {
      pending: t('approvalHistory.pending'),
      approved: t('approvalHistory.approved'),
      rejected: t('approvalHistory.rejected'),
      cancelled: t('approvalHistory.cancelled')
    };
    return statusMap[application.status] || application.status;
  };

  const getApprovalStage = (application) => {
    // 優先使用後端返回的 user_approval_stage
    if (application.user_approval_stage) {
      const stageMap = {
        checker: t('approvalHistory.stageChecker'),
        approver_1: t('approvalHistory.stageApprover1'),
        approver_2: t('approvalHistory.stageApprover2'),
        approver_3: t('approvalHistory.stageApprover3'),
        rejected: t('approvalHistory.stageRejected'),
        paper_flow: t('approvalHistory.stagePaperFlow')
      };
      return stageMap[application.user_approval_stage] || t('approvalHistory.stageUnknown');
    }
    
    // 如果是 paper-flow，顯示為「紙本申請」
    if (application.is_paper_flow) {
      return t('approvalHistory.stagePaperFlow');
    }
    
    // Fallback: 如果沒有 user_approval_stage，使用舊的邏輯檢查直接批核者
    if (application.checker_id === user.id && application.checker_at) {
      return t('approvalHistory.stageChecker');
    } else if (application.approver_1_id === user.id && application.approver_1_at) {
      return t('approvalHistory.stageApprover1');
    } else if (application.approver_2_id === user.id && application.approver_2_at) {
      return t('approvalHistory.stageApprover2');
    } else if (application.approver_3_id === user.id && application.approver_3_at) {
      return t('approvalHistory.stageApprover3');
    } else if (application.rejected_by_id === user.id) {
      return t('approvalHistory.stageRejected');
    }
    return t('approvalHistory.stageUnknown');
  };

  const getApprovalDate = (application) => {
    // 如果是 paper-flow，使用創建時間（因為提交即批准）
    if (application.is_paper_flow || application.user_approval_stage === 'paper_flow') {
      return application.created_at;
    }
    
    // 優先使用 user_approval_stage 來確定日期
    if (application.user_approval_stage === 'checker' && application.checker_at) {
      return application.checker_at;
    } else if (application.user_approval_stage === 'approver_1' && application.approver_1_at) {
      return application.approver_1_at;
    } else if (application.user_approval_stage === 'approver_2' && application.approver_2_at) {
      return application.approver_2_at;
    } else if (application.user_approval_stage === 'approver_3' && application.approver_3_at) {
      return application.approver_3_at;
    } else if (application.user_approval_stage === 'rejected' && application.rejected_at) {
      return application.rejected_at;
    }
    
    // Fallback: 如果沒有 user_approval_stage，使用舊的邏輯
    if (application.checker_id === user.id && application.checker_at) {
      return application.checker_at;
    } else if (application.approver_1_id === user.id && application.approver_1_at) {
      return application.approver_1_at;
    } else if (application.approver_2_id === user.id && application.approver_2_at) {
      return application.approver_2_at;
    } else if (application.approver_3_id === user.id && application.approver_3_at) {
      return application.approver_3_at;
    } else if (application.rejected_by_id === user.id && application.rejected_at) {
      return application.rejected_at;
    }
    return null;
  };

  const getLeaveTypeDisplay = (application) => {
    // 根據當前語言選擇使用 name_zh 或 name
    const leaveTypeName = i18n.language === 'en' 
      ? (application.leave_type_name || application.leave_type_name_zh || '')
      : (application.leave_type_name_zh || application.leave_type_name || '');
    
    // 如果是銷假交易，在假期類型後加上「(銷假)」
    if (application.is_reversal_transaction === true) {
      return `${leaveTypeName} (${t('approvalHistory.reversal')})`;
    }
    return leaveTypeName;
  };

  const handleSearch = () => {
    setSearchKeyword(search);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const filteredApplications = applications.filter(app => {
    if (!searchKeyword) return true;
    
    const keyword = searchKeyword.toLowerCase();
    const transactionId = app.transaction_id?.toString().toLowerCase() || '';
    const leaveTypeNameZh = app.leave_type_name_zh?.toLowerCase() || '';
    const applicantNameZh = app.applicant_display_name?.toLowerCase() || '';
    const applicantUsername = (app.applicant_employee_number || app.user_employee_number || '').toLowerCase();
    
    return transactionId.includes(keyword) ||
           leaveTypeNameZh.includes(keyword) ||
           applicantNameZh.includes(keyword) ||
           applicantUsername.includes(keyword);
  });

  const renderMobileCard = (app, isReversal = false) => {
    return (
      <Card key={isReversal ? `reversal-${app.id}` : app.id} sx={{ mb: 2, backgroundColor: isReversal ? '#f8f9fa' : 'inherit' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {isReversal ? t('approvalHistory.reversalPrefix') : t('approvalHistory.transactionId')}
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
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.applicant')}
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
                {t('approvalHistory.leaveType')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {getLeaveTypeDisplay(app)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.year')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('approvalHistory.yearSuffix')}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.startDate')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDate(app.start_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.endDate')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDate(app.end_date)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.days')}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  mb: 1, 
                  fontWeight: 'medium',
                  color: isReversal ? 'error.main' : 'inherit'
                }}
              >
                {isReversal ? `-${Math.abs(app.days)}` : app.days}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.approvalStage')}
              </Typography>
              <Chip
                label={isReversal ? t('approvalHistory.hrReversal') : getApprovalStage(app)}
                size="small"
                color={isReversal ? 'info' : 'primary'}
                sx={{ mt: 0.5 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('approvalHistory.approvalTime')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatDateTime(isReversal ? app.created_at : getApprovalDate(app))}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => navigate(`/approval/${app.id}`)}
              startIcon={<VisibilityIcon />}
            >
              {t('approvalHistory.viewDetails')}
            </Button>
            {!isReversal && canManageFiles(app) && (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={() => handleOpenFileDialog(app)}
                startIcon={<AttachFileIcon />}
              >
                {t('approvalHistory.manageFiles')}
              </Button>
            )}
            {!isReversal && canShowReversalButton(app) && (
              <Button
                fullWidth
                variant="contained"
                size="small"
                color="warning"
                startIcon={<UndoIcon />}
                onClick={() => handleReversalClick(app)}
              >
                {t('approvalHistory.reversal')}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const isHRMember = user?.is_hr_member || user?.is_system_admin;

  const handleOpenFileDialog = async (application) => {
    setSelectedApplication(application);
    setFileDialogOpen(true);
    setError('');
    setSuccess('');
    await fetchDocuments(application.id);
  };

  const handleCloseFileDialog = () => {
    setFileDialogOpen(false);
    setSelectedApplication(null);
    setDocuments([]);
    setError('');
    setSuccess('');
  };

  const fetchDocuments = async (applicationId) => {
    try {
      const response = await axios.get(`/api/leaves/${applicationId}/documents`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Fetch documents error:', error);
      setError(t('approvalHistory.fetchFilesError'));
    }
  };

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!selectedApplication) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      await axios.post(`/api/leaves/${selectedApplication.id}/documents`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(t('approvalHistory.uploadSuccess', { count: files.length }));
      await fetchDocuments(selectedApplication.id);
      event.target.value = ''; // 重置文件輸入
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || t('approvalHistory.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm(t('approvalHistory.confirmDelete'))) {
      return;
    }

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      console.log(`[handleDeleteDocument] 嘗試刪除檔案，documentId: ${documentId}`);
      const response = await axios.delete(`/api/leaves/documents/${documentId}`);
      console.log(`[handleDeleteDocument] 刪除成功:`, response.data);
      setSuccess(t('approvalHistory.fileDeleted'));
      await fetchDocuments(selectedApplication.id);
    } catch (error) {
      console.error('[handleDeleteDocument] 刪除錯誤:', error);
      console.error('[handleDeleteDocument] 錯誤響應:', error.response);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          t('approvalHistory.deleteError');
      setError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType, fileName) => {
    if (fileType && fileType.startsWith('image/')) {
      return <ImageIcon />;
    }
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return <DescriptionIcon />;
    }
    return <DescriptionIcon />;
  };

  const canManageFiles = (application) => {
    // 只有 HR Group 獲授權人且申請已批核時才能管理檔案
    return isHRMember && application.status === 'approved';
  };

  const canShowReversalButton = (application) => {
    // 只有 HR 成員可以看到銷假按鈕
    if (!isHRMember) {
      return false;
    }
    
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
    
    return true;
  };

  const handleReversalClick = (application) => {
    setSelectedReversalApplication(application);
    setReversalDialogOpen(true);
  };

  const handleReversalConfirm = async () => {
    if (!selectedReversalApplication) return;

    try {
      setReversing(true);
      const response = await axios.post('/api/leaves/reverse', {
        application_id: selectedReversalApplication.id
      });
      
      // 使用後端返回的消息
      const message = response.data.message || t('approvalHistory.reversalCompleted');
      
      setSnackbar({
        open: true,
        message,
        severity: 'success'
      });
      
      setReversalDialogOpen(false);
      setSelectedReversalApplication(null);
      
      // 重新載入申請列表
      await fetchApprovalHistory();
    } catch (error) {
      console.error('Reversal error:', error);
      const errorMessage = error.response?.data?.message || t('approvalHistory.reversalError');
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
    setSelectedReversalApplication(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
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
        {t('approvalHistory.title')}
      </Typography>

      <Paper sx={{ mt: 2, p: { xs: 1.5, sm: 2 } }}>
        <TextField
          fullWidth
          placeholder={t('approvalHistory.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
          label={t('approvalHistory.searchKeyword') || t('common.search')}
          size={isMobile ? "small" : "medium"}
        />

        {/* 進階搜尋 */}
        <Accordion expanded={advancedSearchExpanded} onChange={(e, expanded) => setAdvancedSearchExpanded(expanded)} sx={{ mb: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">{t('approvalHistory.advancedSearch') || t('leaveHistory.advancedSearch')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('approvalHistory.statusFilter')}</InputLabel>
                  <Select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      // 狀態改變時立即觸發搜尋
                      setTimeout(() => fetchApprovalHistory(), 0);
                    }}
                    label={t('approvalHistory.statusFilter')}
                  >
                    <MenuItem value="all">{t('approvalHistory.all')}</MenuItem>
                    <MenuItem value="approved">{t('approvalHistory.approved')}</MenuItem>
                    <MenuItem value="rejected">{t('approvalHistory.rejected')}</MenuItem>
                    <MenuItem value="cancelled">{t('approvalHistory.cancelled')}</MenuItem>
                    <MenuItem value="reversed">{t('approvalHistory.reversed')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('approvalHistory.leaveTypeFilter') || t('leaveHistory.leaveTypeFilter')}</InputLabel>
                  <Select
                    value={filterLeaveType}
                    onChange={(e) => setFilterLeaveType(e.target.value)}
                    label={t('approvalHistory.leaveTypeFilter') || t('leaveHistory.leaveTypeFilter')}
                  >
                    <MenuItem value="">{t('approvalHistory.allLeaveTypes') || t('leaveHistory.allLeaveTypes')}</MenuItem>
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
                  <InputLabel>{t('approvalHistory.flowTypeFilter') || t('leaveHistory.flowTypeFilter')}</InputLabel>
                  <Select
                    value={filterFlowType}
                    onChange={(e) => setFilterFlowType(e.target.value)}
                    label={t('approvalHistory.flowTypeFilter') || t('leaveHistory.flowTypeFilter')}
                  >
                    <MenuItem value="">{t('approvalHistory.allFlowTypes') || t('leaveHistory.allFlowTypes')}</MenuItem>
                    <MenuItem value="e-flow">{t('approvalHistory.eFlow') || t('leaveHistory.eFlow')}</MenuItem>
                    <MenuItem value="paper-flow">{t('approvalHistory.paperFlow') || t('leaveHistory.paperFlow')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('approvalHistory.departmentGroupFilter') || t('leaveHistory.departmentGroupFilter')}</InputLabel>
                  <Select
                    value={filterDepartmentGroup}
                    onChange={(e) => setFilterDepartmentGroup(e.target.value)}
                    label={t('approvalHistory.departmentGroupFilter') || t('leaveHistory.departmentGroupFilter')}
                  >
                    <MenuItem value="">{t('approvalHistory.allDepartmentGroups') || t('leaveHistory.allDepartmentGroups')}</MenuItem>
                    {departmentGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'en' ? (group.name || group.name_zh) : (group.name_zh || group.name)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label={t('approvalHistory.yearFilter') || t('leaveHistory.yearFilter')}
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  placeholder={t('approvalHistory.allYears') || t('leaveHistory.allYears')}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('approvalHistory.monthFilter') || t('leaveHistory.monthFilter')}</InputLabel>
                  <Select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    label={t('approvalHistory.monthFilter') || t('leaveHistory.monthFilter')}
                  >
                    <MenuItem value="">{t('approvalHistory.allMonths') || t('leaveHistory.allMonths')}</MenuItem>
                    <MenuItem value="1">{t('approvalHistory.month1') || '1月'}</MenuItem>
                    <MenuItem value="2">{t('approvalHistory.month2') || '2月'}</MenuItem>
                    <MenuItem value="3">{t('approvalHistory.month3') || '3月'}</MenuItem>
                    <MenuItem value="4">{t('approvalHistory.month4') || '4月'}</MenuItem>
                    <MenuItem value="5">{t('approvalHistory.month5') || '5月'}</MenuItem>
                    <MenuItem value="6">{t('approvalHistory.month6') || '6月'}</MenuItem>
                    <MenuItem value="7">{t('approvalHistory.month7') || '7月'}</MenuItem>
                    <MenuItem value="8">{t('approvalHistory.month8') || '8月'}</MenuItem>
                    <MenuItem value="9">{t('approvalHistory.month9') || '9月'}</MenuItem>
                    <MenuItem value="10">{t('approvalHistory.month10') || '10月'}</MenuItem>
                    <MenuItem value="11">{t('approvalHistory.month11') || '11月'}</MenuItem>
                    <MenuItem value="12">{t('approvalHistory.month12') || '12月'}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label={t('approvalHistory.dateFrom') || t('leaveHistory.dateFrom')}
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
                  label={t('approvalHistory.dateTo') || t('leaveHistory.dateTo')}
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
                    {t('approvalHistory.clearFilter') || t('leaveHistory.clearFilter')}
                  </Button>
                  <Button 
                    variant="contained" 
                    onClick={handleApplyFilter}
                    fullWidth={isMobile}
                  >
                    {t('approvalHistory.applyFilter') || t('leaveHistory.applyFilter')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, mt: 2 }}>
        <Button
          variant="contained"
          onClick={handleSearch}
          startIcon={<SearchIcon />}
          fullWidth={isMobile}
        >
          {t('common.search')}
        </Button>
      </Box>

      <Paper sx={{ p: { xs: 1, sm: 0 } }}>
        {isMobile ? (
          // 手機版：卡片式布局
          <Box>
            {filteredApplications.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                {t('approvalHistory.noRecords')}
              </Alert>
            ) : (
              filteredApplications.map((app) => (
                <React.Fragment key={app.id}>
                  {renderMobileCard(app)}
                  {/* 顯示相關的 Reverse Transaction */}
                  {app.reversal_transactions && app.reversal_transactions.length > 0 && (
                    app.reversal_transactions.map((reversal) => renderMobileCard(reversal, true))
                  )}
                </React.Fragment>
              ))
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.transactionId')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.applicant')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.leaveType')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.startDate')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.endDate')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.days')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.approvalStage')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.approvalTime')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.status')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('approvalHistory.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} align="center">{t('approvalHistory.noRecords')}</TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((app) => (
                    <React.Fragment key={app.id}>
                      <TableRow hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.transaction_id}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {app.applicant_display_name}
                          {(app.applicant_employee_number || app.user_employee_number) && (
                            <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                              ({app.applicant_employee_number || app.user_employee_number})
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{getLeaveTypeDisplay(app)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {app.year || (app.start_date ? new Date(app.start_date).getFullYear() : '-')}{t('approvalHistory.yearSuffix')}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(app.start_date)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(app.end_date)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.days}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <Chip
                            label={getApprovalStage(app)}
                            size="small"
                            color="primary"
                          />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(getApprovalDate(app))}</TableCell>
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
                              variant="contained"
                              size="small"
                              onClick={() => navigate(`/approval/${app.id}`)}
                              startIcon={<VisibilityIcon />}
                            >
                              {t('approvalHistory.viewDetails')}
                            </Button>
                            {canManageFiles(app) && (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleOpenFileDialog(app)}
                                startIcon={<AttachFileIcon />}
                              >
                                {t('approvalHistory.manageFiles')}
                              </Button>
                            )}
                            {canShowReversalButton(app) && (
                              <Button
                                variant="contained"
                                size="small"
                                color="warning"
                                startIcon={<UndoIcon />}
                                onClick={() => handleReversalClick(app)}
                              >
                                {t('approvalHistory.reversal')}
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      {/* 顯示相關的 Reverse Transaction */}
                      {app.reversal_transactions && app.reversal_transactions.length > 0 && (
                        app.reversal_transactions.map((reversal) => (
                          <TableRow key={`reversal-${reversal.id}`} hover sx={{ backgroundColor: '#f8f9fa' }}>
                            <TableCell sx={{ pl: 4, position: 'relative', whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                  {t('approvalHistory.reversalPrefix')}
                                </Typography>
                                {reversal.transaction_id}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {reversal.applicant_display_name}
                              {(reversal.applicant_employee_number || reversal.user_employee_number) && (
                                <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                                  ({reversal.applicant_employee_number || reversal.user_employee_number})
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={t('approvalHistory.reversalLabel')}
                                  color="info"
                                  size="small"
                                  sx={{ fontSize: '0.65rem', height: '20px' }}
                                />
                                <Typography variant="body2">{getLeaveTypeDisplay(reversal)}</Typography>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              {reversal.year || (reversal.start_date ? new Date(reversal.start_date).getFullYear() : '-')}{t('approvalHistory.yearSuffix')}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(reversal.start_date)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(reversal.end_date)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Typography variant="body2" sx={{ color: 'error.main' }}>
                                -{Math.abs(reversal.days)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Chip
                                label={t('approvalHistory.hrReversal')}
                                size="small"
                                color="info"
                              />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(reversal.created_at)}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Chip
                                label={getStatusText(reversal)}
                                color={getStatusColor(reversal)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => navigate(`/approval/${reversal.id}`)}
                                startIcon={<VisibilityIcon />}
                              >
                                {t('approvalHistory.viewDetails')}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* 檔案管理對話框 */}
      <Dialog
        open={fileDialogOpen}
        onClose={handleCloseFileDialog}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {t('approvalHistory.manageFilesTitle')} - {selectedApplication?.transaction_id}
            </Typography>
            <IconButton onClick={handleCloseFileDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <Box sx={{ mb: 2 }}>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif"
              style={{ display: 'none' }}
              id="file-upload"
              multiple
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <label htmlFor="file-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadIcon />}
                disabled={uploading}
                sx={{ mb: 2 }}
              >
                {uploading ? t('approvalHistory.uploading') : t('approvalHistory.uploadFile')}
              </Button>
            </label>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('approvalHistory.supportedFormats')}
            </Typography>
          </Box>

          <Typography variant="h6" gutterBottom>
            {t('approvalHistory.fileList')}
          </Typography>
          {documents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('approvalHistory.noFiles')}
            </Typography>
          ) : (
            <List>
              {documents.map((doc) => (
                <ListItem
                  key={doc.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={t('approvalHistory.deleteFile')}
                      onClick={() => handleDeleteDocument(doc.id)}
                      disabled={deleting}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                    {getFileIcon(doc.file_type, doc.file_name)}
                    <Link
                      href={`/api/leaves/documents/${doc.id}/download?view=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textDecoration: 'none', flex: 1 }}
                    >
                      <ListItemText
                        primary={doc.file_name}
                        secondary={doc.file_size ? formatFileSize(doc.file_size) : ''}
                      />
                    </Link>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFileDialog}>{t('approvalHistory.close')}</Button>
        </DialogActions>
      </Dialog>

      {/* 銷假確認對話框 */}
      <Dialog
        open={reversalDialogOpen}
        onClose={handleReversalCancel}
        aria-labelledby="reversal-dialog-title"
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle id="reversal-dialog-title">{t('approvalHistory.confirmReversal')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('approvalHistory.confirmReversalMessage')}
            {selectedReversalApplication && (
              <>
                <br />
                <br />
                <strong>{t('approvalHistory.applicationDetails')}</strong>
                <br />
                {t('approvalHistory.transactionIdLabel')}{selectedReversalApplication.transaction_id}
                <br />
                {t('approvalHistory.applicantLabel')}{selectedReversalApplication.applicant_display_name}
                <br />
                {t('approvalHistory.leaveTypeLabel')}{selectedReversalApplication.leave_type_name_zh}
                <br />
                {t('approvalHistory.dateLabel')}{formatDate(selectedReversalApplication.start_date)} ~ {formatDate(selectedReversalApplication.end_date)}
                <br />
                {t('approvalHistory.daysLabel')}{selectedReversalApplication.days} {t('approvalHistory.days')}
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
            {reversing ? t('approvalHistory.processing') : t('approvalHistory.confirmReversal')}
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

export default ApprovalHistory;

