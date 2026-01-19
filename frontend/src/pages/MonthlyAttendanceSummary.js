import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Card,
  Divider,
  useTheme,
  useMediaQuery,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Calculate as CalculateIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

// 配置 dayjs 時區插件
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

const MonthlyAttendanceSummary = ({ noLayout = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().tz('Asia/Hong_Kong').year());
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().tz('Asia/Hong_Kong').month() + 1);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [calculateDialogOpen, setCalculateDialogOpen] = useState(false);
  const [calculatingDate, setCalculatingDate] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId && selectedYear && selectedMonth) {
      fetchSummary();
    }
  }, [selectedUserId, selectedYear, selectedMonth]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按 employee_number 排序
      usersList.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || '獲取用戶列表失敗'
      });
    }
  };

  const fetchSummary = async () => {
    if (!selectedUserId) return;

    setLoading(true);
    try {
      const response = await axios.get('/api/monthly-attendance-summaries', {
        params: {
          user_id: selectedUserId,
          year: selectedYear,
          month: selectedMonth
        }
      });

      if (response.data.summaries && response.data.summaries.length > 0) {
        setSummary(response.data.summaries[0]);
      } else {
        setSummary(null);
      }
    } catch (error) {
      console.error('Fetch summary error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || '取得月結記錄失敗'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateDay = async (date) => {
    if (!selectedUserId) return;

    setCalculatingDate(date);
    setCalculateDialogOpen(true);

    try {
      // 獲取該日期的考勤數據（使用 UTC+8 時區）
      const dateStr = typeof date === 'string' 
        ? date 
        : dayjs(date).tz('Asia/Hong_Kong').format('YYYY-MM-DD');
      const [year, month, day] = dateStr.split('-').map(Number);

      // 獲取該日期的考勤數據並計算
      const response = await axios.post('/api/monthly-attendance-summaries/calculate-day', {
        user_id: selectedUserId,
        date: dateStr,
        attendance_data: summary?.daily_data?.find(d => d.date === dateStr)?.attendance_data || {},
        schedule_data: summary?.daily_data?.find(d => d.date === dateStr)?.attendance_data?.schedule || {}
      });

      // 更新該天的數據
      if (summary) {
        const dailyData = [...(summary.daily_data || [])];
        const index = dailyData.findIndex(d => d.date === dateStr);
        
        if (index >= 0) {
          dailyData[index] = response.data.daily_data;
        } else {
          dailyData.push(response.data.daily_data);
        }

        // 保存更新
        await axios.put(`/api/monthly-attendance-summaries/${summary.id}`, {
          daily_data: dailyData
        });

        await fetchSummary();
        Swal.fire({
          icon: 'success',
          title: t('attendance.success') || '成功',
          text: t('attendance.calculateComplete') || '計算完成'
        });
      }
    } catch (error) {
      console.error('Calculate day error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.response?.data?.message || t('attendance.calculateFailed') || '計算失敗'
      });
    } finally {
      setCalculateDialogOpen(false);
      setCalculatingDate(null);
    }
  };

  const formatTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '--';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '--';
    return typeof hours === 'string' ? hours : hours.toFixed(2);
  };

  const handleExportPDF = async () => {
    if (!summary || !selectedUserId) {
      Swal.fire({
        icon: 'warning',
        title: t('attendance.error') || '錯誤',
        text: t('attendance.noMonthlySummary') || '沒有月結記錄'
      });
      return;
    }

    try {
      const selectedUser = users.find(u => u.id === selectedUserId);
      const userName = selectedUser 
        ? `${selectedUser.employee_number} - ${selectedUser.display_name || selectedUser.name_zh || selectedUser.name || ''}`
        : '';

      // 創建 PDF
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // 使用默認字體（helvetica）避免字體相關錯誤
      // 注意：jsPDF 默認字體不支持中文，所以我們使用英文標籤
      // 如果需要支持中文，需要正確加載和註冊中文字體文件
      doc.setFont('helvetica', 'normal');
      
      // 標題 - 使用英文避免字體問題
      doc.setFontSize(18);
      doc.text('Monthly Attendance Summary', 14, 15);
      
      // 員工信息 - 使用英文避免字體問題
      doc.setFontSize(12);
      doc.text(`Employee: ${selectedUser?.employee_number || ''}`, 14, 22);
      doc.text(`Year: ${selectedYear}`, 14, 28);
      doc.text(`Month: ${selectedMonth}`, 14, 34);

    // 準備表格數據 - 使用英文避免字體問題
    const tableData = dailyData.map(day => {
      const recordCount = day.attendance_data?.clock_records?.length || 0;
      const recordsText = recordCount > 0 ? `${recordCount} records` : 'No records';
      
      return [
        day.date || '--',
        recordsText,
        day.late_minutes !== null ? day.late_minutes.toString() : '--',
        day.break_duration !== null ? day.break_duration.toString() : '--',
        formatHours(day.total_work_hours),
        formatHours(day.overtime_hours),
        day.early_leave ? 'Yes' : 'No',
        day.is_late ? 'Yes' : 'No',
        day.is_absent ? 'Yes' : 'No'
      ];
    });

    // 表格標題 - 使用英文避免字體問題
    const tableHeaders = [
      'Date',
      'Status',
      'Late(min)',
      'Break(min)',
      'Work Hours',
      'Overtime',
      'Early Leave',
      'Late',
      'Absent'
    ];

    // 確保有數據才生成表格
    if (tableData.length === 0) {
      doc.text('No data available', 14, 50);
    } else {
      // 添加表格 - 不設置自定義字體，使用默認字體
      autoTable(doc, {
        head: [tableHeaders],
        body: tableData,
        startY: 40,
        styles: { 
          fontSize: 8,
          overflow: 'linebreak',
          cellPadding: 2
        },
        headStyles: { 
          fillColor: [25, 118, 210], 
          textColor: 255, 
          fontStyle: 'bold',
          overflow: 'linebreak'
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 40 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 30 },
          2: { cellWidth: 20 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 15 },
          7: { cellWidth: 15 },
          8: { cellWidth: 15 }
        }
      });
    }

    // 生成文件名 - 使用英文避免文件名問題
    const fileName = `MonthlySummary_${selectedUser?.employee_number || 'User'}_${selectedYear}_${selectedMonth}.pdf`;
    
    // 保存 PDF
    doc.save(fileName);
    
    Swal.fire({
      icon: 'success',
      title: t('attendance.success') || '成功',
      text: t('attendance.exportPDFSuccess') || 'PDF 導出成功'
    });
    } catch (error) {
      console.error('Export PDF error:', error);
      Swal.fire({
        icon: 'error',
        title: t('attendance.error') || '錯誤',
        text: error.message || t('attendance.exportPDFFailed') || 'PDF 導出失敗'
      });
    }
  };

  const dailyData = summary?.daily_data || [];

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={noLayout ? { mt: 0, mb: 0 } : { mt: 4, mb: 4 }}>
        <Paper 
          elevation={3}
          sx={{ 
            p: 4,
            borderRadius: 3,
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Typography 
              variant="h4" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
              }}
            >
              {t('attendance.monthlySummary') || '月結表'}
            </Typography>
            {summary && selectedUserId && (
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleExportPDF}
                color="primary"
                sx={{ mb: 1 }}
              >
                {t('attendance.exportPDF') || '導出 PDF'}
              </Button>
            )}
            <Divider sx={{ width: '100%', mt: 1 }} />
          </Box>

          <Card 
            elevation={2}
            sx={{ 
              mb: 3, 
              p: 3,
              borderRadius: 2,
            }}
          >
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
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('attendance.month') || '月份'}</InputLabel>
                  <Select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    label={t('attendance.month') || '月份'}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <MenuItem key={m} value={m}>
                        {m} {t('attendance.month') || '月'}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Card>

          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading') || '載入中...'}
              </Typography>
            </Box>
          ) : summary ? (
            <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.date') || '日期'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.attendanceStatus') || '考勤情況'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.lateMinutes') || '遲到(分鐘)'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.breakDuration') || 'Break時間(分鐘)'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.totalWorkHours') || '全日上班總時數'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.overtimeHours') || '超時工作時間'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.earlyLeave') || '早退'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.isLate') || '遲到'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.isAbsent') || '缺勤'}
                      </TableCell>
                      <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 600 }}>
                        {t('attendance.calculate') || '計算'}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyData.map((day, index) => (
                      <TableRow key={day.date || index}>
                        <TableCell>{day.date}</TableCell>
                        <TableCell>
                          {day.attendance_data?.clock_records?.length > 0 ? (
                            <Chip 
                              label={t('attendance.recordsCount', { count: day.attendance_data.clock_records.length })} 
                              size="small" 
                              color="primary" 
                            />
                          ) : (
                            <Chip label={t('attendance.noRecords') || '無記錄'} size="small" />
                          )}
                        </TableCell>
                        <TableCell>{day.late_minutes !== null ? day.late_minutes : '--'}</TableCell>
                        <TableCell>{day.break_duration !== null ? day.break_duration : '--'}</TableCell>
                        <TableCell>{formatHours(day.total_work_hours)}</TableCell>
                        <TableCell>{formatHours(day.overtime_hours)}</TableCell>
                        <TableCell>
                          {day.early_leave ? (
                            <Chip label={t('common.yes') || '是'} size="small" color="warning" />
                          ) : (
                            <Chip label={t('common.no') || '否'} size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {day.is_late ? (
                            <Chip label={t('common.yes') || '是'} size="small" color="error" />
                          ) : (
                            <Chip label={t('common.no') || '否'} size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          {day.is_absent ? (
                            <Chip label={t('common.yes') || '是'} size="small" color="error" />
                          ) : (
                            <Chip label={t('common.no') || '否'} size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleCalculateDay(day.date)}
                            color="primary"
                          >
                            <CalculateIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          ) : (
            <Card 
              elevation={2}
              sx={{ 
                textAlign: 'center', 
                py: 6,
                borderRadius: 2,
                bgcolor: 'grey.50',
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t('attendance.noMonthlySummary') || '沒有月結記錄'}
              </Typography>
            </Card>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default MonthlyAttendanceSummary;
