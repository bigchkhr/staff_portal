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
  useMediaQuery,
  Pagination
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
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    fetchDocuments();
    fetchCategories();
    setPage(1); // 當過濾條件改變時重置分頁
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
      setError(''); // 清除之前的錯誤

      const isImage = doc.file_type && doc.file_type.startsWith('image/');
      const isPDF = doc.file_type === 'application/pdf' || doc.file_name?.toLowerCase().endsWith('.pdf');
      const url = `/api/documents/${doc.id}/download${isImage || isPDF ? '?view=true' : ''}`;
      
      // 使用 axios 下載文件（axios 攔截器會自動添加 Authorization header）
      const response = await axios.get(url, {
        responseType: 'blob'
      });
      
      // 檢查響應是否為錯誤（blob 響應即使是錯誤也可能返回 blob）
      if (response.data instanceof Blob && response.data.size === 0) {
        throw new Error('文件為空或無法讀取');
      }
      
      // 檢查響應的 Content-Type 是否為 JSON（表示錯誤）
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        // 如果是 JSON 響應，可能是錯誤訊息
        const text = await response.data.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || '無法開啟檔案');
        } catch (parseError) {
          throw new Error('無法開啟檔案');
        }
      }
      
      // 從響應中獲取正確的 MIME 類型
      const finalContentType = contentType || doc.file_type || 'application/octet-stream';
      
      // 創建 blob URL（使用正確的 MIME 類型）
      const blob = new Blob([response.data], { type: finalContentType });
      const blobUrl = window.URL.createObjectURL(blob);
      setFileBlobUrl(blobUrl);
    } catch (error) {
      console.error('查看文件錯誤:', error);
      
      // 關閉對話框並清除狀態
      if (fileBlobUrl) {
        window.URL.revokeObjectURL(fileBlobUrl);
        setFileBlobUrl(null);
      }
      setFileDialogOpen(false);
      setViewingFile(null);
      
      // 構建錯誤訊息
      let errorMessage = t('employeeDocuments.cannotOpenFile') || '無法開啟檔案';
      
      if (error.response) {
        // 處理 HTTP 錯誤響應
        if (error.response.status === 403 || error.response.status === 401) {
          errorMessage = t('employeeDocuments.noPermissionFile') || '您沒有權限查看此文件';
        } else if (error.response.status === 404) {
          errorMessage = '文件不存在';
        } else if (error.response.status >= 500) {
          errorMessage = '伺服器錯誤，請稍後再試';
        } else if (error.response.data) {
          // 嘗試從響應中獲取錯誤訊息
          if (typeof error.response.data === 'string') {
            try {
              const errorData = JSON.parse(error.response.data);
              errorMessage = errorData.message || errorMessage;
            } catch {
              errorMessage = error.response.data || errorMessage;
            }
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
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
              filteredDocuments
                .slice((page - 1) * itemsPerPage, page * itemsPerPage)
                .map((doc) => (
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
      {filteredDocuments.length > itemsPerPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(filteredDocuments.length / itemsPerPage)}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
            size={isMobile ? 'small' : 'medium'}
          />
        </Box>
      )}

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
        <DialogContent sx={{ p: { xs: 2, sm: 3 }, overflow: 'auto' }}>
          {loadingFile ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: isMobile ? '50vh' : '400px' }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ ml: 2 }}>
                {t('common.loading')}
              </Typography>
            </Box>
          ) : fileBlobUrl && viewingFile ? (
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: isMobile ? '50vh' : 'auto' }}>
              {viewingFile.file_type?.startsWith('image/') ? (
                <img
                  src={fileBlobUrl}
                  alt={viewingFile.display_name || viewingFile.file_name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: isMobile ? '70vh' : '80vh',
                    objectFit: 'contain'
                  }}
                />
              ) : viewingFile.file_type === 'application/pdf' || viewingFile.file_name?.toLowerCase().endsWith('.pdf') ? (
                isMobile ? (
                  // 手機端：直接在新窗口打開或提供下載選項
                  <Box sx={{ textAlign: 'center', p: 4, width: '100%' }}>
                    <Typography variant="body1" gutterBottom sx={{ mb: 3 }}>
                      {t('employeeDocuments.mobilePdfMessage') || 'PDF 文件在手機上無法直接預覽，請選擇下載或在新窗口打開'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                      <Button
                        variant="contained"
                        component="a"
                        href={fileBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ minWidth: 200 }}
                        startIcon={<VisibilityIcon />}
                      >
                        {t('employeeDocuments.openInNewWindow') || '在新窗口打開'}
                      </Button>
                      <Button
                        variant="outlined"
                        component="a"
                        href={fileBlobUrl}
                        download={viewingFile.display_name || viewingFile.file_name}
                        sx={{ minWidth: 200 }}
                        startIcon={<GetAppIcon />}
                      >
                        {t('employeeDocuments.download') || '下載文件'}
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  // 桌面端：使用 iframe 顯示
                  <iframe
                    src={fileBlobUrl}
                    title={viewingFile.display_name || viewingFile.file_name}
                    style={{
                      width: '100%',
                      height: '80vh',
                      border: 'none'
                    }}
                  />
                )
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

