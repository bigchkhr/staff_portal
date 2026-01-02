import React, { useState, useEffect } from 'react';
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
  Card,
  CardContent,
  Grid,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';
import Layout from '../components/Layout';
import YearSelector from '../components/YearSelector';

const PublicHolidayManagement = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    date: null,
    name: '',
    name_zh: '',
    year: new Date().getFullYear()
  });

  const isHRMember = user?.is_hr_member || user?.is_system_admin;

  useEffect(() => {
    if (isHRMember) {
      fetchPublicHolidays();
    }
  }, [selectedYear, isHRMember]);

  const fetchPublicHolidays = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/public-holidays', {
        params: { year: selectedYear }
      });
      setPublicHolidays(response.data.publicHolidays || []);
    } catch (error) {
      console.error('Fetch public holidays error:', error);
      if (error.response?.status === 403) {
        await Swal.fire({
          icon: 'error',
          title: '權限不足',
          text: '只有HR Group成員可以管理法定假期',
          confirmButtonText: '確定',
          confirmButtonColor: '#d33'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setEditing(null);
    setFormData({
      date: null,
      name: '',
      name_zh: '',
      year: selectedYear
    });
    setOpen(true);
  };

  const handleEdit = (holiday) => {
    setEditing(holiday.id);
    setFormData({
      date: dayjs(holiday.date),
      name: holiday.name || '',
      name_zh: holiday.name_zh || '',
      year: holiday.year || selectedYear
    });
    setOpen(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('publicHolidayManagement.confirmDelete'),
      text: t('publicHolidayManagement.deleteConfirmText'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/public-holidays/${id}`);
      await Swal.fire({
        icon: 'success',
        title: t('publicHolidayManagement.deleteSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      fetchPublicHolidays();
    } catch (error) {
      console.error('Delete public holiday error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('publicHolidayManagement.deleteError'),
        text: error.response?.data?.message || t('publicHolidayManagement.operationFailed'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const handleSubmit = async () => {
    if (saving) return; // 防止重複提交

    if (!formData.date || !formData.name || !formData.name_zh) {
      await Swal.fire({
        icon: 'warning',
        title: t('publicHolidayManagement.validationFailed'),
        text: t('publicHolidayManagement.fillAllFields'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    try {
      setSaving(true);
      const submitData = {
        date: formData.date.format('YYYY-MM-DD'),
        name: formData.name,
        name_zh: formData.name_zh,
        year: formData.date.year()
      };

      if (editing) {
        await axios.put(`/api/public-holidays/${editing}`, submitData);
      } else {
        await axios.post('/api/public-holidays', submitData);
      }
      
      // 先關閉 modal 並重置表單（在顯示成功訊息之前）
      setOpen(false);
      setEditing(null);
      setFormData({
        date: null,
        name: '',
        name_zh: '',
        year: selectedYear
      });
      setSaving(false); // 立即重置 saving 狀態
      
      // 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: editing ? t('publicHolidayManagement.updateSuccess') : t('publicHolidayManagement.createSuccess'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      // 重新獲取數據（不等待，讓它在背景執行）
      fetchPublicHolidays();
    } catch (error) {
      console.error('Save public holiday error:', error);
      setSaving(false); // 出錯時也要重置 saving 狀態
      await Swal.fire({
        icon: 'error',
        title: editing ? t('publicHolidayManagement.updateError') : t('publicHolidayManagement.createError'),
        text: error.response?.data?.message || t('publicHolidayManagement.operationFailed'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  if (!isHRMember) {
    return (
      <Layout>
        <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 } }}>
          <Alert severity="error">
            {t('publicHolidayManagement.noPermission')}
          </Alert>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          justifyContent: 'space-between', 
          alignItems: { xs: 'flex-start', sm: 'center' }, 
          mb: 3,
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
            {t('publicHolidayManagement.title')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, width: { xs: '100%', sm: 'auto' } }}>
            <YearSelector
              value={selectedYear}
              onChange={(year) => setSelectedYear(year)}
              labelKey="publicHolidayManagement.year"
              fullWidth={isMobile}
              sx={{ minWidth: { xs: '100%', sm: 200 } }}
            />
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={handleOpen}
              fullWidth={isMobile}
              sx={{
                borderRadius: 1,
                fontWeight: 600,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {t('publicHolidayManagement.addHoliday')}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          // 手機版：卡片式布局
          <Box>
            {publicHolidays.length === 0 ? (
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('publicHolidayManagement.noHolidays')}
                </Typography>
              </Paper>
            ) : (
              publicHolidays.map((holiday) => (
                <Card key={holiday.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('publicHolidayManagement.date')}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {dayjs(holiday.date).format('YYYY-MM-DD')}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleEdit(holiday)}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(holiday.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Grid container spacing={1.5}>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('publicHolidayManagement.name')}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {holiday.name}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t('publicHolidayManagement.chineseName')}
                        </Typography>
                        <Typography variant="body2">
                          {holiday.name_zh}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        ) : (
          // 桌面版：表格布局
          <Paper 
            elevation={2}
            sx={{ 
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <TableContainer sx={{ 
              maxWidth: '100%',
              overflowX: 'auto',
              '& .MuiTableCell-root': {
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                padding: { xs: '12px', sm: '16px' },
                whiteSpace: 'nowrap'
              }
            }}>
              <Table size={isTablet ? "small" : "medium"}>
                <TableHead>
                  <TableRow sx={{ 
                    backgroundColor: 'primary.main',
                    '& .MuiTableCell-head': {
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.95rem'
                    }
                  }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('publicHolidayManagement.date')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('publicHolidayManagement.name')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('publicHolidayManagement.chineseName')}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{t('publicHolidayManagement.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {publicHolidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('publicHolidayManagement.noHolidays')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    publicHolidays.map((holiday) => (
                      <TableRow 
                        key={holiday.id}
                        sx={{
                          '&:nth-of-type(even)': {
                            backgroundColor: 'action.hover'
                          },
                          '&:hover': {
                            backgroundColor: 'action.selected'
                          },
                          transition: 'background-color 0.2s'
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>
                          {dayjs(holiday.date).format('YYYY-MM-DD')}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{holiday.name}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{holiday.name_zh}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton 
                            size="small" 
                            onClick={() => handleEdit(holiday)}
                            color="primary"
                            sx={{
                              mr: 1,
                              '&:hover': {
                                backgroundColor: 'primary.light',
                                color: 'white'
                              },
                              transition: 'all 0.2s'
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={() => handleDelete(holiday.id)}
                            color="error"
                            sx={{
                              '&:hover': {
                                backgroundColor: 'error.light',
                                color: 'white'
                              },
                              transition: 'all 0.2s'
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <Dialog 
          open={open} 
          onClose={() => setOpen(false)}
          fullScreen={isMobile}
          fullWidth
          maxWidth="sm"
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
            {editing ? t('publicHolidayManagement.editDialogTitle') : t('publicHolidayManagement.addDialogTitle')}
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: { xs: 'auto', sm: 400 } }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label={t('publicHolidayManagement.date')}
                  value={formData.date}
                  onChange={(date) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      date: date,
                      year: date ? date.year() : selectedYear
                    }));
                  }}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true, size: isMobile ? 'small' : 'medium' } }}
                />
              </LocalizationProvider>
              <TextField
                label={t('publicHolidayManagement.name')}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                size={isMobile ? 'small' : 'medium'}
                fullWidth
              />
              <TextField
                label={t('publicHolidayManagement.chineseName')}
                value={formData.name_zh}
                onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
                required
                size={isMobile ? 'small' : 'medium'}
                fullWidth
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
              onClick={() => {
                if (!saving) {
                  setOpen(false);
                  setEditing(null);
                  setFormData({
                    date: null,
                    name: '',
                    name_zh: '',
                    year: selectedYear
                  });
                }
              }}
              disabled={saving}
              sx={{ 
                textTransform: 'none',
                width: { xs: '100%', sm: 'auto' }
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              disabled={saving}
              sx={{ 
                textTransform: 'none',
                fontWeight: 600,
                width: { xs: '100%', sm: 'auto' },
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {saving ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  儲存中...
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default PublicHolidayManagement;

