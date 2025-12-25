import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip
} from '@mui/material';
import { 
  CloudUpload as CloudUploadIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Download as DownloadIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormat';

const FormLibrary = () => {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    visible_to_users: true
  });
  const [searchInput, setSearchInput] = useState(''); // 分離搜尋輸入狀態，避免重新渲染
  const [searchQuery, setSearchQuery] = useState(''); // 實際用於查詢的狀態
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchForms();
  }, [searchQuery]); // 只有searchQuery改變時才重新獲取

  const fetchForms = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);

      const response = await axios.get(`/api/form-library/all?${params.toString()}`);
      setForms(response.data.forms || []);
    } catch (error) {
      console.error('Fetch forms error:', error);
      setError(t('formLibrary.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setEditingForm(null);
    setSelectedFile(null);
    setFormData({
      display_name: '',
      description: '',
      visible_to_users: true
    });
    setError('');
    setSuccess('');
    setOpen(true);
  };

  const handleEdit = (form) => {
    setEditingForm(form);
    setFormData({
      display_name: form.display_name,
      description: form.description || '',
      visible_to_users: form.visible_to_users
    });
    setError('');
    setSuccess('');
    setEditOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 檢查文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        setError(t('formLibrary.fileSizeExceeded'));
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      if (!formData.display_name) {
        setFormData(prev => ({ ...prev, display_name: file.name.replace(/\.[^/.]+$/, '') }));
      }
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError(t('formLibrary.pleaseSelectFile'));
      return;
    }

    if (!formData.display_name || formData.display_name.trim() === '') {
      setError(t('formLibrary.pleaseEnterDisplayName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('display_name', formData.display_name.trim());
      uploadFormData.append('visible_to_users', formData.visible_to_users);
      if (formData.description) {
        uploadFormData.append('description', formData.description.trim());
      }

      await axios.post('/api/form-library/upload', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(t('formLibrary.uploadSuccess'));
      setOpen(false);
      setSelectedFile(null);
      setFormData({
        display_name: '',
        description: '',
        visible_to_users: true
      });
      fetchForms();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || t('formLibrary.uploadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.display_name || formData.display_name.trim() === '') {
      setError(t('formLibrary.pleaseEnterDisplayName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.put(`/api/form-library/${editingForm.id}`, {
        display_name: formData.display_name.trim(),
        description: formData.description ? formData.description.trim() : null,
        visible_to_users: formData.visible_to_users
      });

      setSuccess(t('formLibrary.updateSuccess'));
      setEditOpen(false);
      fetchForms();
    } catch (error) {
      console.error('Update error:', error);
      setError(error.response?.data?.message || t('formLibrary.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (formId) => {
    if (!window.confirm(t('formLibrary.confirmDelete'))) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/form-library/${formId}`);
      setSuccess(t('formLibrary.deleteSuccess'));
      fetchForms();
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.response?.data?.message || t('formLibrary.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (formId, displayName, fileName) => {
    try {
      const response = await axios.get(`/api/form-library/${formId}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${displayName}${fileName.substring(fileName.lastIndexOf('.'))}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
      setError(error.response?.data?.message || t('formLibrary.downloadError'));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 處理搜尋輸入變更（不觸發API請求）
  const handleSearchInputChange = useCallback((e) => {
    setSearchInput(e.target.value);
  }, []);

  // 處理搜尋按鈕點擊或 Enter 鍵
  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput]);

  const handleSearchKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
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
            {t('formLibrary.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('formLibrary.description')}
          </Typography>
        </Box>
        {isSystemAdmin && (
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
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
            {t('formLibrary.uploadForm')}
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* 搜索欄 */}
      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          mb: 3,
          borderRadius: 2,
          background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)'
        }}
      >
        <Box sx={{ 
          display: 'flex',
          gap: 1,
          alignItems: 'flex-end',
          flexDirection: { xs: 'column', sm: 'row' }
        }}>
          <TextField
            label={t('formLibrary.search')}
            value={searchInput}
            onChange={handleSearchInputChange}
            onKeyPress={handleSearchKeyPress}
            placeholder={t('formLibrary.searchPlaceholder')}
            sx={{ 
              flex: 1,
              width: { xs: '100%', sm: 'auto' }
            }}
            size="small"
            InputProps={{
              sx: { height: { xs: '48px', sm: '56px' } }
            }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{
              height: { xs: '48px', sm: '56px' },
              minWidth: { xs: '100%', sm: '100px' },
              borderRadius: 1,
              fontWeight: 500,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {isMobile ? <SearchIcon /> : t('common.search')}
          </Button>
        </Box>
      </Paper>

      {/* 表單列表 */}
      {isMobile ? (
        // 移動設備：卡片式佈局
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading && forms.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Paper>
          ) : forms.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('formLibrary.noForms')}
              </Typography>
            </Paper>
          ) : (
            forms.map((form) => (
              <Paper 
                key={form.id}
                elevation={2}
                sx={{ 
                  p: 2,
                  borderRadius: 2,
                  '&:hover': { 
                    boxShadow: 4
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, pr: 1 }}>
                    {form.display_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(form.id, form.display_name, form.file_name)}
                      sx={{ 
                        color: 'primary.main',
                        '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    {isSystemAdmin && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(form)}
                          sx={{ 
                            color: 'info.main',
                            '&:hover': { backgroundColor: 'info.light', color: 'white' }
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(form.id)}
                          sx={{ 
                            color: 'error.main',
                            '&:hover': { backgroundColor: 'error.light', color: 'white' }
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Box>
                </Box>
                
                {form.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {form.description}
                  </Typography>
                )}
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {t('formLibrary.fileSize')}
                    </Typography>
                    <Typography variant="body2">{formatFileSize(form.file_size)}</Typography>
                  </Box>
                  {isSystemAdmin && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('formLibrary.visibility')}
                      </Typography>
                      {form.visible_to_users ? (
                        <Chip 
                          label={t('formLibrary.visibleToUsers')} 
                          size="small" 
                          color="success"
                          sx={{ borderRadius: 1 }}
                        />
                      ) : (
                        <Chip 
                          label={t('formLibrary.hiddenFromUsers')} 
                          size="small" 
                          color="default"
                          sx={{ borderRadius: 1 }}
                        />
                      )}
                    </Box>
                  )}
                </Box>
                
                {isSystemAdmin && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('formLibrary.uploader')}: {form.uploader_display_name || form.uploader_email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('formLibrary.uploadTime')}: {formatDate(form.created_at)}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ))
          )}
        </Box>
      ) : (
        // 桌面設備：表格佈局
        <TableContainer 
          component={Paper}
          elevation={2}
          sx={{ 
            borderRadius: 2,
            overflow: 'auto'
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.fileName')}</TableCell>
                {isSystemAdmin && (
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.visibility')}</TableCell>
                )}
                {!isTablet && (
                  <>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.fileSize')}</TableCell>
                    {isSystemAdmin && (
                      <>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.uploader')}</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.uploadTime')}</TableCell>
                      </>
                    )}
                  </>
                )}
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>{t('formLibrary.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSystemAdmin ? (isTablet ? 3 : 6) : (isTablet ? 2 : 3)} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isSystemAdmin ? (isTablet ? 3 : 6) : (isTablet ? 2 : 3)} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('formLibrary.noForms')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                forms.map((form) => (
                  <TableRow 
                    key={form.id}
                    sx={{ 
                      '&:hover': { 
                        backgroundColor: 'action.hover' 
                      },
                      '&:last-child td': { 
                        borderBottom: 0 
                      }
                    }}
                  >
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {form.display_name}
                        </Typography>
                        {form.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {form.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    {isSystemAdmin && (
                      <TableCell>
                        {form.visible_to_users ? (
                          <Chip 
                            label={t('formLibrary.visibleToUsers')} 
                            size="small" 
                            color="success"
                            sx={{ borderRadius: 1 }}
                          />
                        ) : (
                          <Chip 
                            label={t('formLibrary.hiddenFromUsers')} 
                            size="small" 
                            color="default"
                            sx={{ borderRadius: 1 }}
                          />
                        )}
                      </TableCell>
                    )}
                    {!isTablet && (
                      <>
                        <TableCell>
                          <Typography variant="body2">{formatFileSize(form.file_size)}</Typography>
                        </TableCell>
                        {isSystemAdmin && (
                          <>
                            <TableCell>
                              <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {form.uploader_display_name || form.uploader_email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{formatDate(form.created_at)}</Typography>
                            </TableCell>
                          </>
                        )}
                      </>
                    )}
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title={t('formLibrary.download')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(form.id, form.display_name, form.file_name)}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                            }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {isSystemAdmin && (
                          <>
                            <Tooltip title={t('formLibrary.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(form)}
                                sx={{ 
                                  color: 'info.main',
                                  '&:hover': { backgroundColor: 'info.light', color: 'white' }
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('formLibrary.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(form.id)}
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 上傳對話框 */}
      {isSystemAdmin && (
        <Dialog 
          open={open} 
          onClose={() => setOpen(false)} 
          maxWidth="md" 
          fullWidth
          fullScreen={isMobile}
          PaperProps={{
            sx: { borderRadius: { xs: 0, sm: 2 } }
          }}
        >
          <DialogTitle sx={{ 
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
            fontWeight: 600
          }}>
            {t('formLibrary.uploadDialogTitle')}
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('formLibrary.fileDisplayName')}
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                fullWidth
                required
                helperText={t('formLibrary.fileDisplayNameHelper')}
              />

              <TextField
                label={t('formLibrary.description')}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={3}
                helperText={t('formLibrary.descriptionHelper')}
              />

              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ py: 1.5 }}
              >
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
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, visible_to_users: e.target.checked }))
                    }
                  />
                }
                label={t('formLibrary.visibleToUsersLabel')}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ 
            px: { xs: 2, sm: 3 }, 
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: { xs: 1, sm: 0 }
          }}>
            <Button 
              onClick={() => setOpen(false)}
              sx={{ 
                textTransform: 'none',
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              {t('formLibrary.cancel')}
            </Button>
            <Button
              onClick={handleUpload}
              variant="contained"
              disabled={loading || !selectedFile || !formData.display_name}
              sx={{ 
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 2,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {loading ? <CircularProgress size={20} /> : t('formLibrary.upload')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 編輯對話框 */}
      {isSystemAdmin && (
        <Dialog 
          open={editOpen} 
          onClose={() => setEditOpen(false)} 
          maxWidth="md" 
          fullWidth
          fullScreen={isMobile}
          PaperProps={{
            sx: { borderRadius: { xs: 0, sm: 2 } }
          }}
        >
          <DialogTitle sx={{ 
            pb: 2,
            borderBottom: 1,
            borderColor: 'divider',
            fontWeight: 600
          }}>
            {t('formLibrary.editDialogTitle')}
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('formLibrary.fileDisplayName')}
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                fullWidth
                required
                size={isMobile ? 'small' : 'medium'}
              />

              <TextField
                label={t('formLibrary.description')}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={3}
                size={isMobile ? 'small' : 'medium'}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.visible_to_users}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, visible_to_users: e.target.checked }))
                    }
                  />
                }
                label={t('formLibrary.visibleToUsersLabel')}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ 
            px: { xs: 2, sm: 3 }, 
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
            flexDirection: { xs: 'column-reverse', sm: 'row' },
            gap: { xs: 1, sm: 0 }
          }}>
            <Button 
              onClick={() => setEditOpen(false)}
              sx={{ 
                textTransform: 'none',
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              {t('formLibrary.cancel')}
            </Button>
            <Button
              onClick={handleUpdate}
              variant="contained"
              disabled={loading || !formData.display_name}
              sx={{ 
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 2,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {loading ? <CircularProgress size={20} /> : t('formLibrary.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default FormLibrary;

