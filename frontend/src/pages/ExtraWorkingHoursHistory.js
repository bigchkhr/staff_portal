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

const ExtraWorkingHoursHistory = () => {
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

      const response = await axios.get('/api/extra-working-hours', { params });
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
      pending: t('extraWorkingHoursHistory.pending'),
      approved: t('extraWorkingHoursHistory.approved'),
      rejected: t('extraWorkingHoursHistory.rejected'),
      cancelled: t('extraWorkingHoursHistory.cancelled')
    };
    return statusMap[status] || status;
  };

  const getFlowTypeText = (app) => {
    if (app.is_paper_flow === true || app.flow_type === 'paper-flow') {
      return t('extraWorkingHoursHistory.paperFlow');
    }
    return t('extraWorkingHoursHistory.eFlow');
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
        app.reason?.toLowerCase().includes(searchLower) ||
        app.description?.toLowerCase().includes(searchLower)
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
              {t('extraWorkingHoursHistory.transactionId')}
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
              {t('extraWorkingHoursHistory.startTime')}
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.start_date, app.start_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('extraWorkingHoursHistory.endTime')}
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.end_date, app.end_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('extraWorkingHoursHistory.totalHours')}
            </Typography>
            <Typography variant="body2">
              {app.total_hours} {t('extraWorkingHoursHistory.hours')}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('extraWorkingHoursHistory.flowType')}
            </Typography>
            <Chip
              label={getFlowTypeText(app)}
              color={app.is_paper_flow === true || app.flow_type === 'paper-flow' ? 'secondary' : 'primary'}
              size="small"
            />
          </Grid>
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
          {t('extraWorkingHoursHistory.title')}
        </Typography>
        
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder={t('extraWorkingHoursHistory.searchPlaceholder')}
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
              <Typography variant="body2">{t('extraWorkingHoursHistory.advancedSearch')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>{t('extraWorkingHoursHistory.status')}</InputLabel>
                    <Select
                      value={filterStatus}
                      label={t('extraWorkingHoursHistory.status')}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="">{t('extraWorkingHoursHistory.all')}</MenuItem>
                      <MenuItem value="pending">{t('extraWorkingHoursHistory.pending')}</MenuItem>
                      <MenuItem value="approved">{t('extraWorkingHoursHistory.approved')}</MenuItem>
                      <MenuItem value="rejected">{t('extraWorkingHoursHistory.rejected')}</MenuItem>
                      <MenuItem value="cancelled">{t('extraWorkingHoursHistory.cancelled')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>{t('extraWorkingHoursHistory.flowType')}</InputLabel>
                    <Select
                      value={filterFlowType}
                      label={t('extraWorkingHoursHistory.flowType')}
                      onChange={(e) => setFilterFlowType(e.target.value)}
                    >
                      <MenuItem value="">{t('extraWorkingHoursHistory.all')}</MenuItem>
                      <MenuItem value="e-flow">{t('extraWorkingHoursHistory.eFlow')}</MenuItem>
                      <MenuItem value="paper-flow">{t('extraWorkingHoursHistory.paperFlow')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('extraWorkingHoursHistory.dateFrom')}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label={t('extraWorkingHoursHistory.dateTo')}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={handleApplyFilter}>
                      {t('extraWorkingHoursHistory.applyFilter')}
                    </Button>
                    <Button variant="outlined" onClick={handleClearFilter}>
                      {t('extraWorkingHoursHistory.clearFilter')}
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
            <Alert severity="info">{t('extraWorkingHoursHistory.noRecords')}</Alert>
          ) : (
            applications.map(renderMobileCard)
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('extraWorkingHoursHistory.transactionId')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.startTime')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.endTime')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.totalHours')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.reason')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.flowType')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.status')}</TableCell>
                <TableCell>{t('extraWorkingHoursHistory.applicationDate')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">{t('extraWorkingHoursHistory.noRecords')}</TableCell>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.total_hours} {t('extraWorkingHoursHistory.hours')}</TableCell>
                    <TableCell>{app.reason || '-'}</TableCell>
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

export default ExtraWorkingHoursHistory;

