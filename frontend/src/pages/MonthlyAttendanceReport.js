import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Grid,
  Card,
  Divider,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Pagination,
  Stack
} from '@mui/material';
import { 
  Save as SaveIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import Layout from '../components/Layout';
import dayjs from 'dayjs';

const MonthlyAttendanceReport = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 列表模式狀態
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().tz('Asia/Hong_Kong').year());
  const [selectedMonth, setSelectedMonth] = useState(() => (dayjs().tz('Asia/Hong_Kong').month() + 1).toString());
  const [searchInput, setSearchInput] = useState(''); // 輸入框的值
  const [activeSearchKeyword, setActiveSearchKeyword] = useState(''); // 實際用於過濾的值
  const [loadingReports, setLoadingReports] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 15;

  // 詳情模式狀態
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // 表單數據
  const [formData, setFormData] = useState({
    ft_overtime_hours: 0,
    pt_work_hours: 0,
    store_manager_allowance: 0,
    attendance_bonus: 0,
    location_allowance: 0,
    incentive: 0,
    special_allowance: 0,
    remarks: ''
  });

  // 如果是列表模式，獲取用戶列表和報告列表
  useEffect(() => {
    if (!id) {
      fetchUsers();
      fetchReports();
    }
  }, [id]);

  // 當搜索條件改變時，重新獲取報告列表並重置到第一頁
  useEffect(() => {
    if (!id) {
      setPage(1); // 重置到第一頁
      fetchReports();
    }
  }, [selectedUserId, selectedYear, selectedMonth, id]);

  // 如果是詳情模式，獲取單個報告
  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/monthly-attendance-reports/${id}`);
      const reportData = response.data.report;
      setReport(reportData);
      
      // 設置表單數據
      setFormData({
        ft_overtime_hours: reportData.ft_overtime_hours || 0,
        pt_work_hours: reportData.pt_work_hours || 0,
        store_manager_allowance: reportData.store_manager_allowance || 0,
        attendance_bonus: reportData.attendance_bonus || 0,
        location_allowance: reportData.location_allowance || 0,
        incentive: reportData.incentive || 0,
        special_allowance: reportData.special_allowance || 0,
        remarks: reportData.remarks || ''
      });
    } catch (error) {
      console.error('Fetch report error:', error);
      setError(error.response?.data?.message || t('attendance.fetchReportFailed'));
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || t('attendance.fetchReportFailed')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`/api/monthly-attendance-reports/${id}`, formData);
      
      Swal.fire({
        icon: 'success',
        title: t('attendance.success'),
        text: t('attendance.reportUpdated')
      });
      
      // 重新載入數據
      await fetchReport();
    } catch (error) {
      console.error('Save report error:', error);
        Swal.fire({
          icon: 'error',
          title: t('attendance.error'),
          text: error.response?.data?.message || t('attendance.updateReportFailed')
        });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: t('attendance.confirmDelete'),
      text: t('attendance.deleteReportConfirm'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d32f2f',
      cancelButtonColor: '#grey',
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/api/monthly-attendance-reports/${id}`);
        
        Swal.fire({
          icon: 'success',
          title: t('attendance.success'),
          text: t('attendance.reportDeleted')
        });
        
        // 返回列表頁面
        navigate('/monthly-attendance-report');
      } catch (error) {
        console.error('Delete report error:', error);
        Swal.fire({
          icon: 'error',
          title: t('attendance.error'),
          text: error.response?.data?.message || t('attendance.deleteReportFailed')
        });
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按 ID 降序排序（最新用戶排在最前），與 UserSearchDialog 保持一致
      usersList.sort((a, b) => b.id - a.id);
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || '獲取員工列表失敗'
      });
    }
  };

  const fetchReports = async () => {
    try {
      setLoadingReports(true);
      const params = {};
      if (selectedUserId) params.user_id = selectedUserId;
      if (selectedYear) params.year = selectedYear;
      if (selectedMonth) params.month = parseInt(selectedMonth, 10);

      const response = await axios.get('/api/monthly-attendance-reports', { params });
      setReports(response.data.reports || []);
    } catch (error) {
      console.error('Fetch reports error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error'),
        text: error.response?.data?.message || t('attendance.fetchReportFailed')
      });
    } finally {
      setLoadingReports(false);
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: field === 'remarks' ? value : parseFloat(value) || 0
    }));
  };

  // 過濾報告列表（根據搜索關鍵字）
  const filteredReports = reports.filter(report => {
    if (!activeSearchKeyword) return true;
    const keyword = activeSearchKeyword.toLowerCase();
    const employeeNumber = (report.user?.employee_number || '').toLowerCase();
    const displayName = (report.user?.display_name || '').toLowerCase();
    const nameZh = (report.user?.name_zh || '').toLowerCase();
    return employeeNumber.includes(keyword) || 
           displayName.includes(keyword) || 
           nameZh.includes(keyword);
  });

  // 計算分頁
  const totalPages = Math.ceil(filteredReports.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, endIndex);

  // 當搜索關鍵字改變時，重置到第一頁
  useEffect(() => {
    setPage(1);
  }, [activeSearchKeyword]);

  // 處理搜索按鈕點擊
  const handleSearch = () => {
    setActiveSearchKeyword(searchInput);
    setPage(1); // 重置到第一頁
  };

  // 處理清除搜索
  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearchKeyword('');
    setPage(1);
  };

  // 處理 Enter 鍵搜索
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 當過濾結果改變時，確保頁碼不超出範圍
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(1);
    }
  }, [totalPages, page]);

  const handlePageChange = (event, value) => {
    setPage(value);
    // 滾動到頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const monthNames = i18n.language === 'en' 
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  // 如果是列表模式，顯示列表頁面
  if (!id) {
    return (
      <Layout>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', mb: 4 }}>
              {t('attendance.monthlyReport')}
            </Typography>

            {/* 搜索和篩選區域 */}
            <Card elevation={1} sx={{ p: 3, mb: 3 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    options={users}
                    getOptionLabel={(option) => 
                      `${option.employee_number || ''} - ${option.display_name || option.name_zh || option.name || ''}`
                    }
                    value={users.find(u => u.id === selectedUserId) || null}
                    onChange={(event, newValue) => {
                      setSelectedUserId(newValue ? newValue.id : null);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('attendance.selectEmployee') || '選擇員工'}
                        placeholder={t('attendance.selectEmployee') || '選擇員工'}
                      />
                    )}
                    filterOptions={(options, { inputValue }) => {
                      if (!inputValue) return options;
                      const searchLower = inputValue.toLowerCase();
                      return options.filter((u) => {
                        const employeeNumber = (u.employee_number || '').toLowerCase();
                        const displayName = (u.display_name || '').toLowerCase();
                        const nameZh = (u.name_zh || '').toLowerCase();
                        const name = (u.name || '').toLowerCase();
                        const givenName = (u.given_name || '').toLowerCase();
                        const surname = (u.surname || '').toLowerCase();
                        const alias = (u.alias || '').toLowerCase();
                        
                        return (
                          employeeNumber.includes(searchLower) ||
                          displayName.includes(searchLower) ||
                          nameZh.includes(searchLower) ||
                          name.includes(searchLower) ||
                          givenName.includes(searchLower) ||
                          surname.includes(searchLower) ||
                          alias.includes(searchLower) ||
                          `${surname} ${givenName}`.trim().includes(searchLower) ||
                          `${givenName} ${surname}`.trim().includes(searchLower)
                        );
                      });
                    }}
                    noOptionsText={t('attendance.noUsersFound') || '找不到員工'}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    label={t('attendance.year') || '年份'}
                    type="number"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10) || '')}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>{t('attendance.month') || '月份'}</InputLabel>
                    <Select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      label={t('attendance.month') || '月份'}
                    >
                      <MenuItem value="">{t('attendance.allMonths') || '全部月份'}</MenuItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <MenuItem key={m} value={m.toString()}>
                          {monthNames[m - 1]}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                      fullWidth
                      placeholder={t('attendance.searchPlaceholder') || '搜索員工編號或姓名...'}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyPress={handleSearchKeyPress}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary' }} />
                          </InputAdornment>
                        )
                      }}
                    />
                    <Button
                      variant="contained"
                      startIcon={<SearchIcon />}
                      onClick={handleSearch}
                      sx={{ minWidth: 100 }}
                    >
                      {t('common.search') || '搜尋'}
                    </Button>
                    {activeSearchKeyword && (
                      <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={handleClearSearch}
                        sx={{ minWidth: 100 }}
                      >
                        {t('common.reset') || '清除'}
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </Card>

            {/* 報告列表 */}
            {loadingReports ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <CircularProgress />
              </Box>
            ) : filteredReports.length === 0 ? (
              <Alert severity="info">{t('attendance.noReportsFound') || '找不到月報記錄'}</Alert>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('attendance.employeeNumber') || '員工編號'}</TableCell>
                        <TableCell>{t('attendance.employeeName') || '員工姓名'}</TableCell>
                        <TableCell>{t('attendance.year') || '年份'}</TableCell>
                        <TableCell>{t('attendance.month') || '月份'}</TableCell>
                        <TableCell align="right">{t('common.actions') || '操作'}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedReports.map((report) => (
                        <TableRow key={report.id} hover>
                          <TableCell>{report.user?.employee_number || '-'}</TableCell>
                          <TableCell>{report.user?.display_name || report.user?.name_zh || '-'}</TableCell>
                          <TableCell>{report.year}</TableCell>
                          <TableCell>{monthNames[report.month - 1]}</TableCell>
                          <TableCell align="right">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<VisibilityIcon />}
                              onClick={() => navigate(`/monthly-attendance-report/${report.id}`)}
                            >
                              {t('common.view') || '查看'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                
                {/* 分頁組件 */}
                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('attendance.showingResults') || '顯示'} {startIndex + 1} - {Math.min(endIndex, filteredReports.length)} {t('attendance.of') || '共'} {filteredReports.length} {t('attendance.results') || '筆記錄'}
                    </Typography>
                    <Stack spacing={2}>
                      <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                      />
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </Paper>
        </Container>
      </Layout>
    );
  }

  // 詳情模式：顯示單個報告
  if (loading) {
    return (
      <Layout>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        </Container>
      </Layout>
    );
  }

  if (error || !report) {
    return (
      <Layout>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
          <Alert severity="error">{error || t('attendance.reportNotFound')}</Alert>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/monthly-attendance-summary')}
            sx={{ mt: 2 }}
          >
            {t('attendance.backToMonthlySummary')}
          </Button>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          {/* 標題和操作按鈕 */}
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('attendance.monthlyReport')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {report.user?.employee_number || ''} - {report.user?.display_name || report.user?.name_zh || ''} | {report.year}{i18n.language === 'en' ? ' ' : '年'}{monthNames[report.month - 1]}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/monthly-attendance-report')}
              >
                {t('common.back')}
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
              >
                {t('common.delete')}
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 4 }} />

          {/* 假期統計（只讀） */}
          <Card elevation={1} sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              {t('attendance.leaveStatistics')}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.annualLeave')}</Typography>
                <Typography variant="h6">{report.annual_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.birthdayLeave')}</Typography>
                <Typography variant="h6">{report.birthday_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.compensatoryLeave')}</Typography>
                <Typography variant="h6">{report.compensatory_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.fullPaidSickLeave')}</Typography>
                <Typography variant="h6">{report.full_paid_sick_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.sickLeaveWithAllowance')}</Typography>
                <Typography variant="h6">{report.sick_leave_with_allowance_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.noPaySickLeave')}</Typography>
                <Typography variant="h6">{report.no_pay_sick_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.workInjuryLeave')}</Typography>
                <Typography variant="h6">{report.work_injury_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.marriageLeave')}</Typography>
                <Typography variant="h6">{report.marriage_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.maternityLeave')}</Typography>
                <Typography variant="h6">{report.maternity_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.paternityLeave')}</Typography>
                <Typography variant="h6">{report.paternity_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.juryServiceLeave')}</Typography>
                <Typography variant="h6">{report.jury_service_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.compassionateLeave')}</Typography>
                <Typography variant="h6">{report.compassionate_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.noPayPersonalLeave')}</Typography>
                <Typography variant="h6">{report.no_pay_personal_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.specialLeave')}</Typography>
                <Typography variant="h6">{report.special_leave_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.currentRestDays')}</Typography>
                <Typography variant="h6">{report.current_rest_days_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.accumulatedRestDays')}</Typography>
                <Typography variant="h6">{report.accumulated_rest_days_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.statutoryHoliday')}</Typography>
                <Typography variant="h6">{report.statutory_holiday_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.absent')}</Typography>
                <Typography variant="h6">{report.absent_days || 0} {t('attendance.days')}</Typography>
              </Grid>
            </Grid>
          </Card>

          {/* 工作統計（只讀） */}
          <Card elevation={1} sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              {t('attendance.workStatistics')}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.workDays')}</Typography>
                <Typography variant="h6">{report.work_days || 0} {t('attendance.days')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.lateCount')}</Typography>
                <Typography variant="h6">{report.late_count || 0} {t('attendance.times')}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="body2" color="text.secondary">{t('attendance.lateTotalMinutes')}</Typography>
                <Typography variant="h6">{Math.round(report.late_total_minutes || 0)} {t('attendance.minutes')}</Typography>
              </Grid>
              {/* FT 超時工作時數 - 所有 FT 員工都顯示 */}
              {(() => {
                const employmentMode = (report.user?.position_employment_mode || '').toString().trim().toUpperCase();
                if (employmentMode === 'FT') {
                  return (
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label={t('attendance.ftOvertimeHours')}
                        type="number"
                        value={formData.ft_overtime_hours}
                        onChange={handleChange('ft_overtime_hours')}
                        fullWidth
                        inputProps={{ step: 0.01, min: 0 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{t('attendance.hours')}</InputAdornment>
                        }}
                      />
                    </Grid>
                  );
                }
                return null;
              })()}
              {/* PT 工作時數 - 所有 PT 員工都顯示 */}
              {(() => {
                const employmentMode = (report.user?.position_employment_mode || '').toString().trim().toUpperCase();
                if (employmentMode === 'PT') {
                  return (
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        label={t('attendance.ptWorkHours')}
                        type="number"
                        value={formData.pt_work_hours}
                        onChange={handleChange('pt_work_hours')}
                        fullWidth
                        inputProps={{ step: 0.01, min: 0 }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">{t('attendance.hours')}</InputAdornment>
                        }}
                      />
                    </Grid>
                  );
                }
                return null;
              })()}
            </Grid>
          </Card>

          {/* 手動輸入的津貼 */}
          <Card elevation={1} sx={{ mb: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              {t('attendance.allowances')}
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('attendance.storeManagerAllowance')}
                  type="number"
                  value={formData.store_manager_allowance}
                  onChange={handleChange('store_manager_allowance')}
                  fullWidth
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('attendance.attendanceBonus')}
                  type="number"
                  value={formData.attendance_bonus}
                  onChange={handleChange('attendance_bonus')}
                  fullWidth
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('attendance.locationAllowance')}
                  type="number"
                  value={formData.location_allowance}
                  onChange={handleChange('location_allowance')}
                  fullWidth
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('attendance.incentive')}
                  type="number"
                  value={formData.incentive}
                  onChange={handleChange('incentive')}
                  fullWidth
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label={t('attendance.specialAllowance')}
                  type="number"
                  value={formData.special_allowance}
                  onChange={handleChange('special_allowance')}
                  fullWidth
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>
            </Grid>
          </Card>

          {/* 備註 */}
          <Card elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              {t('attendance.remarks')}
            </Typography>
            <TextField
              label={t('attendance.remarks')}
              value={formData.remarks}
              onChange={handleChange('remarks')}
              fullWidth
              multiline
              rows={4}
            />
          </Card>
        </Paper>
      </Container>
    </Layout>
  );
};

export default MonthlyAttendanceReport;

