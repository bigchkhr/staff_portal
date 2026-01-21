import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip
} from '@mui/material';
import { Search as SearchIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const StoreDirectory = () => {
  const { t } = useTranslation();
  const [stores, setStores] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [districtFilter, setDistrictFilter] = useState('all');

  useEffect(() => {
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Fetch stores error:', error);
      alert(error.response?.data?.message || t('storeDirectory.fetchFailed'));
    }
  };

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
        s.email,
        s.address_chi,
        s.address_en
      ]
        .filter(Boolean)
        .map((v) => String(v).toLowerCase())
        .join(' ');

      return hay.includes(q);
    });
  }, [stores, searchText, districtFilter]);

  const copyToClipboard = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // fallback
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };

  return (
    <Layout>
      <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1600px', mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2, color: 'primary.main', fontWeight: 600 }}>
          {t('storeDirectory.title')}
        </Typography>

        <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <InputLabel>{t('storeDirectory.district')}</InputLabel>
              <Select
                label={t('storeDirectory.district')}
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

            <Typography variant="body2" color="text.secondary" sx={{ flex: '0 0 auto' }}>
              {t('storeDirectory.count', { count: filteredStores.length })}
            </Typography>
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('storeDirectory.storeCode')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('storeDirectory.shortName')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('storeDirectory.district')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('storeDirectory.tel')}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('storeDirectory.email')}</TableCell>
                  <TableCell>{t('storeDirectory.address')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('storeDirectory.noStores')}
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
                      <TableCell sx={{ minWidth: 320 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                              {store.address_en || '-'}
                            </Typography>
                            <Tooltip title="複製">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!store.address_en}
                                  onClick={() => copyToClipboard(store.address_en)}
                                >
                                  <ContentCopyIcon fontSize="inherit" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                              {store.address_chi || '-'}
                            </Typography>
                            <Tooltip title="複製">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!store.address_chi}
                                  onClick={() => copyToClipboard(store.address_chi)}
                                >
                                  <ContentCopyIcon fontSize="inherit" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Layout>
  );
};

export default StoreDirectory;


