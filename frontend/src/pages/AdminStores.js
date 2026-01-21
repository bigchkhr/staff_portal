import React, { useEffect, useMemo, useState } from 'react';
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
  Switch
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const emptyForm = {
  store_code: '',
  store_short_name_: '',
  address_en: '',
  address_chi: '',
  tel: '',
  email: '',
  open_date: '',
  close_date: '',
  district: '',
  is_closed: false
};

const AdminStores = () => {
  const { t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchText, setSearchText] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/admin/stores');
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Fetch stores error:', error);
      alert(error.response?.data?.message || t('adminStores.operationFailed'));
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setOpen(true);
  };

  const handleOpenEdit = (store) => {
    setEditingId(store.id);
    setFormData({
      store_code: store.store_code || '',
      store_short_name_: store.store_short_name_ || '',
      address_en: store.address_en || '',
      address_chi: store.address_chi || '',
      tel: store.tel || '',
      email: store.email || '',
      open_date: store.open_date ? String(store.open_date).slice(0, 10) : '',
      close_date: store.close_date ? String(store.close_date).slice(0, 10) : '',
      district: store.district || '',
      is_closed: !!store.is_closed
    });
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleChange = (field) => (e) => {
    const value = field === 'is_closed' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const payload = useMemo(() => {
    return {
      ...formData,
      store_code: formData.store_code?.trim(),
      store_short_name_: formData.store_short_name_?.trim() || null,
      address_en: formData.address_en?.trim() || null,
      address_chi: formData.address_chi?.trim() || null,
      tel: formData.tel?.trim() || null,
      email: formData.email?.trim() || null,
      open_date: formData.open_date || null,
      close_date: formData.close_date || null,
      district: formData.district?.trim() || null,
      is_closed: !!formData.is_closed
    };
  }, [formData]);

  const districtOptions = useMemo(() => {
    const districts = (stores || [])
      .map((s) => (s.district ? String(s.district).trim() : ''))
      .filter((v) => v);
    return Array.from(new Set(districts)).sort((a, b) => a.localeCompare(b));
  }, [stores]);

  const filteredStores = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    return (stores || []).filter((s) => {
      if (districtFilter !== 'all') {
        const d = s.district ? String(s.district).trim() : '';
        if (d !== districtFilter) return false;
      }

      if (!q) return true;

      const hay = [
        s.store_code,
        s.store_short_name_,
        s.district,
        s.tel,
        s.email
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(' ');

      return hay.includes(q);
    });
  }, [stores, searchText, districtFilter]);

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await axios.put(`/api/admin/stores/${editingId}`, payload);
      } else {
        await axios.post('/api/admin/stores', payload);
      }
      setOpen(false);
      fetchStores();
    } catch (error) {
      alert(error.response?.data?.message || t('adminStores.operationFailed'));
    }
  };

  const handleDelete = async (store) => {
    const ok = window.confirm(
      `${t('adminStores.confirmDelete')}\n\n${t('adminStores.storeCode')}: ${store.store_code}`
    );
    if (!ok) return;

    try {
      await axios.delete(`/api/admin/stores/${store.id}`);
      fetchStores();
    } catch (error) {
      alert(error.response?.data?.message || t('adminStores.operationFailed'));
    }
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontSize: { xs: '1.5rem', sm: '2rem' },
            fontWeight: 600,
            color: 'primary.main'
          }}
        >
          {t('adminStores.title')}
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
          {t('adminStores.addStore')}
        </Button>
      </Box>

      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <TextField
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('common.search')}
            size="small"
            sx={{ flex: '1 1 320px', minWidth: 240 }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" style={{ marginRight: 8, opacity: 0.7 }} />
            }}
          />

          <FormControl size="small" sx={{ minWidth: 220, flex: '0 0 auto' }}>
            <InputLabel>{t('adminStores.district')}</InputLabel>
            <Select
              label={t('adminStores.district')}
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
            >
              <MenuItem value="all">{t('common.all')}</MenuItem>
              {districtOptions.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
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
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.storeCode')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.shortName')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.district')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.tel')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.email')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.isClosed')}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminStores.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredStores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('adminStores.noStores')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredStores.map((store) => (
                  <TableRow
                    key={store.id}
                    sx={{
                      '&:nth-of-type(even)': { backgroundColor: 'action.hover' },
                      '&:hover': { backgroundColor: 'action.selected' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{store.store_code}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{store.store_short_name_ || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{store.district || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{store.tel || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{store.email || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{store.is_closed ? t('common.yes') : t('common.no')}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenEdit(store)}
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
                        onClick={() => handleDelete(store)}
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

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingId ? t('adminStores.editStore') : t('adminStores.addStore')}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label={t('adminStores.storeCode')}
              value={formData.store_code}
              onChange={handleChange('store_code')}
              fullWidth
              required
            />
            <TextField
              label={t('adminStores.shortName')}
              value={formData.store_short_name_}
              onChange={handleChange('store_short_name_')}
              fullWidth
            />
            <TextField
              label={t('adminStores.district')}
              value={formData.district}
              onChange={handleChange('district')}
              fullWidth
            />
            <TextField
              label={t('adminStores.tel')}
              value={formData.tel}
              onChange={handleChange('tel')}
              fullWidth
            />
            <TextField
              label={t('adminStores.email')}
              value={formData.email}
              onChange={handleChange('email')}
              fullWidth
            />
            <TextField
              label={t('adminStores.openDate')}
              type="date"
              value={formData.open_date}
              onChange={handleChange('open_date')}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('adminStores.closeDate')}
              type="date"
              value={formData.close_date}
              onChange={handleChange('close_date')}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <FormControlLabel
              control={<Switch checked={!!formData.is_closed} onChange={handleChange('is_closed')} />}
              label={t('adminStores.isClosed')}
            />
            <TextField
              label={t('adminStores.addressEn')}
              value={formData.address_en}
              onChange={handleChange('address_en')}
              fullWidth
              multiline
              minRows={2}
              sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}
            />
            <TextField
              label={t('adminStores.addressChi')}
              value={formData.address_chi}
              onChange={handleChange('address_chi')}
              fullWidth
              multiline
              minRows={2}
              sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}
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
  );
};

export default AdminStores;


