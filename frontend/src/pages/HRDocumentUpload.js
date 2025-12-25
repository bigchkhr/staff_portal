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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
import { formatDate } from '../utils/dateFormat';
import UserSearchDialog from '../components/UserSearchDialog';

const HRDocumentUpload = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [documents, setDocuments] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    display_name: '',
    category: '',
    visible_to_recipient: true
  });
  const [filters, setFilters] = useState({
    user_id: '',
    category: '',
    search: '',
    uploaded_by_id: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterUserDialogOpen, setFilterUserDialogOpen] = useState(false);
  const [uploadUserDialogOpen, setUploadUserDialogOpen] = useState(false);
  const [selectedFilterUser, setSelectedFilterUser] = useState(null);
  const [selectedUploadUser, setSelectedUploadUser] = useState(null);
  const [searchInput, setSearchInput] = useState(''); // 分離搜尋輸入狀態，避免重新渲染

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
    fetchCategories();
  }, [filters]);

  // 當選擇的過濾器用戶改變時，更新過濾器
  useEffect(() => {
    if (selectedFilterUser) {
      setFilters(prev => ({ ...prev, user_id: selectedFilterUser.id.toString() }));
    } else if (selectedFilterUser === null && filters.user_id) {
      // 允許清除選擇
      setFilters(prev => ({ ...prev, user_id: '' }));
    }
  }, [selectedFilterUser]);

  // 當選擇的上傳用戶改變時，更新表單數據
  useEffect(() => {
    if (selectedUploadUser) {
      setFormData(prev => ({ ...prev, user_id: selectedUploadUser.id.toString() }));
    }
  }, [selectedUploadUser]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.uploaded_by_id) params.append('uploaded_by_id', filters.uploaded_by_id);

      const response = await axios.get(`/api/documents/all?${params.toString()}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Fetch documents error:', error);
      if (error.response?.status === 403) {
        setError(t('hrDocumentUpload.onlyHRGroup'));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按照 employee_number (username) 排序
      usersList.sort((a, b) => {
        const aUsername = a.employee_number || '';
        const bUsername = b.employee_number || '';
        return aUsername.localeCompare(bUsername, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/documents/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  const handleOpen = () => {
    setEditingDoc(null);
    setSelectedFile(null);
    setFormData({
      user_id: '',
      display_name: '',
      category: '',
      visible_to_recipient: true
    });
    setError('');
    setSuccess('');
    setSelectedUploadUser(null);
    setOpen(true);
  };

  const handleEdit = (doc) => {
    setEditingDoc(doc);
      setFormData({
        user_id: doc.user_id,
        display_name: doc.display_name,
        category: doc.category || '',
        visible_to_recipient: doc.visible_to_recipient
      });
    setError('');
    setSuccess('');
    setEditOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 檢查文件大小（8MB）
      if (file.size > 8 * 1024 * 1024) {
        setError(t('hrDocumentUpload.fileSizeExceeded'));
        e.target.value = '';
        return;
      }
      
      // 檢查文件類型
      const allowedTypes = ['pdf', 'jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        setError(t('hrDocumentUpload.unsupportedFileType', { types: allowedTypes.join(', ') }));
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
      setError(t('hrDocumentUpload.pleaseSelectFile'));
      return;
    }

    if (!formData.user_id) {
      setError(t('hrDocumentUpload.pleaseSelectEmployee'));
      return;
    }

    if (!formData.display_name || formData.display_name.trim() === '') {
      setError(t('hrDocumentUpload.pleaseEnterDisplayName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);
      uploadFormData.append('user_id', formData.user_id);
      uploadFormData.append('display_name', formData.display_name.trim());
      if (formData.category) {
        uploadFormData.append('category', formData.category.trim());
      }
      uploadFormData.append('visible_to_recipient', formData.visible_to_recipient);

      await axios.post('/api/documents/upload', uploadFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(t('hrDocumentUpload.uploadSuccess'));
      setOpen(false);
      setSelectedFile(null);
      setFormData({
        user_id: '',
        display_name: '',
        category: '',
        visible_to_recipient: true
      });
      fetchDocuments();
      fetchCategories();
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || t('hrDocumentUpload.uploadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.display_name || formData.display_name.trim() === '') {
      setError(t('hrDocumentUpload.pleaseEnterDisplayName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.put(`/api/documents/${editingDoc.id}`, {
        display_name: formData.display_name.trim(),
        category: formData.category ? formData.category.trim() : null,
        visible_to_recipient: formData.visible_to_recipient
      });

      setSuccess(t('hrDocumentUpload.updateSuccess'));
      setEditOpen(false);
      fetchDocuments();
      fetchCategories();
    } catch (error) {
      console.error('Update error:', error);
      setError(error.response?.data?.message || t('hrDocumentUpload.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm(t('hrDocumentUpload.confirmDelete'))) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/documents/${docId}`);
      setSuccess(t('hrDocumentUpload.deleteSuccess'));
      fetchDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.response?.data?.message || t('hrDocumentUpload.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (docId, displayName, fileName) => {
    try {
      const response = await axios.get(`/api/documents/${docId}/download`, {
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
      setError(error.response?.data?.message || t('hrDocumentUpload.downloadError'));
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 使用 useMemo 優化過濾邏輯，避免不必要的重新渲染
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (filters.user_id && doc.user_id !== parseInt(filters.user_id)) return false;
      if (filters.category && doc.category !== filters.category) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return (
          doc.display_name?.toLowerCase().includes(searchLower) ||
          doc.recipient_display_name?.toLowerCase().includes(searchLower) ||
          doc.recipient_employee_number?.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [documents, filters.user_id, filters.category, filters.search]);

  // 處理搜尋輸入變更（不觸發過濾器更新）
  const handleSearchInputChange = useCallback((e) => {
    setSearchInput(e.target.value);
  }, []);

  // 處理搜尋按鈕點擊或 Enter 鍵
  const handleSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, search: searchInput }));
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
        <Typography 
          variant="h4" 
          sx={{ 
            fontSize: { xs: '1.5rem', sm: '2rem' }, 
            fontWeight: 600,
            color: 'primary.main'
          }}
        >
          {t('hrDocumentUpload.title')}
        </Typography>
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
          {t('hrDocumentUpload.uploadFile')}
        </Button>
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
          gap: 2, 
          flexWrap: 'wrap',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'flex-end' }
        }}>
          <Box sx={{ 
            minWidth: { xs: '100%', sm: 200 },
            flex: { xs: '1 1 100%', sm: '0 0 auto' }
          }}>
            <InputLabel sx={{ mb: 1, fontWeight: 500 }}>{t('hrDocumentUpload.recipientEmployee')}</InputLabel>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SearchIcon />}
              onClick={() => setFilterUserDialogOpen(true)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                height: { xs: '48px', sm: '56px' },
                color: selectedFilterUser ? 'text.primary' : 'text.secondary',
                borderColor: selectedFilterUser ? 'primary.main' : 'divider',
                fontSize: { xs: '0.875rem', sm: '1rem' },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover'
                },
                borderRadius: 1
              }}
            >
              {selectedFilterUser 
                ? `${selectedFilterUser.employee_number} - ${selectedFilterUser.display_name || selectedFilterUser.name_zh || '-'}`
                : t('hrDocumentUpload.all')
              }
            </Button>
            {selectedFilterUser && (
              <Button
                size="small"
                onClick={() => setSelectedFilterUser(null)}
                sx={{ mt: 0.5, textTransform: 'none' }}
              >
                {t('hrDocumentUpload.clear')}
              </Button>
            )}
          </Box>

          <FormControl 
            sx={{ 
              minWidth: { xs: '100%', sm: 180 },
              flex: { xs: '1 1 100%', sm: '0 0 auto' }
            }}
          >
            <InputLabel>{t('hrDocumentUpload.documentCategory')}</InputLabel>
            <Select
              value={filters.category}
              label={t('hrDocumentUpload.documentCategory')}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              sx={{ borderRadius: 1 }}
            >
              <MenuItem value="">{t('hrDocumentUpload.all')}</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ 
            display: 'flex',
            gap: 1,
            minWidth: { xs: '100%', sm: 300 },
            flex: { xs: '1 1 100%', sm: '1 1 auto' },
            alignItems: 'flex-end',
            flexDirection: { xs: 'column', sm: 'row' }
          }}>
            <TextField
              label={t('hrDocumentUpload.search')}
              value={searchInput}
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
              placeholder={t('hrDocumentUpload.searchPlaceholder')}
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
        </Box>
      </Paper>

      {isMobile ? (
        // 移動設備：卡片式佈局
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {loading && filteredDocuments.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress />
            </Paper>
          ) : filteredDocuments.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('hrDocumentUpload.noDocuments')}
              </Typography>
            </Paper>
          ) : (
            filteredDocuments.map((doc) => (
              <Paper 
                key={doc.id}
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
                    {doc.display_name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(doc.id, doc.display_name, doc.file_name)}
                      sx={{ 
                        color: 'primary.main',
                        '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                      }}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(doc)}
                      sx={{ 
                        color: 'info.main',
                        '&:hover': { backgroundColor: 'info.light', color: 'white' }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(doc.id)}
                      sx={{ 
                        color: 'error.main',
                        '&:hover': { backgroundColor: 'error.light', color: 'white' }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      {t('hrDocumentUpload.recipientEmployee')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {doc.recipient_display_name || `${doc.recipient_surname} ${doc.recipient_given_name}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {doc.recipient_employee_number}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {doc.category && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {t('hrDocumentUpload.category')}
                        </Typography>
                        <Chip 
                          label={doc.category} 
                          size="small" 
                          sx={{ 
                            borderRadius: 1,
                            fontWeight: 500
                          }} 
                        />
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('hrDocumentUpload.fileSize')}
                      </Typography>
                      <Typography variant="body2">{formatFileSize(doc.file_size)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {t('hrDocumentUpload.visibility')}
                      </Typography>
                      {doc.visible_to_recipient ? (
                        <Chip 
                          label={t('hrDocumentUpload.visibleToEmployee')} 
                          size="small" 
                          color="success"
                          sx={{ borderRadius: 1 }}
                        />
                      ) : (
                        <Chip 
                          label={t('hrDocumentUpload.hiddenFromEmployee')} 
                          size="small" 
                          color="default"
                          sx={{ borderRadius: 1 }}
                        />
                      )}
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('hrDocumentUpload.uploader')}: {doc.uploader_display_name || doc.uploader_email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('hrDocumentUpload.uploadTime')}: {formatDate(doc.created_at)}
                    </Typography>
                  </Box>
                </Box>
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
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.fileName')}</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.recipientEmployee')}</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.category')}</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.fileSize')}</TableCell>
                {!isTablet && (
                  <>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.uploader')}</TableCell>
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.uploadTime')}</TableCell>
                  </>
                )}
                <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.visibility')}</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>{t('hrDocumentUpload.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isTablet ? 6 : 8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isTablet ? 6 : 8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('hrDocumentUpload.noDocuments')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow 
                    key={doc.id}
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
                      <Typography variant="body2" sx={{ fontWeight: 500, maxWidth: { xs: 150, sm: 200 }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.display_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: { xs: 120, sm: 180 }, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.recipient_display_name || `${doc.recipient_surname} ${doc.recipient_given_name}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {doc.recipient_employee_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {doc.category ? (
                        <Chip 
                          label={doc.category} 
                          size="small" 
                          sx={{ 
                            borderRadius: 1,
                            fontWeight: 500
                          }} 
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatFileSize(doc.file_size)}</Typography>
                    </TableCell>
                    {!isTablet && (
                      <>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.uploader_display_name || doc.uploader_email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatDate(doc.created_at)}</Typography>
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      {doc.visible_to_recipient ? (
                        <Chip 
                          label={t('hrDocumentUpload.visibleToEmployee')} 
                          size="small" 
                          color="success"
                          sx={{ borderRadius: 1 }}
                        />
                      ) : (
                        <Chip 
                          label={t('hrDocumentUpload.hiddenFromEmployee')} 
                          size="small" 
                          color="default"
                          sx={{ borderRadius: 1 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Tooltip title={t('hrDocumentUpload.download')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(doc.id, doc.display_name, doc.file_name)}
                            sx={{ 
                              color: 'primary.main',
                              '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                            }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('hrDocumentUpload.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(doc)}
                            sx={{ 
                              color: 'info.main',
                              '&:hover': { backgroundColor: 'info.light', color: 'white' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('hrDocumentUpload.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(doc.id)}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { backgroundColor: 'error.light', color: 'white' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
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
          {t('hrDocumentUpload.uploadDialogTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <InputLabel required sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>{t('hrDocumentUpload.recipientEmployeeRequired')}</InputLabel>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SearchIcon />}
                onClick={() => setUploadUserDialogOpen(true)}
                sx={{
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  height: { xs: '48px', sm: '56px' },
                  color: selectedUploadUser ? 'text.primary' : 'text.secondary',
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {selectedUploadUser 
                  ? `${selectedUploadUser.employee_number} - ${selectedUploadUser.display_name || selectedUploadUser.name_zh || '-'}`
                  : t('hrDocumentUpload.selectRecipient')
                }
              </Button>
            </Box>

            <TextField
              label={t('hrDocumentUpload.fileDisplayName')}
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              fullWidth
              helperText={t('hrDocumentUpload.fileDisplayNameHelper')}
            />

            <FormControl fullWidth>
              <InputLabel>{t('hrDocumentUpload.documentCategoryLabel')}</InputLabel>
              <Select
                value={formData.category}
                label={t('hrDocumentUpload.documentCategoryLabel')}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="">{t('hrDocumentUpload.noCategory')}</MenuItem>
                <MenuItem value="Salary Advice">Salary Advice</MenuItem>
                <MenuItem value="IR56B">IR56B</MenuItem>
                <MenuItem value="IR56F">IR56F</MenuItem>
                <MenuItem value="IR56G">IR56G</MenuItem>
                <MenuItem value="Others">Others</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {selectedFile ? selectedFile.name : t('hrDocumentUpload.selectFile')}
              <input
                type="file"
                hidden
                accept=".pdf,.jpeg,.jpg,.png,.gif,.bmp,.webp,.tiff,.tif"
                onChange={handleFileChange}
              />
            </Button>

            {selectedFile && (
              <Typography variant="body2" color="text.secondary">
                {t('hrDocumentUpload.fileSizeLabel')}: {formatFileSize(selectedFile.size)}
              </Typography>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={formData.visible_to_recipient}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, visible_to_recipient: e.target.checked }))
                  }
                />
              }
              label={t('hrDocumentUpload.openToEmployee')}
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
            {t('hrDocumentUpload.cancel')}
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={loading || !selectedFile || !formData.user_id || !formData.display_name}
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
            {loading ? <CircularProgress size={20} /> : t('hrDocumentUpload.upload')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 編輯對話框 */}
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
          {t('hrDocumentUpload.editDialogTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label={t('hrDocumentUpload.fileDisplayName')}
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              fullWidth
              size={isMobile ? 'small' : 'medium'}
            />

            <FormControl fullWidth>
              <InputLabel>{t('hrDocumentUpload.documentCategoryLabel')}</InputLabel>
              <Select
                value={formData.category}
                label={t('hrDocumentUpload.documentCategoryLabel')}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              >
                <MenuItem value="">{t('hrDocumentUpload.noCategory')}</MenuItem>
                <MenuItem value="Salary Advice">Salary Advice</MenuItem>
                <MenuItem value="IR56B">IR56B</MenuItem>
                <MenuItem value="IR56F">IR56F</MenuItem>
                <MenuItem value="IR56G">IR56G</MenuItem>
                <MenuItem value="Others">Others</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.visible_to_recipient}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, visible_to_recipient: e.target.checked }))
                  }
                />
              }
              label={t('hrDocumentUpload.openToEmployee')}
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
            {t('hrDocumentUpload.cancel')}
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
            {loading ? <CircularProgress size={20} /> : t('hrDocumentUpload.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 過濾器用戶搜尋對話框 */}
      <UserSearchDialog
        open={filterUserDialogOpen}
        onClose={() => setFilterUserDialogOpen(false)}
        onSelect={(user) => setSelectedFilterUser(user)}
        selectedUserId={filters.user_id ? parseInt(filters.user_id) : null}
      />

      {/* 上傳用戶搜尋對話框 */}
      <UserSearchDialog
        open={uploadUserDialogOpen}
        onClose={() => setUploadUserDialogOpen(false)}
        onSelect={(user) => setSelectedUploadUser(user)}
        selectedUserId={formData.user_id ? parseInt(formData.user_id) : null}
      />
    </Box>
  );
};

export default HRDocumentUpload;

