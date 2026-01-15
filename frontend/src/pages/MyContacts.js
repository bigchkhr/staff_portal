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
  Card,
  CardContent,
  Grid
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Edit as EditIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  WhatsApp as WhatsAppIcon,
  Call as CallIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Swal from 'sweetalert2';

const MyContacts = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    department: '',
    position: '',
    emails: [''],
    phones: ['']
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/contacts');
      setContacts(response.data.contacts || []);
    } catch (error) {
      console.error('Fetch contacts error:', error);
      Swal.fire({
        icon: 'error',
        title: t('myContacts.error'),
        text: error.response?.data?.message || t('myContacts.fetchError')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setFormData({
      name: '',
      company_name: '',
      department: '',
      position: '',
      emails: [''],
      phones: ['']
    });
    setError('');
    setSuccess('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setError('');
    setSuccess('');
  };

  const handleEditOpen = (contact) => {
    setEditingContact(contact);
    const emailArray = contact.emails && contact.emails.length > 0 ? [...contact.emails] : [''];
    const phoneArray = contact.phones && contact.phones.length > 0 ? [...contact.phones] : [''];
    
    setFormData({
      name: contact.name || '',
      company_name: contact.company_name || '',
      department: contact.department || '',
      position: contact.position || '',
      emails: emailArray,
      phones: phoneArray
    });
    setError('');
    setSuccess('');
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditingContact(null);
    setError('');
    setSuccess('');
  };

  const handleAddEmail = () => {
    setFormData({
      ...formData,
      emails: [...formData.emails, '']
    });
  };

  const handleRemoveEmail = (index) => {
    const newEmails = formData.emails.filter((_, i) => i !== index);
    if (newEmails.length === 0) {
      newEmails.push('');
    }
    setFormData({
      ...formData,
      emails: newEmails
    });
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData({
      ...formData,
      emails: newEmails
    });
  };

  const handleAddPhone = () => {
    setFormData({
      ...formData,
      phones: [...formData.phones, '']
    });
  };

  const handleRemovePhone = (index) => {
    const newPhones = formData.phones.filter((_, i) => i !== index);
    if (newPhones.length === 0) {
      newPhones.push('');
    }
    setFormData({
      ...formData,
      phones: newPhones
    });
  };

  const handlePhoneChange = (index, value) => {
    const newPhones = [...formData.phones];
    newPhones[index] = value;
    setFormData({
      ...formData,
      phones: newPhones
    });
  };

  const handleCreate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('myContacts.pleaseEnterName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const dataToSubmit = {
        ...formData,
        emails: formData.emails.filter(e => e && e.trim() !== ''),
        phones: formData.phones.filter(p => p && p.trim() !== '')
      };

      await axios.post('/api/contacts', dataToSubmit);

      Swal.fire({
        icon: 'success',
        title: t('myContacts.success'),
        text: t('myContacts.createSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      setOpen(false);
      setFormData({
        name: '',
        company_name: '',
        department: '',
        position: '',
        emails: [''],
        phones: ['']
      });
      fetchContacts();
    } catch (error) {
      console.error('Create error:', error);
      setError(error.response?.data?.message || t('myContacts.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name || formData.name.trim() === '') {
      setError(t('myContacts.pleaseEnterName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const dataToSubmit = {
        ...formData,
        emails: formData.emails.filter(e => e && e.trim() !== ''),
        phones: formData.phones.filter(p => p && p.trim() !== '')
      };

      await axios.put(`/api/contacts/${editingContact.id}`, dataToSubmit);

      Swal.fire({
        icon: 'success',
        title: t('myContacts.success'),
        text: t('myContacts.updateSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      setEditOpen(false);
      fetchContacts();
    } catch (error) {
      console.error('Update error:', error);
      setError(error.response?.data?.message || t('myContacts.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (contactId) => {
    const result = await Swal.fire({
      title: t('myContacts.confirmDelete'),
      text: t('myContacts.confirmDeleteMessage'),
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
      await axios.delete(`/api/contacts/${contactId}`);

      Swal.fire({
        icon: 'success',
        title: t('myContacts.success'),
        text: t('myContacts.deleteSuccess'),
        timer: 2000,
        showConfirmButton: false
      });

      fetchContacts();
    } catch (error) {
      console.error('Delete error:', error);
      Swal.fire({
        icon: 'error',
        title: t('myContacts.error'),
        text: error.response?.data?.message || t('myContacts.deleteError')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailClick = (emails) => {
    // 如果 emails 是數組，將所有 email 用逗號連接
    const emailList = Array.isArray(emails) ? emails.join(',') : emails;
    window.location.href = `mailto:${emailList}`;
  };

  const handlePhoneClick = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const handleWhatsAppClick = (phone) => {
    // 移除所有非數字字符
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  return (
    <Layout>
      <Box sx={{ 
        px: { xs: 1, sm: 2, md: 3 }, 
        py: { xs: 1.5, sm: 2, md: 3 },
        maxWidth: '1400px', 
        mx: 'auto',
        width: '100%'
      }}>
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
            {t('myContacts.title')}
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              lineHeight: 1.5
            }}
          >
            {t('myContacts.pageDescription')}
          </Typography>
        </Box>

        {/* 操作按鈕 */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          mb: 3
        }}>
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
            {t('myContacts.addContact')}
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
                  暫無聯絡人
                </Typography>
              </Paper>
            ) : (
              contacts.map((contact) => (
                <Card 
                  key={contact.id}
                  elevation={2}
                  sx={{ 
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { 
                      boxShadow: 4
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {contact.name}
                        </Typography>
                        {contact.company_name && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {contact.company_name}
                          </Typography>
                        )}
                        {contact.department && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {t('myContacts.department')}：{contact.department}
                          </Typography>
                        )}
                        {contact.position && (
                          <Chip 
                            label={contact.position} 
                            size="small" 
                            sx={{ mb: 1 }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Tooltip title={t('common.edit')}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditOpen(contact)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.delete')}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleDelete(contact.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Email */}
                    {contact.emails && contact.emails.length > 0 && (
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <EmailIcon fontSize="small" color="action" />
                          <Typography variant="body2" sx={{ flex: 1 }}>
                            {contact.emails.join(', ')}
                          </Typography>
                          <Tooltip title={`發送郵件給所有 ${contact.emails.length} 個地址`}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEmailClick(contact.emails)}
                              color="primary"
                            >
                              <EmailIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    )}

                    {/* Phone */}
                    {contact.phones && contact.phones.length > 0 && (
                      <Box>
                        {contact.phones.map((phone, index) => (
                          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <PhoneIcon fontSize="small" color="action" />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              {phone}
                            </Typography>
                            <Tooltip title={t('myContacts.call')}>
                              <IconButton 
                                size="small" 
                                onClick={() => handlePhoneClick(phone)}
                                color="primary"
                              >
                                <CallIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('myContacts.whatsapp')}>
                              <IconButton 
                                size="small" 
                                onClick={() => handleWhatsAppClick(phone)}
                                color="success"
                              >
                                <WhatsAppIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        ) : (
          // 桌面設備：表格佈局
          <TableContainer component={Paper} elevation={2}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.name')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.company')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.department')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.position')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.email')}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('myContacts.phone')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        {t('myContacts.noContacts')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id} hover>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell>{contact.company_name || '-'}</TableCell>
                      <TableCell>{contact.department || '-'}</TableCell>
                      <TableCell>
                        {contact.position ? (
                          <Chip label={contact.position} size="small" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.emails && contact.emails.length > 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2">{contact.emails.join(', ')}</Typography>
                            <Tooltip title={t('myContacts.sendEmailToAll', { count: contact.emails.length })}>
                              <IconButton 
                                size="small" 
                                onClick={() => handleEmailClick(contact.emails)}
                                color="primary"
                              >
                                <EmailIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.phones && contact.phones.length > 0 ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {contact.phones.map((phone, index) => (
                              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2">{phone}</Typography>
                                <Tooltip title={t('myContacts.call')}>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handlePhoneClick(phone)}
                                    color="primary"
                                  >
                                    <CallIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('myContacts.whatsapp')}>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleWhatsAppClick(phone)}
                                    color="success"
                                  >
                                    <WhatsAppIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Tooltip title={t('common.edit')}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleEditOpen(contact)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('common.delete')}>
                            <IconButton 
                              size="small" 
                              onClick={() => handleDelete(contact.id)}
                              color="error"
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

        {/* 新增對話框 */}
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
          <DialogTitle>{t('myContacts.addContact')}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={`${t('myContacts.name')} *`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label={t('myContacts.company')}
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                fullWidth
              />
              <TextField
                label={t('myContacts.department')}
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                fullWidth
              />
              <TextField
                label={t('myContacts.position')}
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                fullWidth
              />
              
              {/* Email 列表 */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('myContacts.email')}</Typography>
                {formData.emails.map((email, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={`${t('myContacts.email')} ${index + 1}`}
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      fullWidth
                      type="email"
                    />
                    {formData.emails.length > 1 && (
                      <IconButton 
                        onClick={() => handleRemoveEmail(index)}
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddEmail}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('myContacts.addEmail')}
                </Button>
              </Box>

              {/* Phone 列表 */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('myContacts.phone')}</Typography>
                {formData.phones.map((phone, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={`${t('myContacts.phone')} ${index + 1}`}
                      value={phone}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      fullWidth
                      type="tel"
                    />
                    {formData.phones.length > 1 && (
                      <IconButton 
                        onClick={() => handleRemovePhone(index)}
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddPhone}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('myContacts.addPhone')}
                </Button>
              </Box>

              {error && (
                <Alert severity="error">{error}</Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : t('myContacts.create')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 編輯對話框 */}
        <Dialog open={editOpen} onClose={handleEditClose} maxWidth="md" fullWidth>
          <DialogTitle>{t('myContacts.editContact')}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={`${t('myContacts.name')} *`}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label={t('myContacts.company')}
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                fullWidth
              />
              <TextField
                label={t('myContacts.department')}
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                fullWidth
              />
              <TextField
                label={t('myContacts.position')}
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                fullWidth
              />
              
              {/* Email 列表 */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('myContacts.email')}</Typography>
                {formData.emails.map((email, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={`${t('myContacts.email')} ${index + 1}`}
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      fullWidth
                      type="email"
                    />
                    {formData.emails.length > 1 && (
                      <IconButton 
                        onClick={() => handleRemoveEmail(index)}
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddEmail}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('myContacts.addEmail')}
                </Button>
              </Box>

              {/* Phone 列表 */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>電話</Typography>
                {formData.phones.map((phone, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={`${t('myContacts.phone')} ${index + 1}`}
                      value={phone}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      fullWidth
                      type="tel"
                    />
                    {formData.phones.length > 1 && (
                      <IconButton 
                        onClick={() => handleRemovePhone(index)}
                        color="error"
                        sx={{ mt: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddPhone}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {t('myContacts.addPhone')}
                </Button>
              </Box>

              {error && (
                <Alert severity="error">{error}</Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleEditClose}>{t('common.cancel')}</Button>
            <Button onClick={handleUpdate} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default MyContacts;
