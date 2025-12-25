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
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';

const AdminLeaveTypes = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name_zh: '',
    requires_balance: true,
    is_active: true
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/admin/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const handleOpen = () => {
    setEditing(null);
    setFormData({
      code: '',
      name: '',
      name_zh: '',
      requires_balance: true,
      is_active: true
    });
    setOpen(true);
  };

  const handleEdit = (leaveType) => {
    setEditing(leaveType.id);
    setFormData({
      code: leaveType.code,
      name: leaveType.name,
      name_zh: leaveType.name_zh,
      requires_balance: leaveType.requires_balance,
      is_active: leaveType.is_active !== undefined ? leaveType.is_active : true
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await axios.put(`/api/admin/leave-types/${editing}`, formData);
        await Swal.fire({
          icon: 'success',
          title: t('adminLeaveTypes.updateSuccess'),
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
      } else {
        await axios.post('/api/admin/leave-types', formData);
        await Swal.fire({
          icon: 'success',
          title: t('adminLeaveTypes.createSuccess'),
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
      }
      setOpen(false);
      fetchLeaveTypes();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: editing ? t('adminLeaveTypes.updateError') : t('adminLeaveTypes.createError'),
        text: error.response?.data?.message || t('adminLeaveTypes.operationFailed'),
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  return (
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
          {t('adminLeaveTypes.title')}
        </Typography>
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
          {t('adminLeaveTypes.addLeaveType')}
        </Button>
      </Box>

      {isMobile ? (
        // 手機版：卡片式布局
        <Box>
          {leaveTypes.length === 0 ? (
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('adminLeaveTypes.noLeaveTypes')}
              </Typography>
            </Paper>
          ) : (
            leaveTypes.map((lt) => (
              <Card key={lt.id} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('adminLeaveTypes.code')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        {lt.code}
                      </Typography>
                    </Box>
                    <Chip
                      label={lt.is_active ? t('adminLeaveTypes.active') : t('adminLeaveTypes.inactive')}
                      color={lt.is_active ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={1.5}>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('adminLeaveTypes.name')}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {lt.name}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('adminLeaveTypes.chineseName')}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {lt.name_zh}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {t('adminLeaveTypes.requiresBalance')}
                      </Typography>
                      <Chip
                        label={lt.requires_balance ? t('adminLeaveTypes.yes') : t('adminLeaveTypes.no')}
                        color={lt.requires_balance ? 'primary' : 'default'}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 1.5 }} />

                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEdit(lt)}
                  >
                    {t('adminLeaveTypes.edit')}
                  </Button>
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.code')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.name')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.chineseName')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.requiresBalance')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.status')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminLeaveTypes.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaveTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('adminLeaveTypes.noLeaveTypes')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  leaveTypes.map((lt, index) => (
                    <TableRow 
                      key={lt.id}
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
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{lt.code}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{lt.name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{lt.name_zh}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={lt.requires_balance ? t('adminLeaveTypes.yes') : t('adminLeaveTypes.no')}
                          color={lt.requires_balance ? 'primary' : 'default'}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={lt.is_active ? t('adminLeaveTypes.active') : t('adminLeaveTypes.inactive')}
                          color={lt.is_active ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(lt)}
                          color="primary"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white'
                            },
                            transition: 'all 0.2s'
                          }}
                        >
                          <EditIcon fontSize="small" />
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
          {editing ? t('adminLeaveTypes.editDialogTitle') : t('adminLeaveTypes.addDialogTitle')}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: { xs: 'auto', sm: 400 } }}>
            <TextField
              label={t('adminLeaveTypes.code')}
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
              required
              disabled={!!editing}
              size={isMobile ? 'small' : 'medium'}
              fullWidth
            />
            <TextField
              label={t('adminLeaveTypes.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              size={isMobile ? 'small' : 'medium'}
              fullWidth
            />
            <TextField
              label={t('adminLeaveTypes.chineseName')}
              value={formData.name_zh}
              onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
              required
              size={isMobile ? 'small' : 'medium'}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.requires_balance}
                  onChange={(e) => setFormData(prev => ({ ...prev, requires_balance: e.target.checked }))}
                />
              }
              label={t('adminLeaveTypes.requiresBalance')}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label={t('adminLeaveTypes.active')}
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
            {t('adminLeaveTypes.cancel')}
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
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
            {t('adminLeaveTypes.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminLeaveTypes;

