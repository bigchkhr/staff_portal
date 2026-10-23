import React, { useState, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  IconButton,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { Visibility as VisibilityIcon, GetApp as GetAppIcon, Description as DescriptionIcon, Image as ImageIcon, Close as CloseIcon, Upload as UploadIcon, Delete as DeleteIcon, AttachFile as AttachFileIcon, CameraAlt as CameraIcon, CheckCircle as CheckCircleIcon, Cancel as CancelIcon, Undo as UndoIcon, Reply as ReplyIcon, Send as SendIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatDate, toHKCalendarDate, toHKDayjs } from '../utils/dateFormat';
import { calculateLeaveDays } from '../utils/leaveDays';
import YearSelector from '../components/YearSelector';
import Swal from 'sweetalert2';

const ApprovalDetail = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [application, setApplication] = useState(null);
  const [applicationType, setApplicationType] = useState('leave');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [comment, setComment] = useState('');
  const [action, setAction] = useState('');
  const [canApproveThis, setCanApproveThis] = useState(false);
  const [canRejectThis, setCanRejectThis] = useState(false);
  const [userApprovalStage, setUserApprovalStage] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [workflow, setWorkflow] = useState(null);
  const [returnStage, setReturnStage] = useState('');
  const [workflowReason, setWorkflowReason] = useState('');
  const [workflowActing, setWorkflowActing] = useState(false);
  const [reviseForm, setReviseForm] = useState(null);
  const [reviseDialogOpen, setReviseDialogOpen] = useState(false);
  const [reviseIncludeWeekends, setReviseIncludeWeekends] = useState(false);
  const [reviseYearManual, setReviseYearManual] = useState(false);
  const [reviseFiles, setReviseFiles] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [hrRejectionReason, setHrRejectionReason] = useState('');
  const [hrRejecting, setHrRejecting] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isImagePanning, setIsImagePanning] = useState(false);
  const imagePanStartRef = useRef(null);

  const resetImageTransform = () => {
    setImageZoom(1);
    setImagePan({ x: 0, y: 0 });
    setIsImagePanning(false);
    imagePanStartRef.current = null;
  };

  useEffect(() => {
    if (fileDialogOpen && viewingFile?.file_type?.startsWith('image/')) {
      resetImageTransform();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileDialogOpen, viewingFile?.id]);

  useEffect(() => {
    const type = searchParams.get('type') || 'leave';
    setApplicationType(type);
    fetchApplication(type);
  }, [id, searchParams]);

  useEffect(() => {
    if (application && user) {
      checkCanApprove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application, user, id]);

  useEffect(() => {
    if (application) {
      fetchDocuments();
    }
  }, [application, id]);

  const fetchApplication = async (type = 'leave') => {
    try {
      setLoading(true);
      let response;
      if (type === 'extra_working_hours') {
        response = await axios.get(`/api/extra-working-hours/${id}`);
      } else if (type === 'outdoor_work') {
        response = await axios.get(`/api/outdoor-work/${id}`);
      } else {
        response = await axios.get(`/api/leaves/${id}`);
      }
      console.log('Application data:', response.data.application);
      setApplication(response.data.application);
      try {
        const workflowResponse = await axios.get(`/api/approvals/${id}/workflow`, {
          params: { application_type: type }
        });
        setWorkflow(workflowResponse.data);
        const targets = workflowResponse.data.return_targets || [];
        setReturnStage(targets[0]?.stage || '');
      } catch (workflowError) {
        console.error('Fetch workflow error:', workflowError);
        setWorkflow(null);
      }
    } catch (error) {
      console.error('Fetch application error:', error);
      let errorMessage = t('approvalDetail.fetchError');
      if (error.response?.status === 403) {
        errorMessage = t('approvalDetail.noPermission');
      } else if (error.response?.status === 404) {
        errorMessage = t('approvalDetail.applicationNotFound');
      }
      
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.loadFailed'),
        text: errorMessage,
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#d33'
      });
      
      setApplication(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    // 額外工作時數申報和外勤工作申請目前不支持文件上傳
    if (applicationType === 'extra_working_hours' || applicationType === 'outdoor_work') {
      setDocuments([]);
      return;
    }
    try {
      const response = await axios.get(`/api/leaves/${id}/documents`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Fetch documents error:', error);
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

  const getCurrentStage = (app) => {
    // 優先使用後端返回的 current_approval_stage
    if (app.current_approval_stage) {
      const stageMap = {
        'checker': { stage: 'checker', text: t('approvalDetail.stageChecker') },
        'approver_1': { stage: 'approver_1', text: t('approvalDetail.stageApprover1') },
        'approver_2': { stage: 'approver_2', text: t('approvalDetail.stageApprover2') },
        'approver_3': { stage: 'approver_3', text: t('approvalDetail.stageApprover3') },
        'completed': { stage: 'completed', text: t('approvalDetail.stageCompleted') }
      };
      return stageMap[app.current_approval_stage] || { stage: 'checker', text: t('approvalDetail.stageChecker') };
    }
    // Fallback: 如果沒有 current_approval_stage，使用舊的邏輯
    // if (!app.checker_at && app.checker_id) return { stage: 'checker', text: '檢查' };
    // if (!app.approver_1_at && app.approver_1_id) return { stage: 'approver_1', text: '第一批核' };
    // if (!app.approver_2_at && app.approver_2_id) return { stage: 'approver_2', text: '第二批核' };
    // if (!app.approver_3_at && app.approver_3_id) return { stage: 'approver_3', text: '第三批核' };
    // return { stage: 'completed', text: '已完成' };
  };

  const checkCanApprove = async () => {
    if (!application || application.status !== 'pending') {
      setCanApproveThis(false);
      setCanRejectThis(false);
      setUserApprovalStage(null);
      return;
    }
    
    // 確定當前申請處於哪個階段（必須按順序：checker -> approver_1 -> approver_2 -> approver_3）
    // 優先使用後端返回的 current_approval_stage
    const currentStage = application.current_approval_stage || getCurrentStage(application).stage;

    
    // 如果已經完成所有批核階段，不顯示批核操作
    if (currentStage === 'completed') {
      setCanApproveThis(false);
      setCanRejectThis(false);
      setUserApprovalStage(null);
      return;
    }
    
    let canApproveFromBackend = false;
    try {
      const response = await axios.get(`/api/users/can-approve/${id}`, {
        params: { application_type: applicationType }
      });
      canApproveFromBackend = !!response.data?.canApprove;
      setCanApproveThis(canApproveFromBackend);
      setCanRejectThis(canApproveFromBackend);
      setUserApprovalStage(canApproveFromBackend ? currentStage : null);
    } catch (error) {
      console.error('Check approval permission error:', error);
      setCanApproveThis(false);
      setCanRejectThis(false);
      setUserApprovalStage(null);
    }

    // 直入單筆網址時，可批核者或 Approver 1/2/3 若同一申請人有多過一筆待批外勤，改去批量頁閱覽。
    if (applicationType === 'outdoor_work' && application.user_id) {
      try {
        const pendingRes = await axios.get(
          `/api/approvals/pending/outdoor-work/applicant/${application.user_id}`
        );
        const pendingApps = pendingRes.data.applications || [];
        const canBulkView = !!pendingRes.data.can_bulk_view || canApproveFromBackend;
        if (canBulkView && pendingApps.length > 1) {
          navigate(`/approval/outdoor-work/bulk/${application.user_id}`, { replace: true });
        }
      } catch (pendingError) {
        console.error('Detect outdoor work bulk redirect error:', pendingError);
      }
    }
  };

  const handleSubmit = async () => {
    if (!application) return;

    // 如果是批核操作且是假期申請，檢查假期餘額
    if (action === 'approve' && applicationType === 'leave') {
      // 檢查是否有假期餘額限制
      if (application.leave_type_requires_balance && application.leave_balance) {
        const appliedDays = parseFloat(application.days || 0);
        const availableBalance = parseFloat(application.leave_balance.balance || 0);
        
        // 如果申請的假期日數多於假期餘額，彈出警告框
        if (appliedDays > availableBalance) {
          const result = await Swal.fire({
            icon: 'warning',
            title: t('approvalDetail.insufficientBalance'),
            html: `
              <div style="text-align: left;">
                <p>${t('approvalDetail.appliedDaysHtml', { days: appliedDays })}</p>
                <p>${t('approvalDetail.availableBalanceHtml', { balance: availableBalance.toFixed(2) })}</p>
                <p style="color: #d32f2f; margin-top: 10px;">${t('approvalDetail.insufficientBalanceConfirm')}</p>
              </div>
            `,
            showCancelButton: true,
            confirmButtonText: t('approvalDetail.approveAnyway'),
            cancelButtonText: t('common.cancel'),
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            reverseButtons: true
          });

          // 如果用戶取消，不進行批核
          if (!result.isConfirmed) {
            return;
          }
        }
      }
    }

    setApproving(true);

    try {
      await axios.post(`/api/approvals/${id}/approve`, {
        action,
        remarks: comment,
        application_type: applicationType
      });

      // 使用 Sweet Alert 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: action === 'approve' ? t('approvalDetail.approvalSuccess') : t('approvalDetail.rejectionSuccess'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#3085d6'
      });
      
      navigate('/approval/list');
    } catch (error) {
      // 檢查是否為日期範圍重疊錯誤
      if (error.response?.data?.overlapping_applications && error.response.data.overlapping_applications.length > 0) {
        const overlappingApps = error.response.data.overlapping_applications;
        const formatDate = (dateStr) => {
          const date = new Date(dateStr);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };
        
        const overlappingList = overlappingApps.map(app => 
          `<div style="text-align: left; margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
            <strong>${t('approvalDetail.transactionIdLabel')}</strong>${app.transaction_id}<br/>
            <strong>${t('approvalDetail.leaveTypeLabel')}</strong>${app.leave_type_name}<br/>
            <strong>${t('approvalDetail.dateRangeLabel')}</strong>${formatDate(app.start_date)} ~ ${formatDate(app.end_date)}<br/>
            <strong>${t('approvalDetail.statusLabel')}</strong>${app.status}
          </div>`
        ).join('');
        
        await Swal.fire({
          icon: 'warning',
          title: t('approvalDetail.dateOverlap'),
          html: `
            <div style="text-align: left;">
              <p style="color: #d32f2f; font-weight: bold; margin-bottom: 15px;">${t('approvalDetail.dateOverlapMessage')}</p>
              ${overlappingList}
            </div>
          `,
          confirmButtonText: t('approvalDetail.ok'),
          confirmButtonColor: '#d33',
          width: '600px'
        });
        
        // 重新載入申請詳情以更新狀態
        await fetchApplication(applicationType);
      } else {
        // 使用 Sweet Alert 顯示錯誤訊息
        await Swal.fire({
          icon: 'error',
          title: t('approvalDetail.operationFailed'),
          text: error.response?.data?.message || t('approvalDetail.operationFailed'),
          confirmButtonText: t('approvalDetail.ok'),
          confirmButtonColor: '#d33'
        });
      }
    } finally {
      setApproving(false);
    }
  };

  const canManageLeaveAttachments = applicationType === 'leave' && !!user?.is_hr_member;

  const handleUploadDocuments = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingDocument(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }

      await axios.post(`/api/leaves/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await fetchDocuments();
      await Swal.fire({
        icon: 'success',
        title: t('approvalDetail.uploadSuccess', { count: files.length }),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.uploadError'),
        text: error.response?.data?.message || t('approvalDetail.uploadError'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setUploadingDocument(false);
      event.target.value = '';
    }
  };

  const handleDeleteDocument = async (documentId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('approvalDetail.confirmDeleteFile'),
      showCancelButton: true,
      confirmButtonText: t('approvalDetail.deleteFile'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      reverseButtons: true
    });
    if (!result.isConfirmed) return;

    setDeletingDocumentId(documentId);
    try {
      await axios.delete(`/api/leaves/documents/${documentId}`);
      await fetchDocuments();
      await Swal.fire({
        icon: 'success',
        title: t('approvalDetail.fileDeleted'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.deleteError'),
        text: error.response?.data?.message || t('approvalDetail.deleteError'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleHRReject = async () => {
    if (!application) return;

    setHrRejecting(true);

    try {
      await axios.post(`/api/approvals/${id}/approve`, {
        action: 'reject',
        remarks: hrRejectionReason || t('approvalDetail.hrDefaultRejectionReason'),
        application_type: applicationType
      });

      // 使用 Sweet Alert 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: t('approvalDetail.rejectionSuccess'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#3085d6'
      });
      
      navigate('/approval/list');
    } catch (error) {
      // 使用 Sweet Alert 顯示錯誤訊息
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.operationFailed'),
        text: error.response?.data?.message || t('approvalDetail.operationFailed'),
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setHrRejecting(false);
    }
  };

  const handleOpenFile = async (doc) => {
    try {
      setLoadingFile(true);
      setViewingFile(doc);
      setFileDialogOpen(true);

      const isImage = doc.file_type && doc.file_type.startsWith('image/');
      const isPDF = doc.file_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');
      const url = `/api/leaves/documents/${doc.id}/download${isImage || isPDF ? '?view=true' : ''}`;
      
      // 使用 axios 下載文件，確保認證 header 被包含
      const response = await axios.get(url, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 從響應中獲取正確的 MIME 類型
      const contentType = response.headers['content-type'] || doc.file_type || 'application/octet-stream';
      
      // 創建 blob URL（使用正確的 MIME 類型）
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);
      setFileBlobUrl(blobUrl);
    } catch (error) {
      console.error('下載文件錯誤:', error);
      setFileDialogOpen(false);
      setViewingFile(null);
      
      let errorMessage = t('approvalDetail.cannotOpenFile');
      if (error.response?.status === 403 || error.response?.status === 401) {
        errorMessage = t('approvalDetail.noPermissionFile');
      }
      
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.cannotOpenFileTitle'),
        text: errorMessage,
        confirmButtonText: t('approvalDetail.ok'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCloseFileDialog = () => {
    if (fileBlobUrl) {
      window.URL.revokeObjectURL(fileBlobUrl);
      setFileBlobUrl(null);
    }
    resetImageTransform();
    setFileDialogOpen(false);
    setViewingFile(null);
  };

  const stageLabel = (stage) => {
    const stageMap = {
      applicant: t('approvalDetail.stageApplicant'),
      checker: t('approvalDetail.stageChecker'),
      approver_1: t('approvalDetail.stageApprover1'),
      approver_2: t('approvalDetail.stageApprover2'),
      approver_3: t('approvalDetail.stageApprover3'),
      paper_flow: t('approvalDetail.stagePaperFlow'),
      completed: t('approvalDetail.stageCompleted')
    };
    return stageMap[stage] || stage;
  };

  const refreshAfterWorkflow = async (title) => {
    await Swal.fire({
      icon: 'success',
      title,
      confirmButtonText: t('common.confirm'),
      confirmButtonColor: '#28a745'
    });
    setWorkflowReason('');
    await fetchApplication(applicationType);
  };

  const handleWithdraw = async () => {
    if (!workflowReason.trim()) {
      await Swal.fire({ icon: 'warning', title: t('approvalDetail.reasonRequired'), confirmButtonText: t('common.confirm') });
      return;
    }
    const confirmed = await Swal.fire({
      icon: 'warning',
      title: t('approvalDetail.confirmWithdraw'),
      showCancelButton: true,
      confirmButtonText: t('approvalDetail.withdraw'),
      cancelButtonText: t('common.cancel')
    });
    if (!confirmed.isConfirmed) return;
    try {
      setWorkflowActing(true);
      await axios.post(`/api/approvals/${id}/withdraw`, {
        application_type: applicationType,
        reason: workflowReason.trim()
      });
      await refreshAfterWorkflow(t('approvalDetail.withdrawSuccess'));
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: error.response?.data?.message || t('approvalDetail.operationFailed'),
        confirmButtonText: t('common.confirm')
      });
    } finally {
      setWorkflowActing(false);
    }
  };

  const handleReturnApplication = async () => {
    if (!returnStage || !workflowReason.trim()) {
      await Swal.fire({ icon: 'warning', title: t('approvalDetail.reasonRequired'), confirmButtonText: t('common.confirm') });
      return;
    }
    try {
      setWorkflowActing(true);
      await axios.post(`/api/approvals/${id}/return`, {
        application_type: applicationType,
        to_stage: returnStage,
        reason: workflowReason.trim()
      });
      await refreshAfterWorkflow(t('approvalDetail.returnSuccess'));
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: error.response?.data?.message || t('approvalDetail.operationFailed'),
        confirmButtonText: t('common.confirm')
      });
    } finally {
      setWorkflowActing(false);
    }
  };

  useEffect(() => {
    if (applicationType !== 'leave' || !workflow?.can_resubmit || !application) return;
    const isStore = user?.position_stream === 'Store';
    const startDate = toHKCalendarDate(application.start_date) || '';
    const startYear = startDate ? toHKDayjs(startDate).year() : toHKDayjs(new Date()).year();
    const applicationYear = Number(application.year || startYear);
    setReviseIncludeWeekends(isStore);
    setReviseYearManual(Number(applicationYear) !== Number(startYear));
    setReviseForm({
      leave_type_id: application.leave_type_id || '',
      start_date: startDate,
      start_session: application.start_session || 'AM',
      end_date: toHKCalendarDate(application.end_date) || '',
      end_session: application.end_session || 'PM',
      total_days: '',
      reason: application.reason || '',
      year: applicationYear,
      exclude_public_holidays: !isStore
    });
    axios.get('/api/leave-types/available-in-flow')
      .then((response) => setLeaveTypes(response.data.leaveTypes || response.data.leave_types || response.data || []))
      .catch((error) => console.error('Fetch leave types error:', error));
  }, [applicationType, workflow?.can_resubmit, application, user?.position_stream]);

  useEffect(() => {
    if (!reviseForm?.start_date || !reviseForm?.end_date) return;
    let cancelled = false;
    const updateDays = async () => {
      const days = await calculateLeaveDays(
        reviseForm.start_date,
        reviseForm.end_date,
        reviseForm.start_session,
        reviseForm.end_session,
        reviseIncludeWeekends,
        reviseForm.exclude_public_holidays
      );
      if (cancelled) return;
      const startYear = toHKDayjs(reviseForm.start_date)?.year();
      setReviseForm((prev) => {
        if (!prev) return prev;
        const nextYear = reviseYearManual ? prev.year : startYear;
        const nextDays = days > 0 ? String(days) : '';
        if (String(prev.total_days) === nextDays && Number(prev.year) === Number(nextYear)) return prev;
        return { ...prev, total_days: nextDays, year: nextYear };
      });
    };
    updateDays();
    return () => {
      cancelled = true;
    };
  }, [
    reviseForm?.start_date,
    reviseForm?.end_date,
    reviseForm?.start_session,
    reviseForm?.end_session,
    reviseForm?.exclude_public_holidays,
    reviseIncludeWeekends,
    reviseYearManual
  ]);

  const handleReviseFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff', 'image/tif', 'application/pdf'];
    const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
    const maxSize = 5 * 1024 * 1024;
    const validFiles = [];
    const errors = [];

    selectedFiles.forEach((file) => {
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExt);
      const isValidSize = file.size <= maxSize;
      if (!isValidType) {
        errors.push(`${file.name}: ${t('leaveApplication.unsupportedFileType', { types: allowedExtensions.join(', ') })}`);
      } else if (!isValidSize) {
        errors.push(`${file.name}: ${t('leaveApplication.fileSizeLimit')}`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.uploadError'),
        html: errors.join('<br>'),
        confirmButtonText: t('common.confirm')
      });
    }
    if (validFiles.length > 0) {
      setReviseFiles((prev) => [...prev, ...validFiles]);
    }
    e.target.value = '';
  };

  const handleReviseCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (event) => {
      if (event.target.files && event.target.files.length > 0) {
        await handleReviseFileChange(event);
      }
    };
    input.click();
  };

  const alertOverDialog = (options) => Swal.fire({
    heightAuto: false,
    ...options,
    didOpen: () => {
      const container = Swal.getContainer();
      if (container) container.style.zIndex = '20000';
    }
  });

  const handleResubmit = async () => {
    const startDate = toHKCalendarDate(reviseForm?.start_date);
    const endDate = toHKCalendarDate(reviseForm?.end_date);
    if (applicationType === 'leave' && (!startDate || !endDate || !reviseForm?.leave_type_id || !reviseForm?.total_days)) {
      await alertOverDialog({
        icon: 'warning',
        title: t('approvalDetail.fillRequiredFields'),
        confirmButtonText: t('common.confirm')
      });
      return;
    }

    try {
      setWorkflowActing(true);
      if (applicationType === 'leave') {
        await axios.put(`/api/leaves/${id}/revise`, {
          ...reviseForm,
          start_date: startDate,
          end_date: endDate,
          year: Number(reviseForm.year) || Number(startDate.slice(0, 4))
        });
        if (reviseFiles.length > 0) {
          const formData = new FormData();
          reviseFiles.forEach((file) => formData.append('files', file));
          await axios.post(`/api/leaves/${id}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          setReviseFiles([]);
          await fetchDocuments();
        }
      }
      await axios.post(`/api/approvals/${id}/resubmit`, {
        application_type: applicationType
      });
      flushSync(() => {
        setReviseFiles([]);
        setReviseDialogOpen(false);
        setWorkflowActing(false);
      });
      await alertOverDialog({
        icon: 'success',
        title: t('approvalDetail.resubmitSuccess'),
        timer: 1600,
        timerProgressBar: true,
        showConfirmButton: false
      });
      await fetchApplication(applicationType);
    } catch (error) {
      await alertOverDialog({
        icon: 'error',
        title: error.response?.data?.message || t('approvalDetail.operationFailed'),
        confirmButtonText: t('common.confirm')
      });
    } finally {
      setWorkflowActing(false);
    }
  };

  const applicantGroupPositionSubtitle = useMemo(() => {
    if (!application) return '';
    const isEn = (i18n.language || '').toLowerCase().startsWith('en');
    const grp = isEn ? application.applicant_groups_label_en : application.applicant_groups_label_zh;
    const pos = isEn
      ? (application.applicant_position_name || application.applicant_position_name_zh)
      : (application.applicant_position_name_zh || application.applicant_position_name);
    return [grp, pos].filter((p) => p != null && String(p).trim() !== '').join(' · ');
  }, [application, i18n.language]);

  const timelineEvents = useMemo(() => {
    const items = [...(workflow?.actions || [])];
    if (application?.created_at && !items.some((item) => item.action === 'submitted')) {
      items.push({
        id: 'submitted',
        action: 'submitted',
        actor_display_name: application.applicant_display_name || application.user_display_name || null,
        from_stage: 'applicant',
        created_at: application.created_at
      });
    }
    return items.sort((a, b) => {
      const timeOf = (item) => new Date(item.sort_at || item.created_at || 0).getTime();
      const diff = timeOf(a) - timeOf(b);
      if (!Number.isNaN(diff) && diff !== 0) return diff;
      if (a.action === 'submitted') return -1;
      if (b.action === 'submitted') return 1;
      return 0;
    });
  }, [workflow, application]);

  if (loading) {
    return <Box>{t('common.loading')}</Box>;
  }

  if (!application) {
    return <Box>{t('approvalDetail.applicationNotFound')}</Box>;
  }

  // 優先使用後端返回的 current_approval_stage
  const currentStage = application.current_approval_stage || getCurrentStage(application).stage;
  const { text } = getCurrentStage(application);
  // 如果用戶有特定的批核階段，使用該階段；否則使用當前階段
  const displayStage = userApprovalStage || currentStage;
  const displayText = userApprovalStage === 'checker' ? t('approvalDetail.stageChecker') :
                      userApprovalStage === 'approver_1' ? t('approvalDetail.stageApprover1') :
                      userApprovalStage === 'approver_2' ? t('approvalDetail.stageApprover2') :
                      userApprovalStage === 'approver_3' ? t('approvalDetail.stageApprover3') :
                      text;

  // 檢查是否為銷假交易
  const isReversalTransaction = application.is_reversal_transaction === true;
  // 已批准、銷假申請、或已被銷假之原申請：不顯示假期餘額（僅待批核之一般申請顯示，供批核參考）
  const showLeaveBalanceRow =
    application.leave_type_requires_balance &&
    application.leave_balance &&
    application.status !== 'approved' &&
    !isReversalTransaction &&
    !application.is_reversed;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h5">
          {t('approvalDetail.title')}
        </Typography>
        {isReversalTransaction && (
          <Chip
            label={t('approvalDetail.reversalApplication')}
            sx={{
              backgroundColor: '#d32f2f',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              height: '32px',
              '& .MuiChip-label': {
                color: '#ffffff',
                fontWeight: 'bold'
              }
            }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('approvalDetail.applicationInfo')}
            </Typography>

            <List>
              <ListItem>
                <ListItemText 
                  primary={t('approvalDetail.transactionId')}
                  secondary={application.transaction_id}
                  primaryTypographyProps={{ variant: 'caption' }}
                  secondaryTypographyProps={{ variant: 'body1' }}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary={t('approvalDetail.applicant')}
                  secondary={
                    <Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography variant="body1" component="span">
                          {application.applicant_display_name}
                        </Typography>
                        {(application.applicant_employee_number || application.user_employee_number) && (
                          <Typography variant="body2" color="text.secondary" component="span">
                            ({application.applicant_employee_number || application.user_employee_number})
                          </Typography>
                        )}
                      </Box>
                      {applicantGroupPositionSubtitle ? (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                          {applicantGroupPositionSubtitle}
                        </Typography>
                      ) : null}
                    </Box>
                  }
                  primaryTypographyProps={{ variant: 'caption' }}
                  secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                />
              </ListItem>
              {applicationType === 'extra_working_hours' ? (
                <>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.applicationType')}
                      secondary={t('approvalDetail.extraWorkingHoursApplication')}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.applicationDate')}
                      secondary={application.application_date ? formatDate(application.application_date) : '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.startDateTime')}
                      secondary={application.start_date && application.start_time 
                        ? `${formatDate(application.start_date)} ${application.start_time}`
                        : formatDate(application.start_date)}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.endDateTime')}
                      secondary={application.end_date && application.end_time 
                        ? `${formatDate(application.end_date)} ${application.end_time}`
                        : formatDate(application.end_date)}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.totalHours')}
                      secondary={t('approvalDetail.totalHoursValue', { hours: application.total_hours || 0 })}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  {application.reason && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.extraWorkReason')}
                        secondary={application.reason}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                  {application.description && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.contentDescription')}
                        secondary={application.description}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                </>
              ) : applicationType === 'outdoor_work' ? (
                <>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.applicationType')}
                      secondary={t('approvalDetail.outdoorWorkApplication')}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.applicationDate')}
                      secondary={application.application_date ? formatDate(application.application_date) : '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.startDateTime')}
                      secondary={application.start_date && application.start_time 
                        ? `${formatDate(application.start_date)} ${application.start_time}`
                        : formatDate(application.start_date)}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.endDateTime')}
                      secondary={application.end_date && application.end_time 
                        ? `${formatDate(application.end_date)} ${application.end_time}`
                        : formatDate(application.end_date)}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary={t('approvalDetail.totalHours')}
                      secondary={t('approvalDetail.totalHoursValue', { hours: application.total_hours || 0 })}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  {application.start_location && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.startLocation')}
                        secondary={application.start_location}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                  {application.end_location && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.endLocation')}
                        secondary={application.end_location}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                  {application.transportation && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.transportation')}
                        secondary={application.transportation}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                  {application.expense && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.expense')}
                        secondary={`$${parseFloat(application.expense).toFixed(2)}`}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                  {application.purpose && (
                    <ListItem>
                      <ListItemText 
                        primary={t('approvalDetail.purpose')}
                        secondary={application.purpose}
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1' }}
                      />
                    </ListItem>
                  )}
                </>
              ) : (
                <>
                  <ListItem
                    sx={{
                      display: 'inline-block',
                      width: 'fit-content',
                      maxWidth: '100%',
                      px: 0,
                    }}
                  >
                    {!isMobile ? (
                      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {t('approvalDetail.applicationDate')}
                        </Typography>
                        <Typography variant="body2" component="div">
                          {application.application_date ? formatDate(application.application_date) : '-'}
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {t('approvalDetail.applicationDate')}
                        </Typography>
                        <Typography variant="body2" component="div">
                          {application.application_date ? formatDate(application.application_date) : '-'}
                        </Typography>

                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary" component="div">
                            {t('approvalDetail.leaveType')}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="body2" component="span">
                              {i18n.language === 'en'
                                ? (application.leave_type_name || application.leave_type_name_zh || '')
                                : (application.leave_type_name_zh || application.leave_type_name || '')}
                            </Typography>
                            {isReversalTransaction && (
                              <Box
                                component="span"
                                sx={{
                                  bgcolor: 'error.main',
                                  color: 'common.white',
                                  display: 'inline-block',
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 0.5,
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  lineHeight: 1.5,
                                }}
                              >
                                {t('approvalDetail.reversalApplication')}
                              </Box>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                            {(application.year ||
                              (application.start_date ? new Date(application.start_date).getFullYear() : '-')) +
                              t('approvalDetail.yearSuffix')}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                    <TableContainer
                      sx={{
                        overflowX: 'auto',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        display: 'inline-block',
                        maxWidth: '100%',
                      }}
                    >
                      <Table size="small" sx={{ width: 'auto', minWidth: 0, tableLayout: 'auto' }}>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.700' }}>
                            {!isMobile && (
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  color: 'common.white',
                                  maxWidth: 120,
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {t('approvalDetail.leaveType')}
                              </TableCell>
                            )}
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'common.white' }}>
                              {t('approvalDetail.startDate')}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'common.white' }}>
                              {t('approvalDetail.endDate')}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'common.white' }}>
                              {t('approvalDetail.days')}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          <TableRow>
                            {!isMobile && (
                              <TableCell
                                sx={{
                                  verticalAlign: 'top',
                                  maxWidth: 120,
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                }}
                              >
                                <Box>
                                  <Typography component="div" variant="body2">
                                    {i18n.language === 'en'
                                      ? (application.leave_type_name || application.leave_type_name_zh || '')
                                      : (application.leave_type_name_zh || application.leave_type_name || '')}
                                  </Typography>
                                  {isReversalTransaction && (
                                    <Box
                                      component="div"
                                      sx={{
                                        bgcolor: 'error.main',
                                        color: 'common.white',
                                        display: 'inline-block',
                                        px: 1,
                                        py: 0.25,
                                        borderRadius: 0.5,
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        lineHeight: 1.5,
                                        mt: 0.5,
                                      }}
                                    >
                                      {t('approvalDetail.reversalApplication')}
                                    </Box>
                                  )}
                                </Box>
                                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                                  {(application.year ||
                                    (application.start_date ? new Date(application.start_date).getFullYear() : '-')) +
                                    t('approvalDetail.yearSuffix')}
                                </Typography>
                              </TableCell>
                            )}
                            <TableCell sx={{ verticalAlign: 'top' }}>
                              {application.start_date ? (
                                application.start_session ? (
                                  <Box>
                                    <Typography variant="body2" component="div">
                                      {formatDate(application.start_date)}
                                    </Typography>
                                    <Typography variant="body2" component="div" color="text.secondary">
                                      {application.start_session === 'AM'
                                        ? t('leaveApplication.sessionAM')
                                        : t('leaveApplication.sessionPM')}
                                    </Typography>
                                  </Box>
                                ) : (
                                  formatDate(application.start_date)
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top' }}>
                              {application.end_date ? (
                                application.end_session ? (
                                  <Box>
                                    <Typography variant="body2" component="div">
                                      {formatDate(application.end_date)}
                                    </Typography>
                                    <Typography variant="body2" component="div" color="text.secondary">
                                      {application.end_session === 'AM'
                                        ? t('leaveApplication.sessionAM')
                                        : t('leaveApplication.sessionPM')}
                                    </Typography>
                                  </Box>
                                ) : (
                                  formatDate(application.end_date)
                                )
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                              <Box>
                                <Typography
                                  variant="body2"
                                  component="div"
                                  sx={{
                                    fontWeight: 700,
                                    color: '#8B1532',
                                    fontSize: '1rem',
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {application.days}
                                </Typography>
                                {showLeaveBalanceRow && (
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                      {t('approvalDetail.remainingBalance')}:{' '}
                                      {parseFloat(application.leave_balance.balance || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                      {t('approvalDetail.totalBalance')}:{' '}
                                      {parseFloat(application.leave_balance.total || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" component="div">
                                      {t('approvalDetail.usedBalance')}:{' '}
                                      {parseFloat(application.leave_balance.taken || 0).toFixed(2)}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </ListItem>
                </>
              )}
              {applicationType !== 'extra_working_hours' && application.reason && (
                <ListItem>
                  <ListItemText
                    primary={t('approvalDetail.reason')}
                    secondary={application.reason}
                    primaryTypographyProps={{ variant: 'caption' }}
                    secondaryTypographyProps={{ variant: 'body1' }}
                  />
                </ListItem>
              )}
              <ListItem>
                <ListItemText 
                  primary={t('approvalDetail.status')}
                  secondary={
                    <Chip
                      label={application.status === 'pending' ? t('approvalDetail.pending') : application.status === 'approved' ? t('approvalDetail.approved') : t('approvalDetail.rejected')}
                      color={application.status === 'pending' ? 'warning' : application.status === 'approved' ? 'success' : 'error'}
                      size="small"
                    />
                  }
                  primaryTypographyProps={{ variant: 'caption' }}
                  secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                />
              </ListItem>
            </List>

            {(applicationType !== 'extra_working_hours' && applicationType !== 'outdoor_work') && (documents.length > 0 || canManageLeaveAttachments) && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6">
                    {t('approvalDetail.attachments')}
                  </Typography>
                  {canManageLeaveAttachments && (
                    <Box>
                      <input
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif"
                        style={{ display: 'none' }}
                        id="leave-attachment-upload"
                        multiple
                        type="file"
                        onChange={handleUploadDocuments}
                        disabled={uploadingDocument}
                      />
                      <label htmlFor="leave-attachment-upload">
                        <Button
                          variant="outlined"
                          component="span"
                          size="small"
                          startIcon={uploadingDocument ? <CircularProgress size={16} /> : <UploadIcon />}
                          disabled={uploadingDocument}
                        >
                          {uploadingDocument ? t('approvalDetail.uploading') : t('approvalDetail.uploadFile')}
                        </Button>
                      </label>
                    </Box>
                  )}
                </Box>
                {canManageLeaveAttachments && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('approvalDetail.supportedFormats')}
                  </Typography>
                )}
                {documents.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('approvalDetail.noFiles')}
                  </Typography>
                ) : (
                  <List dense>
                    {documents.map((doc) => (
                      <ListItem
                        key={doc.id}
                        secondaryAction={
                          <Box sx={{ display: 'flex' }}>
                            <IconButton
                              edge="end"
                              aria-label={t('approvalDetail.view')}
                              onClick={async () => {
                                await handleOpenFile(doc);
                              }}
                            >
                              <VisibilityIcon />
                            </IconButton>
                            {canManageLeaveAttachments && (
                              <IconButton
                                edge="end"
                                aria-label={t('approvalDetail.deleteFile')}
                                onClick={() => handleDeleteDocument(doc.id)}
                                disabled={deletingDocumentId === doc.id}
                                color="error"
                              >
                                {deletingDocumentId === doc.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                              </IconButton>
                            )}
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: canManageLeaveAttachments ? 8 : 4 }}>
                              {getFileIcon(doc.file_type, doc.file_name)}
                              <Link
                                component="button"
                                variant="body2"
                                onClick={async () => {
                                  await handleOpenFile(doc);
                                }}
                                sx={{ textDecoration: 'none', cursor: 'pointer', textAlign: 'left' }}
                              >
                                {doc.file_name}
                              </Link>
                            </Box>
                          }
                          secondary={doc.file_size ? formatFileSize(doc.file_size) : ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </>
            )}

            {application.reversal_transactions && application.reversal_transactions.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {t('approvalDetail.relatedReversalTransactions')}
                </Typography>
                <List>
                  {application.reversal_transactions.map((reversal) => (
                    <ListItem key={reversal.id}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={t('approvalDetail.reversal')}
                              color="info"
                              size="small"
                            />
                            <Typography variant="body1" component="span">
                              {t('approvalDetail.transactionIdLabel')}{reversal.transaction_id}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.applicantLabel')}{reversal.applicant_display_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.leaveTypeLabel')}{i18n.language === 'en' 
                                ? (reversal.leave_type_name || reversal.leave_type_name_zh || '')
                                : (reversal.leave_type_name_zh || reversal.leave_type_name || '')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.yearLabel')}{reversal.year || (reversal.start_date ? new Date(reversal.start_date).getFullYear() : '-')}{t('approvalDetail.yearSuffix')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.dateLabel')}{formatDate(reversal.start_date)} ~ {formatDate(reversal.end_date)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.daysLabel')}{Math.abs(reversal.days)} {t('approvalDetail.days')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t('approvalDetail.statusLabel')}
                              <Chip
                                label={reversal.status === 'approved' ? t('approvalDetail.approved') : reversal.status === 'pending' ? t('approvalDetail.pending') : reversal.status === 'rejected' ? t('approvalDetail.rejected') : reversal.status}
                                color={reversal.status === 'approved' ? 'success' : reversal.status === 'pending' ? 'warning' : reversal.status === 'rejected' ? 'error' : 'default'}
                                size="small"
                                sx={{ ml: 1 }}
                              />
                            </Typography>
                            {reversal.created_at && (
                              <Typography variant="body2" color="text.secondary">
                                {t('approvalDetail.createdAt')}{formatDateTime(reversal.created_at)}
                              </Typography>
                            )}
                          </Box>
                        }
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Paper>
          {timelineEvents.length > 0 && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" gutterBottom>{t('approvalDetail.actionHistory')}</Typography>
              <Box>
                {timelineEvents.map((item, index) => {
                  const appearance = {
                    submitted: { color: 'primary.main', Icon: SendIcon, title: t('approvalDetail.actionSubmitted') },
                    approved: {
                      color: 'success.main',
                      Icon: CheckCircleIcon,
                      title: item.from_stage
                        ? `${t('approvalDetail.actionApproved')} · ${stageLabel(item.from_stage)}`
                        : t('approvalDetail.actionApproved')
                    },
                    rejected: {
                      color: 'error.main',
                      Icon: CancelIcon,
                      title: item.from_stage
                        ? `${t('approvalDetail.actionRejected')} · ${stageLabel(item.from_stage)}`
                        : t('approvalDetail.actionRejected')
                    },
                    withdrawn: { color: 'warning.main', Icon: UndoIcon, title: t('approvalDetail.withdraw') },
                    returned: {
                      color: 'warning.main',
                      Icon: ReplyIcon,
                      title: `${t('approvalDetail.returnTo')} ${stageLabel(item.to_stage)}`
                    },
                    resubmitted: { color: 'info.main', Icon: RefreshIcon, title: t('approvalDetail.resubmit') }
                  }[item.action] || { color: 'text.secondary', Icon: SendIcon, title: item.action };
                  const EventIcon = appearance.Icon;
                  const isLast = index === timelineEvents.length - 1;
                  const reasonIsNegative = item.action === 'rejected' || item.action === 'returned' || item.action === 'withdrawn';
                  const followUp = item.action === 'approved' && item.to_stage
                    ? (item.to_stage === 'completed'
                      ? t('approvalDetail.actionCompleted')
                      : t('approvalDetail.actionHandedTo', { stage: stageLabel(item.to_stage) }))
                    : null;

                  return (
                    <Box key={item.id} sx={{ display: 'flex', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
                        <Box sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          bgcolor: appearance.color,
                          color: 'common.white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <EventIcon sx={{ fontSize: 16 }} />
                        </Box>
                        {!isLast && <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'divider', my: 0.5 }} />}
                      </Box>
                      <Box sx={{ flex: 1, pb: isLast ? 0 : 2, pt: 0.25 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                          {appearance.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {[item.actor_display_name, item.created_at ? formatDateTime(item.created_at) : null].filter(Boolean).join(' · ') || '-'}
                        </Typography>
                        {followUp && (
                          <Typography variant="body2" color="text.secondary">{followUp}</Typography>
                        )}
                        {item.recovered && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {t('approvalDetail.actionTimeNotKept')}
                          </Typography>
                        )}
                        {item.reason && (
                          <Typography
                            variant="body2"
                            sx={{
                              mt: 0.5,
                              fontWeight: reasonIsNegative ? 700 : 500,
                              color: reasonIsNegative ? 'error.main' : 'text.primary',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {item.reason}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Grid>

        <Grid item xs={12} md={4}>
        {((canApproveThis && application.status === 'pending') || workflow?.can_withdraw || workflow?.can_return || workflow?.can_resubmit) && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('approvalDetail.approvalAction')}
                </Typography>
                {(canApproveThis || workflow?.can_return) && application.status === 'pending' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('approvalDetail.approvalStage')}：{displayText}
                  </Typography>
                )}

                {(action === 'return' || action === 'withdraw') ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={action === 'return' ? t('approvalDetail.returnReason') : t('approvalDetail.withdrawReason')}
                    value={workflowReason}
                    onChange={(e) => setWorkflowReason(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                ) : canApproveThis && application.status === 'pending' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={t('approvalDetail.approvalComment')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {canApproveThis && application.status === 'pending' && (
                    <Button
                      variant={action === 'approve' ? 'contained' : 'outlined'}
                      color="success"
                      onClick={() => setAction('approve')}
                      fullWidth
                      sx={{ flex: '1 1 45%' }}
                    >
                      {t('approvalDetail.approve')}
                    </Button>
                  )}
                  {canRejectThis && application.status === 'pending' && (
                    <Button
                      variant={action === 'reject' ? 'contained' : 'outlined'}
                      color="error"
                      onClick={() => setAction('reject')}
                      fullWidth
                      sx={{ flex: '1 1 45%' }}
                    >
                      {t('approvalDetail.reject')}
                    </Button>
                  )}
                  {(workflow?.can_withdraw || workflow?.can_return) && (
                    <Button
                      variant={action === 'return' || action === 'withdraw' ? 'contained' : 'outlined'}
                      color="warning"
                      onClick={() => setAction(workflow.can_return ? 'return' : 'withdraw')}
                      disabled={workflowActing}
                      fullWidth
                      sx={{ flex: '1 1 100%' }}
                    >
                      {t('approvalDetail.workflowAction')}
                    </Button>
                  )}
                </Box>

                {action === 'return' && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>{t('approvalDetail.returnTo')}</InputLabel>
                    <Select
                      value={returnStage}
                      label={t('approvalDetail.returnTo')}
                      onChange={(e) => setReturnStage(e.target.value)}
                    >
                      {(workflow?.return_targets || []).map((target) => (
                        <MenuItem key={target.stage} value={target.stage}>
                          {stageLabel(target.stage)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {((canApproveThis && application.status === 'pending') || workflow?.can_withdraw || workflow?.can_return) && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                      if (action === 'return') handleReturnApplication();
                      else if (action === 'withdraw') handleWithdraw();
                      else handleSubmit();
                    }}
                    disabled={approving || workflowActing || !action}
                    sx={{
                      mb: workflow?.can_resubmit ? 1 : 0,
                      opacity: !action ? 0.5 : 1,
                      cursor: !action ? 'not-allowed' : 'pointer',
                      '&:disabled': {
                        backgroundColor: 'rgba(0, 0, 0, 0.12)',
                        color: 'rgba(0, 0, 0, 0.26)'
                      }
                    }}
                  >
                    {(approving || workflowActing)
                      ? t('approvalDetail.processing')
                      : !action
                        ? t('approvalDetail.selectAction')
                        : t('approvalDetail.submit')}
                  </Button>
                )}

                {workflow?.can_resubmit && applicationType === 'leave' && (
                  <Button fullWidth color="primary" variant="contained" disabled={workflowActing} onClick={() => setReviseDialogOpen(true)}>
                    {t('approvalDetail.reviseAndResubmit')}
                  </Button>
                )}
                {workflow?.can_resubmit && applicationType !== 'leave' && (
                  <Button fullWidth color="primary" variant="contained" disabled={workflowActing} onClick={handleResubmit}>
                    {t('approvalDetail.resubmit')}
                  </Button>
                )}
              </CardContent>
            </Card>
        )}

        {user?.is_hr_member && 
         application?.status === 'pending' && 
         currentStage !== 'completed' && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('approvalDetail.hrRejectionAction')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('approvalDetail.currentStage')}：{displayText}
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label={t('approvalDetail.rejectionReason')}
                  value={hrRejectionReason}
                  onChange={(e) => setHrRejectionReason(e.target.value)}
                  placeholder={t('approvalDetail.rejectionReasonPlaceholder')}
                  sx={{ mb: 2 }}
                />

                <Button
                  variant="contained"
                  color="error"
                  fullWidth
                  onClick={handleHRReject}
                  disabled={hrRejecting}
                  sx={{
                    '&:disabled': {
                      backgroundColor: 'rgba(0, 0, 0, 0.12)',
                      color: 'rgba(0, 0, 0, 0.26)'
                    }
                  }}
                >
                  {hrRejecting ? t('approvalDetail.processing') : t('approvalDetail.rejectApplication')}
                </Button>
              </CardContent>
            </Card>
        )}
        </Grid>
      </Grid>

      <Dialog
        open={reviseDialogOpen}
        onClose={() => {
          if (!workflowActing) setReviseDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        disableRestoreFocus
      >
        <DialogTitle>{t('approvalDetail.reviseAndResubmit')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('approvalDetail.reviseHint')}
          </Typography>
          {reviseForm && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <FormControl fullWidth>
                <InputLabel>{t('approvalDetail.leaveType')}</InputLabel>
                <Select
                  value={reviseForm.leave_type_id}
                  label={t('approvalDetail.leaveType')}
                  onChange={(e) => setReviseForm((prev) => ({ ...prev, leave_type_id: e.target.value }))}
                >
                  {(Array.isArray(leaveTypes) ? leaveTypes : []).map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {i18n.language === 'en' ? (type.name || type.name_zh) : (type.name_zh || type.name)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <YearSelector
                value={reviseForm.year}
                onChange={(year) => {
                  setReviseYearManual(true);
                  setReviseForm((prev) => ({ ...prev, year: Number(year) }));
                }}
                labelKey="leaveApplication.year"
                suffix={t('leaveApplication.yearSuffix')}
                fullWidth
                required
              />
              <TextField
                type="date"
                label={t('approvalDetail.startDate')}
                value={toHKCalendarDate(reviseForm.start_date) || ''}
                onChange={(e) => setReviseForm((prev) => ({ ...prev, start_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth>
                <InputLabel>{t('approvalDetail.startSession')}</InputLabel>
                <Select
                  value={reviseForm.start_session}
                  label={t('approvalDetail.startSession')}
                  onChange={(e) => setReviseForm((prev) => ({ ...prev, start_session: e.target.value }))}
                >
                  <MenuItem value="AM">{t('approvalDetail.am')}</MenuItem>
                  <MenuItem value="PM">{t('approvalDetail.pm')}</MenuItem>
                </Select>
              </FormControl>
              <TextField
                type="date"
                label={t('approvalDetail.endDate')}
                value={toHKCalendarDate(reviseForm.end_date) || ''}
                onChange={(e) => setReviseForm((prev) => ({ ...prev, end_date: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: reviseForm.start_date || undefined }}
              />
              <FormControl fullWidth>
                <InputLabel>{t('approvalDetail.endSession')}</InputLabel>
                <Select
                  value={reviseForm.end_session}
                  label={t('approvalDetail.endSession')}
                  onChange={(e) => setReviseForm((prev) => ({ ...prev, end_session: e.target.value }))}
                >
                  <MenuItem value="AM">{t('approvalDetail.am')}</MenuItem>
                  <MenuItem value="PM">{t('approvalDetail.pm')}</MenuItem>
                </Select>
              </FormControl>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={reviseIncludeWeekends}
                      onChange={(e) => setReviseIncludeWeekends(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={t('leaveApplication.includeWeekends')}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {reviseIncludeWeekends
                    ? t('leaveApplication.includeWeekendsDescription1')
                    : t('leaveApplication.includeWeekendsDescription2')}
                </Typography>
              </Box>
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!reviseForm.exclude_public_holidays}
                      onChange={(e) => setReviseForm((prev) => ({ ...prev, exclude_public_holidays: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label={t('leaveApplication.excludePublicHolidays')}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {reviseForm.exclude_public_holidays
                    ? t('leaveApplication.excludePublicHolidaysDescription1')
                    : t('leaveApplication.excludePublicHolidaysDescription2')}
                </Typography>
              </Box>
              <TextField
                type="number"
                label={t('approvalDetail.days')}
                value={reviseForm.total_days}
                disabled
                inputProps={{ min: 0.5, step: 0.5 }}
              />
              <TextField
                multiline
                rows={3}
                label={t('approvalDetail.reason')}
                value={reviseForm.reason}
                onChange={(e) => setReviseForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
              <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500, whiteSpace: 'pre-line' }}>
                {t('leaveApplication.documentRequirementNotice')}
              </Typography>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t('leaveApplication.attachFilesTitle')}
                </Typography>
                {documents.length > 0 && (
                  <List dense>
                    {documents.map((doc) => (
                      <ListItem key={doc.id} disablePadding>
                        <ListItemText
                          primary={doc.file_name}
                          secondary={doc.file_size ? formatFileSize(doc.file_size) : ''}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Button variant="outlined" component="label" startIcon={<AttachFileIcon />} disabled={workflowActing}>
                    {t('leaveApplication.selectFile')}
                    <input
                      type="file"
                      hidden
                      multiple
                      accept=".pdf,.jpeg,.jpg,.png,.gif,.bmp,.webp,.tiff,.tif,image/*"
                      onChange={handleReviseFileChange}
                    />
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CameraIcon />}
                    onClick={handleReviseCameraCapture}
                    disabled={workflowActing}
                  >
                    {t('leaveApplication.takePhoto')}
                  </Button>
                </Box>
                {reviseFiles.length > 0 && (
                  <List dense>
                    {reviseFiles.map((file, index) => (
                      <ListItem
                        key={`${file.name}-${index}`}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            aria-label={t('leaveApplication.removeFileLabel')}
                            onClick={() => setReviseFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                            disabled={workflowActing}
                          >
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText primary={file.name} secondary={formatFileSize(file.size)} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setReviseDialogOpen(false)} disabled={workflowActing}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleResubmit} disabled={workflowActing || !reviseForm}>
            {workflowActing ? t('approvalDetail.processing') : t('approvalDetail.reviseAndResubmit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 文件查看 Dialog */}
      <Dialog
        open={fileDialogOpen}
        onClose={handleCloseFileDialog}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile} // 手機上全屏顯示
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {viewingFile?.file_name || t('approvalDetail.viewFile')}
            </Typography>
            <IconButton onClick={handleCloseFileDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingFile ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                {t('common.loading')}
              </Typography>
            </Box>
          ) : fileBlobUrl && viewingFile ? (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {viewingFile.file_type?.startsWith('image/') ? (
                <Box
                  sx={{
                    width: '100%',
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: isImagePanning ? 'grabbing' : 'grab',
                    userSelect: 'none',
                  }}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY;
                    const factor = delta < 0 ? 1.1 : 0.9;
                    setImageZoom((z) => Math.min(5, Math.max(0.5, z * factor)));
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setIsImagePanning(true);
                    imagePanStartRef.current = {
                      x: e.clientX,
                      y: e.clientY,
                      panX: imagePan.x,
                      panY: imagePan.y,
                    };
                  }}
                  onMouseMove={(e) => {
                    if (!isImagePanning || !imagePanStartRef.current) return;
                    const dx = e.clientX - imagePanStartRef.current.x;
                    const dy = e.clientY - imagePanStartRef.current.y;
                    setImagePan({ x: imagePanStartRef.current.panX + dx, y: imagePanStartRef.current.panY + dy });
                  }}
                  onMouseUp={() => {
                    setIsImagePanning(false);
                    imagePanStartRef.current = null;
                  }}
                  onMouseLeave={() => {
                    setIsImagePanning(false);
                    imagePanStartRef.current = null;
                  }}
                  onDoubleClick={() => resetImageTransform()}
                >
                  <img
                    src={fileBlobUrl}
                    alt={viewingFile.file_name}
                    draggable={false}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '80vh',
                      objectFit: 'contain',
                      transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
                      transformOrigin: 'center center',
                      transition: isImagePanning ? 'none' : 'transform 80ms linear',
                    }}
                  />
                </Box>
              ) : viewingFile.file_type === 'application/pdf' || viewingFile.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={fileBlobUrl}
                  title={viewingFile.file_name}
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: 'none'
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="body1" gutterBottom>
                    無法在瀏覽器中預覽此文件類型
                  </Typography>
                  <Button
                    variant="contained"
                    component="a"
                    href={fileBlobUrl}
                    download={viewingFile.file_name}
                    sx={{ mt: 2 }}
                  >
                    <GetAppIcon sx={{ mr: 1 }} />
                    下載文件
                  </Button>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          {fileBlobUrl && !viewingFile?.file_type?.startsWith('image/') && viewingFile?.file_type !== 'application/pdf' && !viewingFile?.file_name?.toLowerCase().endsWith('.pdf') && (
            <Button
              component="a"
              href={fileBlobUrl}
              download={viewingFile?.file_name}
              variant="contained"
              startIcon={<GetAppIcon />}
            >
              下載
            </Button>
          )}
          <Button onClick={handleCloseFileDialog} variant="outlined">
            關閉
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ApprovalDetail;

