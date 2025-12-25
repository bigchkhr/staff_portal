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
  TextField
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const AdminDepartments = () => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    name_zh: '',
    description: ''
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/admin/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Fetch departments error:', error);
    }
  };

  const handleOpen = () => {
    setEditing(null);
    setFormData({ name: '', name_zh: '', description: '' });
    setOpen(true);
  };

  const handleEdit = (dept) => {
    setEditing(dept.id);
    setFormData({
      name: dept.name,
      name_zh: dept.name_zh,
      description: dept.description || ''
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await axios.put(`/api/admin/departments/${editing}`, formData);
      } else {
        await axios.post('/api/admin/departments', formData);
      }
      setOpen(false);
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.message || t('adminDepartments.operationFailed'));
    }
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography 
          variant="h4"
          sx={{ 
            fontSize: { xs: '1.5rem', sm: '2rem' },
            fontWeight: 600,
            color: 'primary.main'
          }}
        >
          {t('adminDepartments.title')}
        </Typography>
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
          {t('adminDepartments.addDepartment')}
        </Button>
      </Box>

      <Paper 
        elevation={2}
        sx={{ 
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ 
                backgroundColor: 'primary.main',
                '& .MuiTableCell-head': {
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }
              }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminDepartments.name')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminDepartments.chineseName')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminDepartments.description')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminDepartments.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('adminDepartments.noDepartments') || '沒有部門'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((dept, index) => (
                  <TableRow 
                    key={dept.id}
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
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{dept.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{dept.name_zh}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{dept.description || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton 
                        size="small" 
                        onClick={() => handleEdit(dept)}
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

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? t('adminDepartments.editDialogTitle') : t('adminDepartments.addDialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 400 }}>
            <TextField
              label={t('adminDepartments.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label={t('adminDepartments.chineseName')}
              value={formData.name_zh}
              onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
              required
            />
            <TextField
              label={t('adminDepartments.description')}
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('adminDepartments.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('adminDepartments.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDepartments;

