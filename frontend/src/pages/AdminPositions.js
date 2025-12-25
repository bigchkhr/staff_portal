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

const AdminPositions = () => {
  const { t } = useTranslation();
  const [positions, setPositions] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    name_zh: '',
    description: ''
  });

  const trimmedSearch = searchTerm.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const filteredPositions = positions.filter((pos) => {
    if (!trimmedSearch) {
      return true;
    }

    const candidates = [
      pos.id?.toString() || '',
      pos.name || '',
      pos.name_zh || '',
      pos.description || ''
    ];

    return candidates.some((candidate) => {
      const value = candidate.toString();
      return (
        value.toLowerCase().includes(normalizedSearch) ||
        value.includes(trimmedSearch)
      );
    });
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    try {
      const response = await axios.get('/api/admin/positions');
      setPositions(response.data.positions || []);
    } catch (error) {
      console.error('Fetch positions error:', error);
    }
  };

  const handleOpen = () => {
    setEditing(null);
    setFormData({ name: '', name_zh: '', description: '' });
    setOpen(true);
  };

  const handleEdit = (pos) => {
    setEditing(pos.id);
    setFormData({
      name: pos.name,
      name_zh: pos.name_zh,
      description: pos.description || ''
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await axios.put(`/api/admin/positions/${editing}`, formData);
      } else {
        await axios.post('/api/admin/positions', formData);
      }
      setOpen(false);
      fetchPositions();
    } catch (error) {
      alert(error.response?.data?.message || t('adminPositions.operationFailed'));
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2
        }}
      >
        <Typography variant="h5" sx={{ flexGrow: 1 }}>
          {t('adminPositions.title')}
        </Typography>
        <TextField
          size="small"
          placeholder={t('adminPositions.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>
          {t('adminPositions.addPosition')}
        </Button>
      </Box>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('adminPositions.name')}</TableCell>
                <TableCell>{t('adminPositions.chineseName')}</TableCell>
                <TableCell>{t('adminPositions.description')}</TableCell>
                <TableCell>{t('adminPositions.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPositions.map((pos) => (
                <TableRow key={pos.id}>
                  <TableCell>{pos.name}</TableCell>
                  <TableCell>{pos.name_zh}</TableCell>
                  <TableCell>{pos.description || '-'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => handleEdit(pos)}>
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{editing ? t('adminPositions.editDialogTitle') : t('adminPositions.addDialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, minWidth: 400 }}>
            <TextField
              label={t('adminPositions.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label={t('adminPositions.chineseName')}
              value={formData.name_zh}
              onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
              required
            />
            <TextField
              label={t('adminPositions.description')}
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('adminPositions.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('adminPositions.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPositions;

