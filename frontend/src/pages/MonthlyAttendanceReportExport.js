import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Download as DownloadIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import YearSelector from '../components/YearSelector';

const MonthlyAttendanceReportExport = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // CSV 導出相關狀態
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  // 月份名稱（中文）
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  // 處理 CSV 導出
  const handleExportCSV = async () => {
    if (!exportYear || !exportMonth) {
      setExportError('請選擇年份和月份');
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const response = await axios.get('/api/monthly-attendance-reports/export/csv', {
        params: {
          year: exportYear,
          month: exportMonth
        },
        responseType: 'blob'
      });

      // 創建下載連結
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monthly_attendance_report_${exportYear}_${String(exportMonth).padStart(2, '0')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('導出 CSV 失敗:', error);
      if (error.response && error.response.data) {
        // 嘗試解析錯誤訊息
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result);
            setExportError(errorData.message || '導出失敗');
          } catch (e) {
            setExportError('導出失敗，請稍後再試');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        setExportError('導出失敗，請稍後再試');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <Container maxWidth="md">
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/shift-management')}
            sx={{ mb: 2 }}
          >
            返回
          </Button>
          <Typography variant="h4" component="h1" gutterBottom>
            匯出月報 CSV
          </Typography>
          <Typography variant="body2" color="text.secondary">
            選擇年份和月份，下載該月份的月報 CSV 文件
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <YearSelector
                value={exportYear}
                onChange={(year) => setExportYear(year)}
                fullWidth
                label="年份"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>月份</InputLabel>
                <Select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  label="月份"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <MenuItem key={m} value={m}>
                      {monthNames[m - 1]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={12} md={4}>
              <Button
                variant="contained"
                size="large"
                fullWidth
                startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                onClick={handleExportCSV}
                disabled={exporting || !exportYear || !exportMonth}
                sx={{ height: '56px' }}
              >
                {exporting ? '匯出中...' : '下載 CSV'}
              </Button>
            </Grid>
          </Grid>

          {exportError && (
            <Alert severity="error" sx={{ mt: 3 }} onClose={() => setExportError(null)}>
              {exportError}
            </Alert>
          )}

          <Box sx={{ mt: 4, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom>
              說明：
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>選擇要匯出的年份和月份</li>
                <li>點擊「下載 CSV」按鈕即可下載該月份所有員工的月報數據</li>
                <li>CSV 文件包含所有月報字段，可用 Excel 打開查看</li>
                <li>文件名稱格式：monthly_attendance_report_YYYY_MM.csv</li>
              </ul>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  );
};

export default MonthlyAttendanceReportExport;

