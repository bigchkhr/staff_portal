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
  FormControlLabel,
  Switch,
  Chip
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const emptyForm = {
  code: '',
  name: '',
  name_zh: '',
  description: '',
  display_order: '0',
  is_active: true
};

const AdminShiftDutyRoles = () => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(emptyForm);

  const fetchRoles = async () => {
    try {
      const response = await axios.get('/api/admin/shift-duty-roles');
      setRoles(response.data.roles || []);
    } catch (error) {
      alert(error.response?.data?.message || t('shiftDutyRoles.operationFailed'));
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await axios.get('/api/admin/shift-duty-roles');
        if (active) setRoles(response.data.roles || []);
      } catch (error) {
        if (active) alert(error.response?.data?.message || t('shiftDutyRoles.operationFailed'));
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [t]);

  const filteredRoles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) => {
      const hay = [role.code, role.name, role.name_zh, role.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [roles, searchTerm]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormData(emptyForm);
    setOpen(true);
  };

  const handleOpenEdit = (role) => {
    setEditing(role);
    setFormData({
      code: role.code || '',
      name: role.name || '',
      name_zh: role.name_zh || '',
      description: role.description || '',
      display_order: role.display_order != null ? String(role.display_order) : '0',
      is_active: role.is_active !== false
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      code: formData.code.trim() || null,
      name: formData.name.trim(),
      name_zh: formData.name_zh.trim(),
      description: formData.description.trim() || null,
      display_order: parseInt(formData.display_order, 10) || 0,
      is_active: !!formData.is_active
    };
    if (!payload.name || !payload.name_zh) {
      alert(t('shiftDutyRoles.nameRequired'));
      return;
    }
    try {
      if (editing) {
        await axios.put(`/api/admin/shift-duty-roles/${editing.id}`, payload);
      } else {
        await axios.post('/api/admin/shift-duty-roles', payload);
      }
      setOpen(false);
      fetchRoles();
    } catch (error) {
      alert(error.response?.data?.message || t('shiftDutyRoles.operationFailed'));
    }
  };

  const handleDelete = async (role) => {
    const label = role.name_zh || role.name;
    if (!window.confirm(t('shiftDutyRoles.confirmDelete', { name: label }))) return;
    try {
      await axios.delete(`/api/admin/shift-duty-roles/${role.id}`);
      fetchRoles();
    } catch (error) {
      alert(error.response?.data?.message || t('shiftDutyRoles.operationFailed'));
    }
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1200px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' }, fontWeight: 600, color: 'primary.main' }}>
          {t('shiftDutyRoles.title')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          {t('shiftDutyRoles.add')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('shiftDutyRoles.subtitle')}
      </Typography>
      <TextField
        size="small"
        label={t('common.search')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2, minWidth: 240 }}
      />
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('shiftDutyRoles.displayOrder')}</TableCell>
                <TableCell>{t('shiftDutyRoles.code')}</TableCell>
                <TableCell>{t('shiftDutyRoles.nameZh')}</TableCell>
                <TableCell>{t('shiftDutyRoles.name')}</TableCell>
                <TableCell>{t('shiftDutyRoles.status')}</TableCell>
                <TableCell align="right">{t('shiftDutyRoles.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    {t('shiftDutyRoles.empty')}
                  </TableCell>
                </TableRow>
              ) : filteredRoles.map((role) => (
                <TableRow key={role.id} hover>
                  <TableCell>{role.display_order}</TableCell>
                  <TableCell>{role.code || '—'}</TableCell>
                  <TableCell>{role.name_zh}</TableCell>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={role.is_active ? t('shiftDutyRoles.active') : t('shiftDutyRoles.inactive')}
                      color={role.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton onClick={() => handleOpenEdit(role)} aria-label={t('common.edit')}>
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDelete(role)} aria-label={t('common.delete')} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? t('shiftDutyRoles.edit') : t('shiftDutyRoles.add')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('shiftDutyRoles.nameZh')}
              value={formData.name_zh}
              onChange={(e) => setFormData((prev) => ({ ...prev, name_zh: e.target.value }))}
              required
            />
            <TextField
              label={t('shiftDutyRoles.name')}
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label={t('shiftDutyRoles.code')}
              value={formData.code}
              onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
              helperText={t('shiftDutyRoles.codeHelper')}
            />
            <TextField
              label={t('shiftDutyRoles.description')}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              rows={2}
            />
            <TextField
              label={t('shiftDutyRoles.displayOrder')}
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData((prev) => ({ ...prev, display_order: e.target.value }))}
              inputProps={{ min: 0 }}
              helperText={t('shiftDutyRoles.displayOrderHelper')}
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={formData.is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
              )}
              label={t('shiftDutyRoles.active')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminShiftDutyRoles;
