import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  PushPin as PushPinIcon,
  AttachFile as AttachFileIcon,
  DeleteOutline as DeleteOutlineIcon,
  GetApp as GetAppIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormat';
import Swal from 'sweetalert2';

const Announcements = () => {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_pinned: false
  });
  const [uploading, setUploading] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/announcements');
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Fetch announcements error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.fetchError'),
        text: error.response?.data?.message || t('announcements.fetchError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setEditingAnnouncement(null);
    setSelectedFiles([]);
    setFormData({
      title: '',
      content: '',
      is_pinned: false
    });
    setOpen(true);
  };

  const handleEdit = (announcement) => {
    setEditingAnnouncement(announcement);
    setSelectedFiles([]);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      is_pinned: announcement.is_pinned
    });
    setEditOpen(true);
  };

  const handleView = async (announcement) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/announcements/${announcement.id}`);
      setViewingAnnouncement(response.data.announcement);
      setDetailOpen(true);
    } catch (error) {
      console.error('Fetch announcement detail error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.fetchDetailError'),
        text: error.response?.data?.message || t('announcements.fetchDetailError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      // 檢查文件大小（每個文件最大10MB）
      const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        Swal.fire({
          icon: 'warning',
          title: t('announcements.fileSizeExceeded'),
          confirmButtonText: t('common.confirm'),
          confirmButtonColor: '#3085d6'
        });
        e.target.value = '';
        return;
      }
      
      setSelectedFiles(files);
    }
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!formData.title || formData.title.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('announcements.pleaseEnterTitle'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    if (!formData.content || formData.content.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('announcements.pleaseEnterContent'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    try {
      setUploading(true);

      const uploadFormData = new FormData();
      uploadFormData.append('title', formData.title.trim());
      uploadFormData.append('content', formData.content.trim());
      uploadFormData.append('is_pinned', formData.is_pinned ? 'true' : 'false');
      
      if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
          uploadFormData.append('files', file);
        });
      }

      await axios.post('/api/announcements', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // 先重置狀態，再顯示成功提示並關閉 modal
      setUploading(false);
      setSelectedFiles([]);
      setFormData({
        title: '',
        content: '',
        is_pinned: false
      });
      setOpen(false);
      
      await Swal.fire({
        icon: 'success',
        title: t('announcements.createSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      fetchAnnouncements();
    } catch (error) {
      console.error('Create announcement error:', error);
      setUploading(false);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.createError'),
        text: error.response?.data?.message || t('announcements.createError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleUpdate = async () => {
    if (!formData.title || formData.title.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('announcements.pleaseEnterTitle'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    if (!formData.content || formData.content.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('announcements.pleaseEnterContent'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    try {
      setUploading(true);

      await axios.put(`/api/announcements/${editingAnnouncement.id}`, {
        title: formData.title.trim(),
        content: formData.content.trim(),
        is_pinned: formData.is_pinned
      });

      // 先重置狀態，再顯示成功提示並關閉 modal
      setUploading(false);
      setEditOpen(false);
      
      await Swal.fire({
        icon: 'success',
        title: t('announcements.updateSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      fetchAnnouncements();
    } catch (error) {
      console.error('Update announcement error:', error);
      setUploading(false);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.updateError'),
        text: error.response?.data?.message || t('announcements.updateError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleDelete = async (announcementId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('announcements.confirmDelete'),
      text: t('announcements.confirmDeleteMessage'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/announcements/${announcementId}`);
      
      await Swal.fire({
        icon: 'success',
        title: t('announcements.deleteSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });

      fetchAnnouncements();
    } catch (error) {
      console.error('Delete announcement error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.deleteError'),
        text: error.response?.data?.message || t('announcements.deleteError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAttachments = async (announcementId) => {
    if (selectedFiles.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: t('announcements.pleaseSelectFiles'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    try {
      setUploading(true);

      const uploadFormData = new FormData();
      selectedFiles.forEach(file => {
        uploadFormData.append('files', file);
      });

      await axios.post(`/api/announcements/${announcementId}/attachments`, uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploading(false);
      setSelectedFiles([]);
      
      await Swal.fire({
        icon: 'success',
        title: t('announcements.uploadAttachmentSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      // 重新獲取公告詳情
      if (viewingAnnouncement) {
        const response = await axios.get(`/api/announcements/${announcementId}`);
        setViewingAnnouncement(response.data.announcement);
      }
      fetchAnnouncements();
    } catch (error) {
      console.error('Upload attachment error:', error);
      setUploading(false);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.uploadAttachmentError'),
        text: error.response?.data?.message || t('announcements.uploadAttachmentError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleDeleteAttachment = async (attachmentId, announcementId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('announcements.confirmDeleteAttachment'),
      text: t('announcements.confirmDeleteAttachmentMessage'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/announcements/attachments/${attachmentId}`);
      
      await Swal.fire({
        icon: 'success',
        title: t('announcements.deleteAttachmentSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });

      // 重新獲取公告詳情
      if (viewingAnnouncement) {
        const response = await axios.get(`/api/announcements/${announcementId}`);
        setViewingAnnouncement(response.data.announcement);
      }
      fetchAnnouncements();
    } catch (error) {
      console.error('Delete attachment error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.deleteAttachmentError'),
        text: error.response?.data?.message || t('announcements.deleteAttachmentError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (attachment) => {
    try {
      setLoadingFile(true);
      setViewingFile(attachment);
      setFileDialogOpen(true);

      const isImage = attachment.file_type && attachment.file_type.startsWith('image/');
      const isPDF = attachment.file_type === 'application/pdf' || attachment.file_name?.toLowerCase().endsWith('.pdf');
      const url = `/api/announcements/attachments/${attachment.id}/download${isImage || isPDF ? '?view=true' : ''}`;
      
      // 使用 axios 下載文件，確保認證 header 被包含
      const response = await axios.get(url, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // 從響應中獲取正確的 MIME 類型
      const contentType = response.headers['content-type'] || attachment.file_type || 'application/octet-stream';
      
      // 創建 blob URL（使用正確的 MIME 類型）
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);
      setFileBlobUrl(blobUrl);
    } catch (error) {
      console.error('Open file error:', error);
      setFileDialogOpen(false);
      setViewingFile(null);
      
      let errorMessage = t('announcements.cannotOpenFile');
      if (error.response?.status === 403 || error.response?.status === 401) {
        errorMessage = t('announcements.noPermissionFile');
      }
      
      await Swal.fire({
        icon: 'error',
        title: t('announcements.cannotOpenFile'),
        text: errorMessage,
        confirmButtonText: t('common.confirm'),
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
    setFileDialogOpen(false);
    setViewingFile(null);
  };

  const handleDownloadAttachment = async (attachmentId, fileName) => {
    try {
      const response = await axios.get(`/api/announcements/attachments/${attachmentId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      // 清理 blob URL
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download attachment error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('announcements.downloadAttachmentError'),
        text: error.response?.data?.message || t('announcements.downloadAttachmentError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
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

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1200px', mx: 'auto' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2
      }}>
        <Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontSize: { xs: '1.5rem', sm: '2rem' }, 
              fontWeight: 600,
              color: 'primary.main'
            }}
          >
            {t('announcements.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('announcements.description')}
          </Typography>
        </Box>
        {isSystemAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpen}
            sx={{
              borderRadius: 1,
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              },
              width: { xs: '100%', sm: 'auto' }
            }}
          >
            {t('announcements.createAnnouncement')}
          </Button>
        )}
      </Box>

      {/* 公告列表 */}
      {loading && announcements.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress />
        </Paper>
      ) : announcements.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('announcements.noAnnouncements')}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {announcements.map((announcement) => (
            <Paper 
              key={announcement.id}
              elevation={announcement.is_pinned ? 4 : 2}
              sx={{ 
                p: { xs: 2, sm: 3 },
                borderRadius: 2,
                borderLeft: announcement.is_pinned ? 4 : 0,
                borderColor: announcement.is_pinned ? 'primary.main' : 'transparent',
                '&:hover': { 
                  boxShadow: 4
                }
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {announcement.is_pinned && (
                      <PushPinIcon color="primary" fontSize="small" />
                    )}
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {announcement.title}
                    </Typography>
                  </Box>
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      mb: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {announcement.content}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('announcements.createdBy')}: {announcement.creator_display_name || announcement.creator_email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('announcements.createdAt')}: {formatDate(announcement.created_at)}
                    </Typography>
                    {announcement.attachment_count > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {t('announcements.attachmentsCount', { count: announcement.attachment_count })}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
                  <Tooltip title={t('announcements.viewDetails')}>
                    <IconButton
                      size="small"
                      onClick={() => handleView(announcement)}
                      sx={{ 
                        color: 'primary.main',
                        '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                      }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {isSystemAdmin && (
                    <>
                      <Tooltip title={t('announcements.edit')}>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(announcement)}
                          sx={{ 
                            color: 'info.main',
                            '&:hover': { backgroundColor: 'info.light', color: 'white' }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('announcements.delete')}>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(announcement.id)}
                          sx={{ 
                            color: 'error.main',
                            '&:hover': { backgroundColor: 'error.light', color: 'white' }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* 創建公告對話框 */}
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', fontWeight: 600 }}>
          {t('announcements.createDialogTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('announcements.titleLabel')}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              required
              autoFocus
            />

            <TextField
              label={t('announcements.contentLabel')}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              fullWidth
              required
              multiline
              rows={6}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                />
              }
              label={t('announcements.pinAnnouncement')}
            />

            <Box>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFileIcon />}
                fullWidth
                sx={{ py: 1.5 }}
              >
                {t('announcements.selectFiles')}
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.jpeg,.jpg,.png,.gif,.bmp,.webp,.tiff,.tif,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileChange}
                />
              </Button>
              {selectedFiles.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('announcements.selectedFiles', { count: selectedFiles.length })}
                  </Typography>
                  <List dense>
                    {selectedFiles.map((file, index) => (
                      <ListItem key={index} sx={{ px: 0 }}>
                        <ListItemText 
                          primary={file.name}
                          secondary={formatFileSize(file.size)}
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => setOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={uploading || !formData.title || !formData.content}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {uploading ? <CircularProgress size={20} /> : t('common.submit')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編輯公告對話框 */}
      <Dialog 
        open={editOpen} 
        onClose={() => setEditOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', fontWeight: 600 }}>
          {t('announcements.editDialogTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('announcements.titleLabel')}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              required
              autoFocus
            />

            <TextField
              label={t('announcements.contentLabel')}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              fullWidth
              required
              multiline
              rows={6}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_pinned: e.target.checked }))}
                />
              }
              label={t('announcements.pinAnnouncement')}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => setEditOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleUpdate}
            variant="contained"
            disabled={uploading || !formData.title || !formData.content}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {uploading ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 查看詳情對話框 */}
      <Dialog 
        open={detailOpen} 
        onClose={() => setDetailOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: 1, borderColor: 'divider', fontWeight: 600 }}>
          {viewingAnnouncement?.title}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
          {viewingAnnouncement && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {viewingAnnouncement.is_pinned && (
                  <PushPinIcon color="primary" fontSize="small" />
                )}
                <Typography variant="body2" color="text.secondary">
                  {t('announcements.createdBy')}: {viewingAnnouncement.creator_display_name || viewingAnnouncement.creator_email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('announcements.createdAt')}: {formatDate(viewingAnnouncement.created_at)}
                </Typography>
              </Box>

              <Divider />

              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {viewingAnnouncement.content}
              </Typography>

              {viewingAnnouncement.attachments && viewingAnnouncement.attachments.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {t('announcements.attachments')}
                    </Typography>
                    <List>
                      {viewingAnnouncement.attachments.map((attachment) => (
                        <ListItem key={attachment.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                            {getFileIcon(attachment.file_type, attachment.file_name)}
                            <ListItemText
                              primary={attachment.file_name}
                              secondary={formatFileSize(attachment.file_size)}
                            />
                          </Box>
                          <ListItemSecondaryAction>
                            <Tooltip title={t('announcements.view')}>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => handleOpenFile(attachment)}
                                sx={{ mr: 1 }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('announcements.download')}>
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={() => handleDownloadAttachment(attachment.id, attachment.file_name)}
                                sx={{ mr: 1 }}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isSystemAdmin && (
                              <Tooltip title={t('announcements.delete')}>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => handleDeleteAttachment(attachment.id, viewingAnnouncement.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </>
              )}

              {isSystemAdmin && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {t('announcements.addAttachments')}
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<AttachFileIcon />}
                      fullWidth
                      sx={{ mb: 1 }}
                    >
                      {t('announcements.selectFiles')}
                      <input
                        type="file"
                        hidden
                        multiple
                        accept=".pdf,.jpeg,.jpg,.png,.gif,.bmp,.webp,.tiff,.tif,.doc,.docx,.xls,.xlsx,.txt"
                        onChange={handleFileChange}
                      />
                    </Button>
                    {selectedFiles.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <List dense>
                          {selectedFiles.map((file, index) => (
                            <ListItem key={index} sx={{ px: 0 }}>
                              <ListItemText 
                                primary={file.name}
                                secondary={formatFileSize(file.size)}
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  size="small"
                                  onClick={() => handleRemoveFile(index)}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                        <Button
                          variant="contained"
                          onClick={() => handleUploadAttachments(viewingAnnouncement.id)}
                          disabled={uploading}
                          fullWidth
                        >
                          {uploading ? <CircularProgress size={20} /> : t('announcements.uploadFiles')}
                        </Button>
                      </Box>
                    )}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={() => {
              setDetailOpen(false);
              setViewingAnnouncement(null);
              setSelectedFiles([]);
            }}
            sx={{ textTransform: 'none' }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 文件預覽 Dialog */}
      <Dialog
        open={fileDialogOpen}
        onClose={handleCloseFileDialog}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {viewingFile?.file_name || t('announcements.viewFile')}
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
                <img
                  src={fileBlobUrl}
                  alt={viewingFile.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
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
                    {t('announcements.cannotPreviewFileType')}
                  </Typography>
                  <Button
                    variant="contained"
                    component="a"
                    href={fileBlobUrl}
                    download={viewingFile.file_name}
                    startIcon={<GetAppIcon />}
                    sx={{ mt: 2 }}
                  >
                    {t('announcements.download')}
                  </Button>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: 1, borderColor: 'divider' }}>
          {fileBlobUrl && (
            <Button
              component="a"
              href={fileBlobUrl}
              download={viewingFile?.file_name}
              variant="contained"
              startIcon={<GetAppIcon />}
              sx={{ textTransform: 'none' }}
            >
              {t('announcements.download')}
            </Button>
          )}
          <Button 
            onClick={handleCloseFileDialog} 
            variant="outlined"
            sx={{ textTransform: 'none' }}
          >
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Announcements;

