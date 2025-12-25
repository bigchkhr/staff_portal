import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  InputAdornment
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const LeaveTypeSearchDialog = ({ open, onClose, onSelect, selectedLeaveTypeId = null }) => {
  const { t } = useTranslation();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchLeaveTypes();
      setSearchTerm('');
    }
  }, [open]);

  const fetchLeaveTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaveTypes = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    
    if (!trimmedSearch) {
      return leaveTypes;
    }

    return leaveTypes.filter((lt) => {
      const candidates = [
        lt.id?.toString() || '',
        lt.name || '',
        lt.name_zh || '',
        lt.code || '',
        lt.description || ''
      ];

      return candidates.some((candidate) => {
        const value = candidate.toString().toLowerCase();
        return value.includes(trimmedSearch);
      });
    });
  }, [leaveTypes, searchTerm]);

  const handleSelect = (leaveType) => {
    onSelect(leaveType);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('adminPaperFlow.selectLeaveType')}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          placeholder={t('adminPaperFlow.searchLeaveTypePlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {t('common.loading')}
            </Typography>
          ) : filteredLeaveTypes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {t('adminPaperFlow.noLeaveTypesFound')}
            </Typography>
          ) : (
            <List>
              {filteredLeaveTypes.map((leaveType) => (
                <ListItem key={leaveType.id} disablePadding>
                  <ListItemButton
                    selected={selectedLeaveTypeId === leaveType.id}
                    onClick={() => handleSelect(leaveType)}
                  >
                    <ListItemText
                      primary={`${leaveType.name_zh} (${leaveType.name})`}
                      secondary={leaveType.code || ''}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeaveTypeSearchDialog;

