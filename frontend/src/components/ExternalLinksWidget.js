import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Tooltip,
  Chip,
  FormControlLabel,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const emptyForm = {
  name: '',
  narrative: '',
  logo_url: '',
  url: '',
  display_order: 0,
  is_active: true
};

const ExternalLinksWidget = () => {
  const { t } = useTranslation();
  const { isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/external-links/all');
      setLinks(response.data.links || []);
    } catch (error) {
      console.error('Fetch links error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUrl = (url) => {
    if (!url) return '';
    if (url.match(/^https?:\/\//i)) {
      return url;
    }
    return `https://${url}`;
  };

  const handleOpenDialog = (link = null) => {
    if (link) {
      setEditingLink(link);
      setFormData({
        name: link.name || '',
        narrative: link.narrative || '',
        logo_url: link.logo_url || '',
        url: link.url || '',
        display_order: link.display_order || 0,
        is_active: link.is_active !== false
      });
    } else {
      setEditingLink(null);
      setFormData(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingLink(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!formData.name || formData.name.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('externalLinks.pleaseEnterName'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      return;
    }
    if (!formData.url || formData.url.trim() === '') {
      await Swal.fire({
        icon: 'warning',
        title: t('dashboard.news.hint'),
        text: t('externalLinks.pleaseEnterUrl'),
        confirmButtonText: t('dashboard.news.confirm')
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...formData,
        name: formData.name.trim(),
        url: formData.url.trim(),
        logo_url: formData.logo_url && formData.logo_url.trim() ? formData.logo_url.trim() : '',
        narrative: formData.narrative && formData.narrative.trim() ? formData.narrative.trim() : ''
      };

      if (editingLink) {
        await axios.put(`/api/external-links/${editingLink.id}`, payload);
      } else {
        await axios.post('/api/external-links', payload);
      }

      handleCloseDialog();
      await fetchLinks();
      await Swal.fire({
        icon: 'success',
        title: t('dashboard.news.success'),
        text: editingLink ? t('externalLinks.updateSuccess') : t('externalLinks.createSuccess'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Save link error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || (editingLink ? t('externalLinks.updateError') : t('externalLinks.createError')),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event, linkId) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await Swal.fire({
      icon: 'warning',
      title: t('dashboard.news.confirmDelete'),
      text: t('externalLinks.confirmDelete'),
      showCancelButton: true,
      confirmButtonText: t('dashboard.news.confirm'),
      cancelButtonText: t('dashboard.news.cancel'),
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/external-links/${linkId}`);
      await fetchLinks();
      await Swal.fire({
        icon: 'success',
        title: t('dashboard.news.success'),
        text: t('externalLinks.deleteSuccess'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Delete link error:', error);
      await Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('externalLinks.deleteError'),
        confirmButtonText: t('dashboard.news.confirm'),
        confirmButtonColor: '#d33'
      });
    }
  };

  const openLink = (url) => {
    window.open(formatUrl(url), '_blank', 'noopener,noreferrer');
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: { xs: 280, md: 420 },
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5
        }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <LinkIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          {t('tools.externalLinks')}
        </Typography>
        {isSystemAdmin && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            {t('externalLinks.addLink')}
          </Button>
        )}
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading && links.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : links.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('externalLinks.noLinks')}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {links.map((link) => (
              <ListItem
                key={link.id}
                disablePadding
                divider
                sx={{ opacity: link.is_active === false ? 0.55 : 1 }}
                secondaryAction={
                  <Box onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={t('externalLinks.openLink')}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => openLink(link.url)}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isSystemAdmin && (
                      <>
                        <Tooltip title={t('externalLinks.edit')}>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(link)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('externalLinks.delete')}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={(e) => handleDelete(e, link.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                }
              >
                <ListItemButton
                  onClick={() => openLink(link.url)}
                  sx={{ pr: isSystemAdmin ? 14 : 7 }}
                >
                  {link.logo_url ? (
                    <Box
                      component="img"
                      src={link.logo_url}
                      alt={link.name}
                      sx={{
                        width: 32,
                        height: 32,
                        objectFit: 'contain',
                        mr: 1.5,
                        flexShrink: 0
                      }}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <OpenInNewIcon color="primary" sx={{ mr: 1.5, fontSize: 22, flexShrink: 0 }} />
                  )}
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {link.name}
                        </Typography>
                        {isSystemAdmin && link.is_active === false && (
                          <Chip label={t('externalLinks.inactive')} size="small" />
                        )}
                      </Box>
                    }
                    secondary={link.narrative || undefined}
                    secondaryTypographyProps={{
                      noWrap: true,
                      title: link.narrative || undefined
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      {isSystemAdmin && (
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingLink ? t('externalLinks.editDialogTitle') : t('externalLinks.createDialogTitle')}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label={t('externalLinks.name')}
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label={t('externalLinks.url')}
                value={formData.url}
                onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                fullWidth
                required
              />
              <TextField
                label={t('externalLinks.logoUrl')}
                value={formData.logo_url}
                onChange={(e) => setFormData((prev) => ({ ...prev, logo_url: e.target.value }))}
                fullWidth
              />
              <TextField
                label={t('externalLinks.narrative')}
                value={formData.narrative}
                onChange={(e) => setFormData((prev) => ({ ...prev, narrative: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              <TextField
                label={t('externalLinks.displayOrder')}
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData((prev) => ({ ...prev, display_order: parseInt(e.target.value, 10) || 0 }))}
                fullWidth
              />
              {editingLink && (
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                      }
                    />
                  }
                  label={t('externalLinks.activeLabel')}
                />
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button onClick={handleCloseDialog} fullWidth={isMobile}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              disabled={saving || !formData.name || !formData.url}
              fullWidth={isMobile}
            >
              {saving ? <CircularProgress size={20} /> : (editingLink ? t('common.save') : t('externalLinks.create'))}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default ExternalLinksWidget;
