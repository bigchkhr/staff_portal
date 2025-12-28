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
      pending: '待批核',
      approved: '已批准',
      rejected: '已拒絕',
      cancelled: '已取消'
    };
    return statusMap[status] || status;
  };

  const getFlowTypeText = (app) => {
    if (app.is_paper_flow === true || app.flow_type === 'paper-flow') {
      return '紙本流程';
    }
    return '電子流程';
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
              交易編號
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
              開始時間
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.start_date, app.start_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              結束時間
            </Typography>
            <Typography variant="body2">
              {formatDateTime(app.end_date, app.end_time)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              總時數
            </Typography>
            <Typography variant="body2">
              {app.total_hours} 小時
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary" display="block">
              流程類型
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
          額外工作時數申報歷史
        </Typography>
        
        <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="搜尋交易編號、申請人、原因..."
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
              <Typography variant="body2">進階搜尋</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>狀態</InputLabel>
                    <Select
                      value={filterStatus}
                      label="狀態"
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="">全部</MenuItem>
                      <MenuItem value="pending">待批核</MenuItem>
                      <MenuItem value="approved">已批准</MenuItem>
                      <MenuItem value="rejected">已拒絕</MenuItem>
                      <MenuItem value="cancelled">已取消</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>流程類型</InputLabel>
                    <Select
                      value={filterFlowType}
                      label="流程類型"
                      onChange={(e) => setFilterFlowType(e.target.value)}
                    >
                      <MenuItem value="">全部</MenuItem>
                      <MenuItem value="e-flow">電子流程</MenuItem>
                      <MenuItem value="paper-flow">紙本流程</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="開始日期（從）"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="結束日期（到）"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained" onClick={handleApplyFilter}>
                      套用篩選
                    </Button>
                    <Button variant="outlined" onClick={handleClearFilter}>
                      清除
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
            <Alert severity="info">沒有找到申請記錄</Alert>
          ) : (
            applications.map(renderMobileCard)
          )}
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>交易編號</TableCell>
                <TableCell>開始時間</TableCell>
                <TableCell>結束時間</TableCell>
                <TableCell>總時數</TableCell>
                <TableCell>額外工作原因</TableCell>
                <TableCell>流程類型</TableCell>
                <TableCell>狀態</TableCell>
                <TableCell>申請日期</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">沒有找到申請記錄</TableCell>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{app.total_hours} 小時</TableCell>
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

