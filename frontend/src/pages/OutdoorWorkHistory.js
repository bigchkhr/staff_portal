import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Alert,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress
} from '@mui/material';
import { Search as SearchIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { formatDate } from '../utils/dateFormat';

const OutdoorWorkHistory = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [applications, setApplications] = useState([]);
  const [allApplications, setAllApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // 進階搜尋狀態
  const [advancedSearchExpanded, setAdvancedSearchExpanded] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFlowType, setFilterFlowType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterFlowType) params.flow_type = filterFlowType;
      if (dateFrom) params.start_date_from = dateFrom;
      if (dateTo) params.end_date_to = dateTo;

      const response = await axios.get('/api/outdoor-work', { params });
      const fetchedApplications = response.data.applications || [];
      
      const myApplications = fetchedApplications.filter(app => app.user_id === user.id);
      
      setAllApplications(myApplications);
      setApplications(myApplications);
    } catch (error) {
      console.error('Fetch applications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = () => {
    fetchApplications();
  };

  const handleClearFilter = () => {
    setFilterStatus('');
    setFilterFlowType('');
    setDateFrom('');
    setDateTo('');
    fetchApplications();
  };

  const getStatusColor = (status) => {
    const statusMap = {
      pending: 'warning',
      approved: 'success',
      rejected: 'error',
      cancelled: 'default'
    };
    return statusMap[status] || 'default';
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: t('outdoorWorkHistory.pending'),
      approved: t('outdoorWorkHistory.approved'),
      rejected: t('outdoorWorkHistory.rejected'),
      cancelled: t('outdoorWorkHistory.cancelled')
    };
    return statusMap[status] || status;
  };

  const getFlowTypeText = (app) => {
    if (app.is_paper_flow === true || app.flow_type === 'paper-flow') {
      return t('outdoorWorkHistory.paperFlow');
    }
    return t('outdoorWorkHistory.eFlow');
  };

  const formatDateTime = (date, time) => {
    if (!date) return '-';
    const dateStr = formatDate(date);
    if (time) {
      return `${dateStr} ${time}`;
    }
    return dateStr;
  };

  // 搜尋過濾
  useEffect(() => {
    if (!search.trim()) {
      setApplications(allApplications);
      return;
    }

    const filtered = allApplications.filter(app => {
      const searchLower = search.toLowerCase();
      return (
        app.transaction_id?.toLowerCase().includes(searchLower) ||
        app.applicant_display_name?.toLowerCase().includes(searchLower) ||
        app.start_location?.toLowerCase().includes(searchLower) ||
        app.end_location?.toLowerCase().includes(searchLower) ||
        app.transportation?.toLowerCase().includes(searchLower) ||
        app.purpose?.toLowerCase().includes(searchLower)
      );
    });
    setApplications(filtered);
  }, [search, allApplications]);

  const renderMobileCard = (app) => (
    <Card key={app.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('outdoorWorkHistory.transactionId')}
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              {app.transaction_id}
            </Typography>
          </Box>
          <Chip
            label={getStatusText(app.status)}
            color={getStatusColor(app.status)}
            size="small"
          />
        </Box>
        <Divider sx={{ my: 1 }} />
        <Grid container spacing={1}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('outdoorWorkHistory.startTime')}
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.start_date, app.start_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('outdoorWorkHistory.endTime')}
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.end_date, app.end_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('outdoorWorkHistory.totalHours')}
            </Typography>
            <Typography variant="body2">
              {app.total_hours} {t('outdoorWorkHistory.hours')}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('outdoorWorkHistory.flowType')}
            </Typography>
            <Chip
              label={getFlowTypeText(app)}
              color={app.is_paper_flow === true || app.flow_type === 'paper-flow' ? 'secondary' : 'primary'}
              size="small"
            />
          </Grid>
          {app.start_location && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('outdoorWorkHistory.startLocation')}
              </Typography>
              <Typography variant="body2">
                {app.start_location}
              </Typography>
            </Grid>
          )}
          {app.end_location && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('outdoorWorkHistory.endLocation')}
              </Typography>
              <Typography variant="body2">
                {app.end_location}
              </Typography>
            </Grid>
          )}
          {app.transportation && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('outdoorWorkHistory.transportation')}
              </Typography>
              <Typography variant="body2">
                {app.transportation}
              </Typography>
            </Grid>
          )}
          {app.expense && (
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('outdoorWorkHistory.expense')}
              </Typography>
              <Typography variant="body2">
                ${parseFloat(app.expense).toFixed(2)}
              </Typography>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {t('outdoorWorkHistory.title')}
        </Typography>
        
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder={t('outdoorWorkHistory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <Accordion expanded={advancedSearchExpanded} onChange={(e, expanded) => setAdvancedSearchExpanded(expanded)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">{t('outdoorWorkHistory.advancedSearch')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>{t('outdoorWorkHistory.status')}</InputLabel>
                    <Select
                      value={filterStatus}
                      label={t('outdoorWorkHistory.status')}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="">{t('outdoorWorkHistory.all')}</MenuItem>
                      <MenuItem value="pending">{t('outdoorWorkHistory.pending')}</MenuItem>
                      <MenuItem value="approved">{t('outdoorWorkHistory.approved')}</MenuItem>
                      <MenuItem value="rejected">{t('outdoorWorkHistory.rejected')}</MenuItem>
                      <MenuItem value="cancelled">{t('outdoorWorkHistory.cancelled')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>{t('outdoorWorkHistory.flowType')}</InputLabel>
                    <Select
                      value={filterFlowType}
                      label={t('outdoorWorkHistory.flowType')}
                      onChange={(e) => setFilterFlowType(e.target.value)}
                    >
                      <MenuItem value="">{t('outdoorWorkHistory.all')}</MenuItem>
                      <MenuItem value="e-flow">{t('outdoorWorkHistory.eFlow')}</MenuItem>
                      <MenuItem value="paper-flow">{t('outdoorWorkHistory.paperFlow')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('outdoorWorkHistory.dateFrom')}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('outdoorWorkHistory.dateTo')}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={handleApplyFilter}>
                      {t('outdoorWorkHistory.applyFilter')}
                    </Button>
                    <Button variant="outlined" onClick={handleClearFilter}>
                      {t('outdoorWorkHistory.clearFilter')}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      </Paper>

      {isMobile ? (
        <Box>
          {applications.length === 0 ? (
            <Alert severity="info">{t('outdoorWorkHistory.noRecords')}</Alert>
          ) : (
            applications.map(renderMobileCard)
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('outdoorWorkHistory.transactionId')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.startTime')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.endTime')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.totalHours')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.startLocation')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.endLocation')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.transportation')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.expense')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.purpose')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.flowType')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.status')}</TableCell>
                <TableCell>{t('outdoorWorkHistory.applicationDate')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} align="center">{t('outdoorWorkHistory.noRecords')}</TableCell>
                </TableRow>
              ) : (
                applications.map((app) => (
                  <TableRow key={app.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.transaction_id}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(app.start_date, app.start_time)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(app.end_date, app.end_time)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.total_hours} {t('outdoorWorkHistory.hours')}</TableCell>
                    <TableCell>{app.start_location || '-'}</TableCell>
                    <TableCell>{app.end_location || '-'}</TableCell>
                    <TableCell>{app.transportation || '-'}</TableCell>
                    <TableCell>{app.expense ? `$${parseFloat(app.expense).toFixed(2)}` : '-'}</TableCell>
                    <TableCell>{app.purpose || '-'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={getFlowTypeText(app)}
                        color={app.is_paper_flow === true || app.flow_type === 'paper-flow' ? 'secondary' : 'primary'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={getStatusText(app.status)}
                        color={getStatusColor(app.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {app.application_date ? formatDate(app.application_date) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

export default OutdoorWorkHistory;

