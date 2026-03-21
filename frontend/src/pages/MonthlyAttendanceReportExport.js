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
  CircularProgress
} from '@mui/material';
import { Download as DownloadIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import YearSelector from '../components/YearSelector';

const MonthlyAttendanceReportExport = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);

  const handleExportCSV = async () => {
    if (!exportYear || !exportMonth) {
      setExportError(t('monthlyReportExport.errorSelectYearMonth'));
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const response = await axios.get('/api/monthly-attendance-reports/export/csv', {
        params: {
          year: exportYear,
          month: exportMonth,
          lang: i18n.language || 'zh-TW'
        },
        responseType: 'blob'
      });

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
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errorData = JSON.parse(reader.result);
            setExportError(errorData.message || t('monthlyReportExport.errorExportFailed'));
          } catch (e) {
            setExportError(t('monthlyReportExport.errorExportFailedRetry'));
          }
        };
        reader.readAsText(error.response.data);
      } else {
        setExportError(t('monthlyReportExport.errorExportFailedRetry'));
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
            {t('common.back')}
          </Button>
          <Typography variant="h4" component="h1" gutterBottom>
            {t('monthlyReportExport.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('monthlyReportExport.subtitle')}
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <YearSelector
                value={exportYear}
                onChange={(year) => setExportYear(year)}
                fullWidth
                label={t('attendance.year')}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth>
                <InputLabel>{t('attendance.month')}</InputLabel>
                <Select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  label={t('attendance.month')}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <MenuItem key={m} value={m}>
                      {t(`monthlyReportExport.month${m}`)}
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
                {exporting ? t('monthlyReportExport.exporting') : t('monthlyReportExport.downloadCsv')}
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
              {t('monthlyReportExport.notesTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" component="div">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>{t('monthlyReportExport.noteSelectPeriod')}</li>
                <li>{t('monthlyReportExport.noteClickDownload')}</li>
                <li>{t('monthlyReportExport.noteCsvFields')}</li>
                <li>{t('monthlyReportExport.noteFileNamePattern')}</li>
              </ul>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Layout>
  );
};

export default MonthlyAttendanceReportExport;
