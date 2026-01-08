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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Swal from 'sweetalert2';

const GroupContacts = ({ noLayout = false }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_zh: '',
    phone: '',
    email: '',
    address: '',
    position: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDepartmentGroups();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchContacts();
      checkEditPermission();
    }
  }, [selectedGroupId]);

  const fetchDepartmentGroups = async () => {
    try {
      // 獲取用戶可以瀏覽聯絡人的部門群組（包括直接所屬和通過授權群組關聯的）
      const response = await axios.get('/api/groups/department/contacts/accessible-groups');
      const groups = response.data.groups || [];
      setDepartmentGroups(groups);
      
      // 如果用戶只能訪問一個群組，自動選擇
      if (groups.length === 1) {
        setSelectedGroupId(groups[0].id);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
      Swal.fire({
        icon: 'error',
        title: t('groupContacts.error'),
        text: t('groupContacts.fetchGroupsFailed')
      });
    }
  };

  const checkEditPermission = async () => {
    if (!selectedGroupId) {
      setCanEdit(false);
      return;
    }

    try {
      // 檢查用戶是否為授權群組的批核成員
      // 通過獲取群組信息來判斷
      const groupResponse = await axios.get(`/api/groups/department/${selectedGroupId}`);
      const group = groupResponse.data.group;
      
      if (!group) {
        setCanEdit(false);
        return;
      }

      // 獲取用戶所屬的授權群組
      const userGroupsResponse = await axios.get('/api/groups/my-groups');
      const userDelegationGroups = userGroupsResponse.data.delegation_groups || [];
      const userDelegationGroupIds = userDelegationGroups.map(g => g.id);

      // 檢查用戶是否屬於任何一個批核授權群組
      const approverGroupIds = [
        group.checker_id,
        group.approver_1_id,
        group.approver_2_id,
        group.approver_3_id
      ].filter(id => id !== null && id !== undefined);

      const isApprover = approverGroupIds.some(id => userDelegationGroupIds.includes(id));
      setCanEdit(isApprover);
    } catch (error) {
      console.error('Check edit permission error:', error);
      // 如果檢查失敗，默認不允許編輯（實際權限檢查在後端）
      setCanEdit(false);
    }
  };

  const fetchContacts = async () => {
    if (!selectedGroupId) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/groups/department/${selectedGroupId}/contacts`);
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Fetch contacts error:', error);
      if (error.response?.status === 403) {
        Swal.fire({
          icon: 'error',
          title: t('groupContacts.error'),
          text: error.response?.data?.message || t('groupContacts.noPermission')
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: t('groupContacts.error'),
          text: t('groupContacts.fetchContactsFailed')
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      name_zh: '',
      phone: '',
      email: '',
      address: '',
      position: '',
      notes: ''
    });
    setError('');
    setSuccess('');
    setOpen(true);
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name || '',
      name_zh: contact.name_zh || '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      position: contact.position || '',
      notes: contact.notes || ''
    });
    setError('');
    setSuccess('');
    setEditOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('groupContacts.pleaseEnterName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.post(`/api/groups/department/${selectedGroupId}/contacts`, formData);

      Swal.fire({
        icon: 'success',
        title: t('groupContacts.success'),
        text: t('groupContacts.createSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      setOpen(false);
      setFormData({
        name: '',
        name_zh: '',
        phone: '',
        email: '',
        position: '',
        notes: ''
      });
      fetchContacts();
    } catch (error) {
      console.error('Create error:', error);
      setError(error.response?.data?.message || t('groupContacts.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('groupContacts.pleaseEnterName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.put(`/api/groups/department/${selectedGroupId}/contacts/${editingContact.id}`, formData);

      Swal.fire({
        icon: 'success',
        title: t('groupContacts.success'),
        text: t('groupContacts.updateSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      setEditOpen(false);
      fetchContacts();
    } catch (error) {
      console.error('Update error:', error);
      setError(error.response?.data?.message || t('groupContacts.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId) => {
    const result = await Swal.fire({
      title: t('groupContacts.confirmDelete'),
      text: t('groupContacts.confirmDeleteMessage'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.cancel')
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/api/groups/department/${selectedGroupId}/contacts/${contactId}`);

      Swal.fire({
        icon: 'success',
        title: t('groupContacts.success'),
        text: t('groupContacts.deleteSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      fetchContacts();
    } catch (error) {
      console.error('Delete error:', error);
      Swal.fire({
        icon: 'error',
        title: t('groupContacts.error'),
        text: error.response?.data?.message || t('groupContacts.deleteError')
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedGroup = departmentGroups.find(g => g.id === selectedGroupId);

  const content = (
    <Box sx={{ 
      ...(noLayout ? {} : {
        px: { xs: 1, sm: 2, md: 3 }, 
        py: { xs: 1.5, sm: 2, md: 3 }
      }),
      maxWidth: '1400px', 
      mx: 'auto',
      width: '100%'
    }}>
        {!noLayout && (
          <Box sx={{ mb: { xs: 2, sm: 2.5, md: 3 } }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.75rem', md: '2rem' }, 
                fontWeight: 600,
                color: 'primary.main',
                mb: { xs: 0.5, sm: 1 },
                lineHeight: 1.2
              }}
            >
              {t('groupContacts.title')}
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                lineHeight: 1.5
              }}
            >
              {t('groupContacts.pageDescription')}
            </Typography>
          </Box>
        )}

        {/* 群組選擇 */}
        <Paper 
          elevation={2}
          sx={{ 
            p: { xs: 2, sm: 3 }, 
            mb: 3,
            borderRadius: 2
          }}
        >
          <FormControl fullWidth>
            <InputLabel>{t('groupContacts.selectGroup')}</InputLabel>
            <Select
              value={selectedGroupId || ''}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              label={t('groupContacts.selectGroup')}
            >
              {departmentGroups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name_zh || group.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>

        {selectedGroupId && (
          <>
            {/* 操作按鈕 */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              mb: 3
            }}>
              <Typography variant="h6" sx={{ fontWeight: 500 }}>
                {selectedGroup ? (selectedGroup.name_zh || selectedGroup.name) : ''}
              </Typography>
              {canEdit && (
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
                  {t('groupContacts.addContact')}
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

            {/* 聯絡人列表 */}
            {isMobile ? (
              // 移動設備：卡片式佈局
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {loading && contacts.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <CircularProgress />
                  </Paper>
                ) : contacts.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('groupContacts.noContacts')}
                    </Typography>
                  </Paper>
                ) : (
                  contacts.map((contact) => (
                    <Paper 
                      key={contact.id}
                      elevation={2}
                      sx={{ 
                        p: 2,
                        borderRadius: 2,
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': { 
                          boxShadow: 4
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {contact.name_zh || contact.name}
                            {contact.name_zh && contact.name && contact.name_zh !== contact.name && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                                ({contact.name})
                              </Typography>
                            )}
                          </Typography>
                          {contact.position && (
                            <Chip 
                              label={contact.position} 
                              size="small" 
                              icon={<BusinessIcon />}
                              sx={{ mb: 1 }}
                            />
                          )}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 1 }}>
                            {contact.phone && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PhoneIcon fontSize="small" color="action" />
                                <Typography variant="body2">{contact.phone}</Typography>
                              </Box>
                            )}
                            {contact.email && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <EmailIcon fontSize="small" color="action" />
                                <Typography variant="body2">{contact.email}</Typography>
                              </Box>
                            )}
                            {contact.address && (
                              <Typography variant="body2" color="text.secondary">
                                {contact.address}
                              </Typography>
                            )}
                          </Box>
                          {contact.notes && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {contact.notes}
                            </Typography>
                          )}
                        </Box>
                        {canEdit && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title={t('common.edit')}>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(contact)}
                                sx={{ 
                                  color: 'warning.main',
                                  '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.delete')}>
                              <IconButton
                                size="small"
                                onClick={() => handleDelete(contact.id)}
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
                      <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('groupContacts.name')}</TableCell>
                      {!isTablet && (
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('groupContacts.position')}</TableCell>
                      )}
                      {!isTablet && (
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('groupContacts.phone')}</TableCell>
                      )}
                      {!isTablet && (
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{t('groupContacts.email')}</TableCell>
                      )}
                      {canEdit && (
                        <TableCell align="right" sx={{ color: 'white', fontWeight: 600 }}>{t('common.actions')}</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && contacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? (isTablet ? 2 : 5) : (isTablet ? 1 : 4)} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : contacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? (isTablet ? 2 : 5) : (isTablet ? 1 : 4)} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t('groupContacts.noContacts')}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      contacts.map((contact) => (
                        <TableRow 
                          key={contact.id}
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
                                {contact.name_zh || contact.name}
                              </Typography>
                              {contact.name_zh && contact.name && contact.name_zh !== contact.name && (
                                <Typography variant="caption" color="text.secondary">
                                  {contact.name}
                                </Typography>
                              )}
                              {contact.notes && !isTablet && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  {contact.notes}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          {!isTablet && (
                            <TableCell>
                              {contact.position || '-'}
                            </TableCell>
                          )}
                          {!isTablet && (
                            <TableCell>
                              {contact.phone ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  {contact.phone}
                                </Box>
                              ) : '-'}
                            </TableCell>
                          )}
                          {!isTablet && (
                            <TableCell>
                              {contact.email ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <EmailIcon fontSize="small" color="action" />
                                  {contact.email}
                                </Box>
                              ) : '-'}
                            </TableCell>
                          )}
                          {canEdit && (
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Tooltip title={t('common.edit')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEdit(contact)}
                                    sx={{ 
                                      color: 'warning.main',
                                      '&:hover': { backgroundColor: 'warning.light', color: 'white' }
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('common.delete')}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDelete(contact.id)}
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
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* 創建對話框 */}
            {canEdit && (
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
                  {t('groupContacts.createDialogTitle')}
                </DialogTitle>
                <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                      label={t('groupContacts.name')}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      fullWidth
                      required
                    />
                    <TextField
                      label={t('groupContacts.nameZh')}
                      value={formData.name_zh}
                      onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.phone')}
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.email')}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.address')}
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.position')}
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.notes')}
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      fullWidth
                      multiline
                      rows={3}
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
                    disabled={loading || !formData.name}
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
                    {loading ? <CircularProgress size={20} /> : t('groupContacts.create')}
                  </Button>
                </DialogActions>
              </Dialog>
            )}

            {/* 編輯對話框 */}
            {canEdit && (
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
                  {t('groupContacts.editDialogTitle')}
                </DialogTitle>
                <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <TextField
                      label={t('groupContacts.name')}
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      fullWidth
                      required
                    />
                    <TextField
                      label={t('groupContacts.nameZh')}
                      value={formData.name_zh}
                      onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.phone')}
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.email')}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.address')}
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.position')}
                      value={formData.position}
                      onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                      fullWidth
                    />
                    <TextField
                      label={t('groupContacts.notes')}
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      fullWidth
                      multiline
                      rows={3}
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
                    disabled={loading || !formData.name}
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
          </>
        )}

        {!selectedGroupId && departmentGroups.length > 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('groupContacts.pleaseSelectGroup')}
            </Typography>
          </Paper>
        )}

        {departmentGroups.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('groupContacts.noGroups')}
            </Typography>
          </Paper>
        )}
      </Box>
  );

  if (noLayout) {
    return content;
  }

  return <Layout>{content}</Layout>;
};

export default GroupContacts;

