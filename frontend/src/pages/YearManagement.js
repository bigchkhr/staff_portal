import React, { useEffect, useState } from 'react';
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
  Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const emptyForm = {
  year: '',
  is_active: true,
  display_order: 0
};

const YearManagement = () => {
  const { t } = useTranslation();
  const [years, setYears] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchYears();
  }, []);

  const fetchYears = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/system-years?includeInactive=true');
      setYears(response.data || []);
    } catch (error) {
      console.error('Fetch years error:', error);
      alert(error.response?.data?.message || t('yearManagement.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    // 預設填入當前年份
    const currentYear = new Date().getFullYear();
    const existingYears = years.map(y => y.year);
    // 找到下一個可用的年份
    let suggestedYear = currentYear;
    while (existingYears.includes(suggestedYear)) {
      suggestedYear++;
    }
    setFormData({
      ...emptyForm,
      year: suggestedYear.toString()
    });
    setOpen(true);
  };

  const handleOpenEdit = (yearItem) => {
    setEditingId(yearItem.id);
    setFormData({
      year: yearItem.year.toString(),
      is_active: yearItem.is_active,
      display_order: yearItem.display_order || 0
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleChange = (field) => (e) => {
    const value = field === 'is_active' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        year: parseInt(formData.year),
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || 0
      };

      if (!payload.year || isNaN(payload.year)) {
        alert(t('yearManagement.pleaseEnterYear'));
        return;
      }

      if (editingId) {
        await axios.put(`/api/system-years/${editingId}`, payload);
      } else {
        await axios.post('/api/system-years', payload);
      }
      setOpen(false);
      setFormData(emptyForm);
      setEditingId(null);
      fetchYears();
    } catch (error) {
      alert(error.response?.data?.message || t('yearManagement.operationFailed'));
    }
  };

  const handleDelete = async (yearItem) => {
    const ok = window.confirm(
      `${t('yearManagement.confirmDelete')}\n\n${t('yearManagement.year')}: ${yearItem.year}`
    );
    if (!ok) return;

    try {
      await axios.delete(`/api/system-years/${yearItem.id}`);
      fetchYears();
    } catch (error) {
      alert(error.response?.data?.message || t('yearManagement.operationFailed'));
    }
  };

  return (
    <Layout>
      <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1200px', mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography
            variant="h4"
            sx={{
              fontSize: { xs: '1.5rem', sm: '2rem' },
              fontWeight: 600,
              color: 'primary.main'
            }}
          >
            {t('yearManagement.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{
              borderRadius: 1,
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': { boxShadow: 4 }
            }}
          >
            {t('yearManagement.addYear')}
          </Button>
        </Box>

        <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('yearManagement.description')}
          </Typography>
        </Paper>

        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    backgroundColor: 'primary.main',
                    '& .MuiTableCell-head': { color: 'white', fontWeight: 600, fontSize: '0.95rem' }
                  }}
                >
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('yearManagement.year')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('yearManagement.status')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('yearManagement.displayOrder')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('yearManagement.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {years.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {loading ? t('common.loading') : t('yearManagement.noYears')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  years.map((yearItem) => (
                    <TableRow
                      key={yearItem.id}
                      sx={{
                        '&:nth-of-type(even)': { backgroundColor: 'action.hover' },
                        '&:hover': { backgroundColor: 'action.selected' },
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: '1.1rem' }}>
                        {yearItem.year}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Chip
                          label={yearItem.is_active ? t('yearManagement.active') : t('yearManagement.inactive')}
                          color={yearItem.is_active ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{yearItem.display_order || 0}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(yearItem)}
                          color="primary"
                          sx={{
                            '&:hover': { backgroundColor: 'primary.light', color: 'white' },
                            transition: 'all 0.2s'
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(yearItem)}
                          color="error"
                          sx={{
                            '&:hover': { backgroundColor: 'error.light', color: 'white' },
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

        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingId ? t('yearManagement.editYear') : t('yearManagement.addYear')}
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('yearManagement.year')}
                type="number"
                value={formData.year}
                onChange={handleChange('year')}
                fullWidth
                required
                inputProps={{ min: 2000, max: 2100 }}
              />
              <TextField
                label={t('yearManagement.displayOrder')}
                type="number"
                value={formData.display_order}
                onChange={handleChange('display_order')}
                fullWidth
                helperText={t('yearManagement.displayOrderHelper')}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={handleChange('is_active')}
                  />
                }
                label={t('yearManagement.isActive')}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={handleSubmit}>
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default YearManagement;
