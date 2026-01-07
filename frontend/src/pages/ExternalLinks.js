import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Chip,
  Link as MuiLink,
  FormControlLabel,
  Switch
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormat';

const ExternalLinks = () => {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    narrative: '',
    logo_url: '',
    url: '',
    display_order: 0,
    is_active: true
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchLinks();
  }, [searchQuery]);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);

      const response = await axios.get(`/api/external-links/all?${params.toString()}`);
      setLinks(response.data.links || []);
    } catch (error) {
      console.error('Fetch links error:', error);
      setError(t('externalLinks.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setEditingLink(null);
    setFormData({
      name: '',
      narrative: '',
      logo_url: '',
      url: '',
      display_order: 0,
      is_active: true
    });
    setError('');
    setSuccess('');
    setOpen(true);
  };

  const handleEdit = (link) => {
    setEditingLink(link);
    setFormData({
      name: link.name,
      narrative: link.narrative || '',
      logo_url: link.logo_url || '',
      url: link.url,
      display_order: link.display_order || 0,
      is_active: link.is_active
    });
    setError('');
    setSuccess('');
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('externalLinks.pleaseEnterName'));
      return;
    }

    if (!formData.url || formData.url.trim() === '') {
      setError(t('externalLinks.pleaseEnterUrl'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // 準備創建數據，確保空字符串被正確處理
      const createData = {
        ...formData,
        logo_url: formData.logo_url && formData.logo_url.trim() ? formData.logo_url.trim() : '',
        narrative: formData.narrative && formData.narrative.trim() ? formData.narrative.trim() : ''
      };

      await axios.post('/api/external-links', createData);

      setSuccess(t('externalLinks.createSuccess'));
      setOpen(false);
      setFormData({
        name: '',
        narrative: '',
        logo_url: '',
        url: '',
        display_order: 0,
        is_active: true
      });
      fetchLinks();
    } catch (error) {
      console.error('Create error:', error);
      setError(error.response?.data?.message || t('externalLinks.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('externalLinks.pleaseEnterName'));
      return;
    }

    if (!formData.url || formData.url.trim() === '') {
      setError(t('externalLinks.pleaseEnterUrl'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // 準備更新數據，確保空字符串被正確處理
      const updateData = {
        ...formData,
        logo_url: formData.logo_url && formData.logo_url.trim() ? formData.logo_url.trim() : '',
        narrative: formData.narrative && formData.narrative.trim() ? formData.narrative.trim() : ''
      };

      await axios.put(`/api/external-links/${editingLink.id}`, updateData);

      setSuccess(t('externalLinks.updateSuccess'));
      setEditOpen(false);
      fetchLinks();
    } catch (error) {
      console.error('Update error:', error);
      setError(error.response?.data?.message || t('externalLinks.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (linkId) => {
    if (!window.confirm(t('externalLinks.confirmDelete'))) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/external-links/${linkId}`);
      setSuccess(t('externalLinks.deleteSuccess'));
      fetchLinks();
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.response?.data?.message || t('externalLinks.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchInputChange = useCallback((e) => {
    setSearchInput(e.target.value);
  }, []);

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput]);

  const handleSearchKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 處理 URL，確保有正確的協議
  const formatUrl = (url) => {
    if (!url) return '';
    // 如果 URL 已經有協議，直接返回
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    // 否則添加 https://
    return `https://${url}`;
  };

  // 處理連結點擊
  const handleLinkClick = (e, url) => {
    // 如果點擊的是管理按鈕，不打開連結
    if (e.target.closest('button') || e.target.closest('[role="button"]')) {
      return;
    }
    const formattedUrl = formatUrl(url);
    window.open(formattedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center', 
          mb: 3
        }}>
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
                }
              }}
            >
              {t('externalLinks.addLink')}
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
              label={t('externalLinks.search')}
              value={searchInput}
              onChange={handleSearchInputChange}
              onKeyPress={handleSearchKeyPress}
              placeholder={t('externalLinks.searchPlaceholder')}
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

        {/* 連結列表 */}
        {isMobile ? (
          // 移動設備：卡片式佈局
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loading && links.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
              </Paper>
            ) : links.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('externalLinks.noLinks')}
                </Typography>
              </Paper>
            ) : (
              links.map((link) => (
                <Paper 
                  key={link.id}
                  elevation={2}
                  component={!isSystemAdmin ? 'a' : 'div'}
                  href={!isSystemAdmin ? formatUrl(link.url) : undefined}
                  target={!isSystemAdmin ? '_blank' : undefined}
                  rel={!isSystemAdmin ? 'noopener noreferrer' : undefined}
                  sx={{ 
                    p: 2,
                    borderRadius: 2,
                    cursor: !isSystemAdmin ? 'pointer' : 'default',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { 
                      boxShadow: 4,
                      transform: !isSystemAdmin ? 'translateY(-2px)' : 'none'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ flex: 1, pr: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        {link.logo_url && (
                          <img 
                            src={link.logo_url} 
                            alt={link.name}
                            style={{ width: 48, height: 48, objectFit: 'contain', maxWidth: '48px', maxHeight: '48px' }}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => { 
                              e.target.style.display = 'none'; 
                              console.warn('Failed to load external logo:', link.logo_url);
                            }}
                          />
                        )}
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {link.name}
                        </Typography>
                      </Box>
                      <MuiLink 
                        href={formatUrl(link.url)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 0.5, 
                          fontSize: '0.875rem',
                          color: 'primary.main',
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          '&:hover': {
                            textDecoration: 'underline'
                          }
                        }}
                      >
                        {link.url.length > 50 ? `${link.url.substring(0, 50)}...` : link.url}
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </MuiLink>
                    </Box>
                    {isSystemAdmin && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={t('externalLinks.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(link)}
                            sx={{ 
                              color: 'warning.main',
                              '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('externalLinks.delete')}>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(link.id)}
                            sx={{ 
                              color: 'error.main',
                              '&:hover': { backgroundColor: 'error.light', color: 'white' }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                  
                  {link.narrative && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {link.narrative}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                    {isSystemAdmin && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          {t('externalLinks.status')}
                        </Typography>
                        {link.is_active ? (
                          <Chip 
                            label={t('externalLinks.active')} 
                            size="small" 
                            color="success"
                            sx={{ borderRadius: 1 }}
                          />
                        ) : (
                          <Chip 
                            label={t('externalLinks.inactive')} 
                            size="small" 
                            color="default"
                            sx={{ borderRadius: 1 }}
                          />
                        )}
                      </Box>
                    )}
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
                  <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('externalLinks.name')}</TableCell>
                  {!isTablet && (
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('externalLinks.narrative')}</TableCell>
                  )}
                  {isSystemAdmin && (
                    <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('externalLinks.status')}</TableCell>
                  )}
                  <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>{t('externalLinks.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && links.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSystemAdmin ? (isTablet ? 2 : 4) : (isTablet ? 1 : 2)} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : links.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSystemAdmin ? (isTablet ? 2 : 4) : (isTablet ? 1 : 2)} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('externalLinks.noLinks')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  links.map((link) => (
                    <TableRow 
                      key={link.id}
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {link.logo_url && (
                            <img 
                              src={link.logo_url} 
                              alt={link.name}
                              style={{ width: 48, height: 48, objectFit: 'contain', maxWidth: '48px', maxHeight: '48px' }}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => { 
                                e.target.style.display = 'none'; 
                                console.warn('Failed to load external logo:', link.logo_url);
                              }}
                            />
                          )}
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {link.name}
                            </Typography>
                            <MuiLink 
                              href={formatUrl(link.url)} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 0.5,
                                fontSize: '0.75rem',
                                color: 'primary.main',
                                textDecoration: 'none',
                                wordBreak: 'break-all',
                                '&:hover': {
                                  textDecoration: 'underline'
                                }
                              }}
                            >
                              {link.url.length > 40 ? `${link.url.substring(0, 40)}...` : link.url}
                              <OpenInNewIcon sx={{ fontSize: 12 }} />
                            </MuiLink>
                          </Box>
                        </Box>
                      </TableCell>
                      {!isTablet && (
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {link.narrative || '-'}
                          </Typography>
                        </TableCell>
                      )}
                      {isSystemAdmin && (
                        <TableCell>
                          {link.is_active ? (
                            <Chip 
                              label={t('externalLinks.active')} 
                              size="small" 
                              color="success"
                              sx={{ borderRadius: 1 }}
                            />
                          ) : (
                            <Chip 
                              label={t('externalLinks.inactive')} 
                              size="small" 
                              color="default"
                              sx={{ borderRadius: 1 }}
                            />
                          )}
                        </TableCell>
                      )}
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title={t('externalLinks.openLink')}>
                            <IconButton
                              size="small"
                              component="a"
                              href={formatUrl(link.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              sx={{ 
                                color: 'primary.main',
                                '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isSystemAdmin && (
                            <>
                              <Tooltip title={t('externalLinks.edit')}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(link)}
                                  sx={{ 
                                    color: 'warning.main',
                                    '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t('externalLinks.delete')}>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(link.id)}
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

        {/* 創建對話框 */}
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
              {t('externalLinks.createDialogTitle')}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  label={t('externalLinks.name')}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                  helperText={t('externalLinks.nameHelper')}
                />

                <TextField
                  label={t('externalLinks.url')}
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  fullWidth
                  required
                  helperText={t('externalLinks.urlHelper')}
                />

                <TextField
                  label={t('externalLinks.logoUrl')}
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  fullWidth
                  helperText={t('externalLinks.logoUrlHelper')}
                />

                <TextField
                  label={t('externalLinks.narrative')}
                  value={formData.narrative}
                  onChange={(e) => setFormData(prev => ({ ...prev, narrative: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                  helperText={t('externalLinks.narrativeHelper')}
                />

                <TextField
                  label={t('externalLinks.displayOrder')}
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  fullWidth
                  helperText={t('externalLinks.displayOrderHelper')}
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
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleCreate}
                variant="contained"
                disabled={loading || !formData.name || !formData.url}
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
                {loading ? <CircularProgress size={20} /> : t('externalLinks.create')}
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
              {t('externalLinks.editDialogTitle')}
            </DialogTitle>
            <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                <TextField
                  label={t('externalLinks.name')}
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  fullWidth
                  required
                  size={isMobile ? 'small' : 'medium'}
                />

                <TextField
                  label={t('externalLinks.url')}
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  fullWidth
                  required
                  size={isMobile ? 'small' : 'medium'}
                />

                <TextField
                  label={t('externalLinks.logoUrl')}
                  value={formData.logo_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                />

                <TextField
                  label={t('externalLinks.narrative')}
                  value={formData.narrative}
                  onChange={(e) => setFormData(prev => ({ ...prev, narrative: e.target.value }))}
                  fullWidth
                  multiline
                  rows={3}
                  size={isMobile ? 'small' : 'medium'}
                />

                <TextField
                  label={t('externalLinks.displayOrder')}
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  fullWidth
                  size={isMobile ? 'small' : 'medium'}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData(prev => ({ ...prev, is_active: e.target.checked }))
                      }
                    />
                  }
                  label={t('externalLinks.activeLabel')}
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
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleUpdate}
                variant="contained"
                disabled={loading || !formData.name || !formData.url}
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
                {loading ? <CircularProgress size={20} /> : t('common.save')}
              </Button>
            </DialogActions>
          </Dialog>
        )}
    </Box>
  );
};

export default ExternalLinks;

