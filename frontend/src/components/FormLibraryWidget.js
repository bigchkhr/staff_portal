import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Tooltip,
  Chip,
  FormControlLabel,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Pagination,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const emptyForm = {
  display_name: '',
  description: '',
  visible_to_users: true
};

const FormLibraryWidget = () => {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [viewingForm, setViewingForm] = useState(null);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  useEffect(() => {
    fetchForms();
  }, []);

  useEffect(() => {
    return () => {
      if (fileBlobUrl) {
        window.URL.revokeObjectURL(fileBlobUrl);
      }
    };
  }, [fileBlobUrl]);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/form-library/all');
      setForms(response.data.forms || []);
    } catch (error) {
      console.error('Fetch forms error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const handleOpenUpload = () => {
    setSelectedFile(null);
    setFormData(emptyForm);
    setUploadOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('formLibrary.fileSizeExceeded'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    setFormData((prev) => ({
      ...prev,
      display_name: prev.display_name || file.name.replace(/\.[^/.]+$/, '')
    }));
  };

  const handleUpload = async () => {
    if (saving) return;
    if (!selectedFile) {
      await Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('formLibrary.pleaseSelectFile'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      return;
    }
    if (!formData.display_name || formData.display_name.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('formLibrary.pleaseEnterDisplayName'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      return;
    }

    try {
      setSaving(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('display_name', formData.display_name.trim());
      uploadFormData.append('visible_to_users', formData.visible_to_users);
      if (formData.description) {
        uploadFormData.append('description', formData.description.trim());
      }
      await axios.post('/api/form-library/upload', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadOpen(false);
      setSelectedFile(null);
      setFormData(emptyForm);
      await fetchForms();
      await Swal.fire({
        icon: 'success',
        title: t('dashboard.news.success'),
        text: t('formLibrary.uploadSuccess'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Upload error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('formLibrary.uploadError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (form) => {
    setEditingForm(form);
    setFormData({
      display_name: form.display_name || '',
      description: form.description || '',
      visible_to_users: form.visible_to_users !== false
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (saving || !editingForm) return;
    if (!formData.display_name || formData.display_name.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('formLibrary.pleaseEnterDisplayName'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      return;
    }

    try {
      setSaving(true);
      await axios.put(`/api/form-library/${editingForm.id}`, {
        display_name: formData.display_name.trim(),
        description: formData.description ? formData.description.trim() : null,
        visible_to_users: formData.visible_to_users
      });
      setEditOpen(false);
      setEditingForm(null);
      await fetchForms();
      await Swal.fire({
        icon: 'success',
        title: t('dashboard.news.success'),
        text: t('formLibrary.updateSuccess'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Update error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('formLibrary.updateError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event, formId) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('dashboard.news.confirmDelete'),
      text: t('formLibrary.confirmDelete'),
      showCancelButton: true,
      confirmButtonText: t('dashboard.news.confirm'),
      cancelButtonText: t('dashboard.news.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/form-library/${formId}`);
      await fetchForms();
      await Swal.fire({
        icon: 'success',
        title: t('dashboard.news.success'),
        text: t('formLibrary.deleteSuccess'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Delete error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('formLibrary.deleteError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleDownload = async (event, form) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      const response = await axios.get(`/api/form-library/${form.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const ext = form.file_name && form.file_name.includes('.')
        ? form.file_name.substring(form.file_name.lastIndexOf('.'))
        : '';
      link.href = url;
      link.setAttribute('download', `${form.display_name}${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('formLibrary.downloadError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleCloseFileDialog = () => {
    if (fileBlobUrl) {
      window.URL.revokeObjectURL(fileBlobUrl);
      setFileBlobUrl(null);
    }
    setFileDialogOpen(false);
    setViewingForm(null);
  };

  const handleView = async (event, form) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      setLoadingFile(true);
      setViewingForm(form);
      setFileDialogOpen(true);
      const response = await axios.get(`/api/form-library/${form.id}/view`, {
        responseType: 'blob'
      });
      const contentType = response.headers['content-type'] || form.file_type || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      setFileBlobUrl(window.URL.createObjectURL(blob));
    } catch (error) {
      console.error('View form error:', error);
      handleCloseFileDialog();
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('formLibrary.downloadError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoadingFile(false);
    }
  };

  const pageCount = Math.ceil(forms.length / pageSize);
  const currentPage = Math.min(page, Math.max(1, pageCount || 1));
  const visibleForms = forms.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: { xs: 280, md: 420 },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '15px'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5
        }}
      >
        <Typography variant="h6" noWrap sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
          <DescriptionIcon sx={{ flexShrink: 0 }} />
          {t('tools.formLibrary')}
        </Typography>
        {isSystemAdmin && (
          <Button
            variant="contained"
            size="small"
            startIcon={<CloudUploadIcon />}
            onClick={handleOpenUpload}
            sx={{ flexShrink: 0 }}
          >
            {t('formLibrary.uploadForm')}
          </Button>
        )}
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && forms.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : forms.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('formLibrary.noForms')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {visibleForms.map((form) => (
              <ListItem
                key={form.id}
                disablePadding
                divider
                sx={{ opacity: form.visible_to_users === false ? 0.55 : 1, display: 'block' }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
                  <ListItemButton
                    onClick={(e) => handleView(e, form)}
                    sx={{ flex: 1, minWidth: 0, py: 0.75 }}
                  >
                    <DescriptionIcon color="primary" sx={{ mr: 1.5, fontSize: 22, flexShrink: 0 }} />
                    <ListItemText
                      sx={{ minWidth: 0, my: 0 }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
                            {form.display_name}
                          </Typography>
                          {isSystemAdmin && form.visible_to_users === false && (
                            <Chip label={t('formLibrary.hiddenFromUsers')} size="small" sx={{ flexShrink: 0 }} />
                          )}
                        </Box>
                      }
                      secondary={form.description || undefined}
                      secondaryTypographyProps={{
                        noWrap: true,
                        title: form.description || undefined
                      }}
                    />
                  </ListItemButton>
                  <Box sx={{ display: 'flex', flexShrink: 0, pr: 0.5 }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={t('formLibrary.view')}>
                      <IconButton size="small" color="info" onClick={(e) => handleView(e, form)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('formLibrary.download')}>
                      <IconButton size="small" color="primary" onClick={(e) => handleDownload(e, form)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isSystemAdmin && (
                      <>
                        <Tooltip title={t('formLibrary.edit')}>
                          <IconButton size="small" onClick={() => handleOpenEdit(form)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('formLibrary.delete')}>
                          <IconButton size="small" color="error" onClick={(e) => handleDelete(e, form.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1, borderTop: 1, borderColor: 'divider' }}>
          <Pagination
            count={pageCount}
            page={currentPage}
            onChange={(event, value) => setPage(value)}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {isSystemAdmin && (
        <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>{t('formLibrary.uploadDialogTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('formLibrary.fileDisplayName')}
                value={formData.display_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, display_name: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label={t('formLibrary.description')}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <Button variant="outlined" component="label" startIcon={<CloudUploadIcon />} fullWidth>
                {selectedFile ? selectedFile.name : t('formLibrary.selectFile')}
                <input
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
              </Button>
              {selectedFile && (
                <Typography variant="body2" color="text.secondary">
                  {t('formLibrary.fileSizeLabel')}: {formatFileSize(selectedFile.size)}
                </Typography>
              )}
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.visible_to_users}
                    onChange={(e) => setFormData((prev) => ({ ...prev, visible_to_users: e.target.checked }))}
                  />
                }
                label={t('formLibrary.visibleToUsersLabel')}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button onClick={() => setUploadOpen(false)} fullWidth={isMobile}>{t('formLibrary.cancel')}</Button>
            <Button
              onClick={handleUpload}
              variant="contained"
              disabled={saving || !selectedFile || !formData.display_name}
              fullWidth={isMobile}
            >
              {saving ? <CircularProgress size={20} /> : t('formLibrary.upload')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {isSystemAdmin && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
          <DialogTitle>{t('formLibrary.editDialogTitle')}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('formLibrary.fileDisplayName')}
                value={formData.display_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, display_name: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label={t('formLibrary.description')}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.visible_to_users}
                    onChange={(e) => setFormData((prev) => ({ ...prev, visible_to_users: e.target.checked }))}
                  />
                }
                label={t('formLibrary.visibleToUsersLabel')}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button onClick={() => setEditOpen(false)} fullWidth={isMobile}>{t('formLibrary.cancel')}</Button>
            <Button
              onClick={handleUpdate}
              variant="contained"
              disabled={saving || !formData.display_name}
              fullWidth={isMobile}
            >
              {saving ? <CircularProgress size={20} /> : t('formLibrary.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={fileDialogOpen}
        onClose={handleCloseFileDialog}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">{viewingForm?.display_name || t('formLibrary.viewFile')}</Typography>
            <IconButton onClick={handleCloseFileDialog}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingFile ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280 }}>
              <CircularProgress />
            </Box>
          ) : fileBlobUrl && viewingForm ? (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              {viewingForm.file_type?.startsWith('image/') ? (
                <Box
                  component="img"
                  src={fileBlobUrl}
                  alt={viewingForm.display_name}
                  sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
                />
              ) : viewingForm.file_type === 'application/pdf' || viewingForm.file_name?.toLowerCase().endsWith('.pdf') ? (
                <Box
                  component="iframe"
                  src={fileBlobUrl}
                  title={viewingForm.display_name}
                  sx={{ width: '100%', height: '70vh', border: 'none' }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="body1" gutterBottom>
                    {t('formLibrary.cannotPreviewFileType')}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<GetAppIcon />}
                    sx={{ mt: 2 }}
                    onClick={(e) => handleDownload(e, viewingForm)}
                  >
                    {t('formLibrary.download')}
                  </Button>
                </Box>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFileDialog} variant="outlined">{t('formLibrary.close')}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default FormLibraryWidget;
