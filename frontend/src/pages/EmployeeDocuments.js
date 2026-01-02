import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Download as DownloadIcon, Visibility as VisibilityIcon, Close as CloseIcon, GetApp as GetAppIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { formatDate } from '../utils/dateFormat';
import Swal from 'sweetalert2';

const EmployeeDocuments = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    search: ''
  });
  const [error, setError] = useState('');
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState(null);
  const [fileBlobUrl, setFileBlobUrl] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchCategories();
  }, [filters]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);

      const response = await axios.get(`/api/documents/my?${params.toString()}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Fetch documents error:', error);
      setError(t('employeeDocuments.fetchError'));
    } finally {
      setLoading(false);
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
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError(error.response?.data?.message || t('employeeDocuments.downloadError'));
    }
  };

  const handleOpenFile = async (doc) => {
    try {
      setLoadingFile(true);
      setViewingFile(doc);
      setFileDialogOpen(true);

      const isImage = doc.file_type && doc.file_type.startsWith('image/');
      const isPDF = doc.file_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');
      const url = `/api/documents/${doc.id}/download${isImage || isPDF ? '?view=true' : ''}`;
      
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
      console.error('查看文件錯誤:', error);
      setFileDialogOpen(false);
      setViewingFile(null);
      
      let errorMessage = t('employeeDocuments.cannotOpenFile') || '無法開啟檔案';
      if (error.response?.status === 403 || error.response?.status === 401) {
        errorMessage = t('employeeDocuments.noPermissionFile') || '您沒有權限查看此文件';
      }
      
      await Swal.fire({
        icon: 'error',
        title: '無法開啟檔案',
        text: errorMessage,
        confirmButtonText: '確定',
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

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredDocuments = documents.filter(doc => {
    if (filters.category && doc.category !== filters.category) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return doc.display_name?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">{t('employeeDocuments.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {t('employeeDocuments.description')}
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            mt: 2,
            color: 'error.main',
            fontWeight: 500,
            fontSize: { xs: '0.875rem', sm: '0.9rem' }
          }}
        >
          {t('employeeDocuments.disclaimer')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>{t('employeeDocuments.category')}</InputLabel>
            <Select
              value={filters.category}
              label={t('employeeDocuments.category')}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <MenuItem value="">{t('employeeDocuments.allCategories')}</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label={t('employeeDocuments.search')}
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            placeholder={t('employeeDocuments.fileNamePlaceholder')}
            sx={{ minWidth: 250 }}
          />
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('employeeDocuments.fileName')}</TableCell>
              <TableCell>{t('employeeDocuments.category')}</TableCell>
              <TableCell>{t('employeeDocuments.fileSize')}</TableCell>
              <TableCell>{t('employeeDocuments.releaseTime')}</TableCell>
              <TableCell align="right">{t('employeeDocuments.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('employeeDocuments.noDocuments')}
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>{doc.display_name}</TableCell>
                  <TableCell>
                    {doc.category ? <Chip label={doc.category} size="small" /> : '-'}
                  </TableCell>
                  <TableCell>{formatFileSize(doc.file_size)}</TableCell>
                  <TableCell>{formatDate(doc.created_at)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenFile(doc)}
                      title={t('employeeDocuments.view') || '查看'}
                      sx={{ mr: 1 }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDownload(doc.id, doc.display_name, doc.file_name)}
                      title={t('employeeDocuments.download')}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 文件查看 Dialog */}
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
              {viewingFile?.display_name || viewingFile?.file_name || t('employeeDocuments.viewFile') || '查看文件'}
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
                  alt={viewingFile.display_name || viewingFile.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
              ) : viewingFile.file_type === 'application/pdf' || viewingFile.file_name?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={fileBlobUrl}
                  title={viewingFile.display_name || viewingFile.file_name}
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: 'none'
                  }}
                />
              ) : (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="body1" gutterBottom>
                    {t('employeeDocuments.cannotPreview') || '無法在瀏覽器中預覽此文件類型'}
                  </Typography>
                  <Button
                    variant="contained"
                    component="a"
                    href={fileBlobUrl}
                    download={viewingFile.display_name || viewingFile.file_name}
                    sx={{ mt: 2 }}
                    startIcon={<GetAppIcon />}
                  >
                    {t('employeeDocuments.download') || '下載文件'}
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
              download={viewingFile?.display_name || viewingFile?.file_name}
              variant="contained"
              startIcon={<GetAppIcon />}
            >
              {t('employeeDocuments.download') || '下載'}
            </Button>
          )}
          <Button onClick={handleCloseFileDialog} variant="outlined">
            {t('common.close') || '關閉'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeeDocuments;

