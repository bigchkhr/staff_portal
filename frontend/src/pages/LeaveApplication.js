import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  MenuItem,
  Grid,
  InputLabel,
  Select,
  FormControl,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  LinearProgress,
  FormControlLabel,
  Switch,
  Alert,
  Collapse
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Delete as DeleteIcon, AttachFile as AttachFileIcon, CameraAlt as CameraIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import YearSelector from '../components/YearSelector';
import { formatDateUTC8, todayHK } from '../utils/dateFormat';
import { calculateLeaveDays } from '../utils/leaveDays';

const LeaveApplication = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    leave_type_id: '',
    year: new Date().getFullYear(), // 預設為當前年份
    start_date: null,
    start_session: 'AM', // 預設為上午
    end_date: null,
    end_session: 'PM', // 預設為下午
    days: '',
    reason: '',
    exclude_public_holidays: false // 是否排除法定假期，將根據 stream 在 useEffect 中設置
  });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [files, setFiles] = useState([]);
  const [overlappingApplications, setOverlappingApplications] = useState([]);
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  // 根據用戶的 stream 設置默認值：Store 開啟週末計算、關閉排除法定假期；Head Office 關閉週末計算、開啟排除法定假期
  const [includeWeekends, setIncludeWeekends] = useState(false); // 初始值，將根據 stream 在 useEffect 中設置
  const [yearManuallySet, setYearManuallySet] = useState(false); // 標記年份是否被手動設置

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  // 根據用戶的 stream 設置默認值
  useEffect(() => {
    if (user?.position_stream) {
      const isStore = user.position_stream === 'Store';
      // Store: 開啟週末計算、關閉排除法定假期
      // Head Office: 關閉週末計算、開啟排除法定假期
      setIncludeWeekends(isStore);
      setFormData(prev => ({ ...prev, exclude_public_holidays: !isStore }));
    }
  }, [user]);

  useEffect(() => {
    if (formData.leave_type_id) {
      fetchBalance(user.id, formData.leave_type_id, formData.year);
    }
  }, [formData.leave_type_id, formData.year, user.id]);

  // 當開始日期改變時，如果年份未被手動設置，則自動更新年份
  useEffect(() => {
    if (formData.start_date && !yearManuallySet) {
      const dateYear = formData.start_date.year();
      // 如果當前選擇的年份與日期年份不同，自動更新
      if (formData.year !== dateYear) {
        setFormData(prev => ({ ...prev, year: dateYear }));
      }
    }
  }, [formData.start_date, yearManuallySet]);

  useEffect(() => {
    const updateDays = async () => {
      if (formData.start_date && formData.end_date) {
        const days = await calculateLeaveDays(
          formData.start_date,
          formData.end_date,
          formData.start_session,
          formData.end_session,
          includeWeekends,
          formData.exclude_public_holidays
        );
        setFormData(prev => ({ ...prev, days: days > 0 ? days.toString() : '' }));
      }
    };
    updateDays();
  }, [formData.start_date, formData.end_date, formData.start_session, formData.end_session, includeWeekends, formData.exclude_public_holidays]);

  // 當開始/結束日期改變時，檢查該日期範圍內是否已有待批核或已批準的假期申請
  useEffect(() => {
    const checkOverlappingApplications = async () => {
      if (!formData.start_date || !formData.end_date || !user?.id) {
        setOverlappingApplications([]);
        return;
      }
      setCheckingOverlap(true);
      try {
        const startStr = formData.start_date.format('YYYY-MM-DD');
        const endStr = formData.end_date.format('YYYY-MM-DD');
        const response = await axios.get('/api/leaves', {
          params: {
            start_date_from: startStr,
            end_date_to: endStr,
            limit: 100
          }
        });
        const applications = response.data.applications || [];
        const overlapping = applications.filter(
          (app) =>
            (app.status === 'pending' || app.status === 'approved') &&
            !app.is_reversed &&
            !app.is_reversal_transaction
        );
        setOverlappingApplications(overlapping);
      } catch (err) {
        console.error('Check overlapping applications error:', err);
        setOverlappingApplications([]);
      } finally {
        setCheckingOverlap(false);
      }
    };
    checkOverlappingApplications();
  }, [formData.start_date, formData.end_date, user?.id]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types/available-in-flow');
      setLeaveTypes(response.data.leaveTypes || []);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchBalance = async (userId, leaveTypeId, year) => {
    try {
      const selectedYear = year || new Date().getFullYear();
      const response = await axios.get('/api/leaves/balances', {
        params: { user_id: userId, year: selectedYear }
      });
      const balances = response.data.balances || [];
      const selectedBalance = balances.find(b => b.leave_type_id === parseInt(leaveTypeId));
      setBalance(selectedBalance);
    } catch (error) {
      console.error('Fetch balance error:', error);
      setBalance(null);
    }
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // 驗證文件類型和大小
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff', 'image/tif', 'application/pdf'];
    const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    const validFiles = [];
    const errors = [];
    
    selectedFiles.forEach((file) => {
      const fileExt = '.' + file.name.split('.').pop().toLowerCase();
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExt);
      const isValidSize = file.size <= maxSize;
      
      if (!isValidType) {
        errors.push(`${file.name}: ${t('leaveApplication.unsupportedFileType', { types: allowedExtensions.join(', ') })}`);
      } else if (!isValidSize) {
        errors.push(`${file.name}: ${t('leaveApplication.fileSizeLimit')}`);
      } else {
        validFiles.push(file);
      }
    });
    
    if (errors.length > 0) {
      await Swal.fire({
        icon: 'error',
        title: '檔案上傳錯誤',
        html: errors.join('<br>'),
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // 使用後置攝像頭
    input.onchange = async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await handleFileChange(e);
      }
    };
    input.click();
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.leave_type_id || !formData.start_date || !formData.start_session || 
        !formData.end_date || !formData.end_session || !formData.days) {
      await Swal.fire({
        icon: 'warning',
        title: '請填寫所有欄位',
        text: t('leaveApplication.fillAllFields'),
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      setLoading(false);
      return;
    }

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('user_id', user.id);
      formDataToSend.append('leave_type_id', formData.leave_type_id);
      formDataToSend.append('start_date', formData.start_date.format('YYYY-MM-DD'));
      formDataToSend.append('start_session', formData.start_session);
      formDataToSend.append('end_date', formData.end_date.format('YYYY-MM-DD'));
      formDataToSend.append('end_session', formData.end_session);
      formDataToSend.append('total_days', parseFloat(formData.days));
      formDataToSend.append('year', formData.year); // 發送年份
      // e-flow 申請必須將當時的日期錄入申請日期
      formDataToSend.append('application_date', todayHK());
      if (formData.reason) {
        formDataToSend.append('reason', formData.reason);
      }
      formDataToSend.append('exclude_public_holidays', formData.exclude_public_holidays ? 'true' : 'false');
      
      // 添加文件
      files.forEach((file) => {
        formDataToSend.append('files', file);
      });

      const response = await axios.post('/api/leaves', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // 使用 Sweet Alert 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: t('leaveApplication.applicationSubmitted', { transactionId: response.data.application.transaction_id }),
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      
      // 根據用戶的 stream 重置默認值
      const isStore = user?.position_stream === 'Store';
      setFormData({
        leave_type_id: '',
        year: new Date().getFullYear(), // 重置為當前年份
        start_date: null,
        start_session: 'AM', // 預設為上午
        end_date: null,
        end_session: 'PM', // 預設為下午
        days: '',
        reason: '',
        exclude_public_holidays: !isStore // Store: false, Head Office: true
      });
      setFiles([]);
      setBalance(null);
      setOverlappingApplications([]);
      setIncludeWeekends(isStore); // Store: true, Head Office: false
      setYearManuallySet(false); // 重置年份手動設置標記
    } catch (error) {
      // 檢查是否為日期範圍重疊錯誤
      if (error.response?.data?.overlapping_applications && error.response.data.overlapping_applications.length > 0) {
        const overlappingApps = error.response.data.overlapping_applications;
        const overlappingList = overlappingApps.map(app => 
          `<div style="text-align: left; margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
            <strong>交易編號：</strong>${app.transaction_id}<br/>
            <strong>假期類型：</strong>${i18n.language === 'en' ? (app.leave_type_name || app.leave_type_name_zh || '') : (app.leave_type_name_zh || app.leave_type_name || '')}<br/>
            <strong>日期範圍：</strong>${formatDateUTC8(app.start_date)} ~ ${formatDateUTC8(app.end_date)}<br/>
            <strong>狀態：</strong>${app.status}
          </div>`
        ).join('');
        
        await Swal.fire({
          icon: 'warning',
          title: '日期範圍重疊',
          html: `
            <div style="text-align: left;">
              <p style="color: #d32f2f; font-weight: bold; margin-bottom: 15px;">該日期範圍內已有已批核或正在申請的假期，無法重複申請：</p>
              ${overlappingList}
            </div>
          `,
          confirmButtonText: '確定',
          confirmButtonColor: '#d33',
          width: '600px'
        });
      } else {
        // 使用 Sweet Alert 顯示錯誤訊息
        await Swal.fire({
          icon: 'error',
          title: '申請失敗',
          text: error.response?.data?.message || t('leaveApplication.submitError'),
          confirmButtonText: '確定',
          confirmButtonColor: '#d33'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedLeaveType = leaveTypes.find(lt => lt.id === parseInt(formData.leave_type_id));

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('leaveApplication.title')}
        </Typography>


        <Box component="form" onSubmit={handleSubmit}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('leaveApplication.leaveType')}</InputLabel>
            <Select
              value={formData.leave_type_id}
              label={t('leaveApplication.leaveType')}
              onChange={(e) => setFormData(prev => ({ ...prev, leave_type_id: e.target.value }))}
              required
            >
              {leaveTypes.map((lt) => {
                // 根據當前語言選擇顯示順序
                const displayName = i18n.language === 'en'
                  ? `${lt.name || lt.name_zh || ''}${lt.name_zh && lt.name !== lt.name_zh ? ` (${lt.name_zh})` : ''}`
                  : `${lt.name_zh || lt.name || ''}${lt.name && lt.name !== lt.name_zh ? ` (${lt.name})` : ''}`;
                return (
                  <MenuItem key={lt.id} value={lt.id}>
                    {displayName}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <YearSelector
            value={formData.year}
            onChange={(year) => {
              setFormData(prev => ({ ...prev, year }));
              setYearManuallySet(true); // 標記為手動設置
            }}
            labelKey="leaveApplication.year"
            suffix={t('leaveApplication.yearSuffix')}
            fullWidth
            required
            sx={{ mb: 2 }}
          />

          {selectedLeaveType?.requires_balance && balance && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={t('leaveApplication.availableBalance', { days: parseFloat(balance.balance).toFixed(1) })}
                color={parseFloat(balance.balance) >= parseFloat(formData.days || 0) ? 'success' : 'error'}
                sx={{ mb: 1 }}
              />
            </Box>
          )}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('leaveApplication.startDate')}
                  value={formData.start_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>{t('leaveApplication.startSession')}</InputLabel>
                  <Select
                    value={formData.start_session}
                    label={t('leaveApplication.startSession')}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_session: e.target.value }))}
                    required
                  >
                    <MenuItem value="AM">{t('leaveApplication.sessionAM')}</MenuItem>
                    <MenuItem value="PM">{t('leaveApplication.sessionPM')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('leaveApplication.endDate')}
                  value={formData.end_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                  minDate={formData.start_date}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>{t('leaveApplication.endSession')}</InputLabel>
                  <Select
                    value={formData.end_session}
                    label={t('leaveApplication.endSession')}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_session: e.target.value }))}
                    required
                  >
                    <MenuItem value="AM">{t('leaveApplication.sessionAM')}</MenuItem>
                    <MenuItem value="PM">{t('leaveApplication.sessionPM')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </LocalizationProvider>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={includeWeekends}
                  onChange={(e) => setIncludeWeekends(e.target.checked)}
                  color="primary"
                />
              }
              label={t('leaveApplication.includeWeekends')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {includeWeekends 
                ? t('leaveApplication.includeWeekendsDescription1')
                : t('leaveApplication.includeWeekendsDescription2')}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.exclude_public_holidays}
                  onChange={(e) => setFormData(prev => ({ ...prev, exclude_public_holidays: e.target.checked }))}
                  color="primary"
                />
              }
              label={t('leaveApplication.excludePublicHolidays')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {formData.exclude_public_holidays 
                ? t('leaveApplication.excludePublicHolidaysDescription1')
                : t('leaveApplication.excludePublicHolidaysDescription2')}
            </Typography>
          </Box>

          <TextField
            fullWidth
            label={t('leaveApplication.days')}
            type="number"
            value={formData.days}
            disabled
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0.5, step: 0.5 }}
          />

          <TextField
            fullWidth
            label={t('leaveApplication.reason')}
            multiline
            rows={4}
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            sx={{ mb: 1 }}
          />
          <Typography
            variant="body2"
            sx={{
              mb: 2,
              color: 'error.main',
              fontWeight: 500,
              whiteSpace: 'pre-line'
            }}
          >
            {t(
              'leaveApplication.documentRequirementNotice',
              '但凡病假、陪審團假、婚假、產假、侍產假、工傷病假及恩恤假，均需提交證明文件。若你無法於申請時遞交，公司可酌情暫時批核相關假期，待你補回有關證明文件後該假期予以正式生效。公司有權對無有效證明文件的假期進行撤回。'
            )}
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('leaveApplication.attachFilesTitle')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<AttachFileIcon />}
              >
                {t('leaveApplication.selectFile')}
                <input
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.jpeg,.jpg,.png,.gif,.bmp,.webp,.tiff,.tif,image/*"
                  onChange={handleFileChange}
                />
              </Button>
              <Button
                variant="outlined"
                startIcon={<CameraIcon />}
                onClick={handleCameraCapture}
              >
                {t('leaveApplication.takePhoto')}
              </Button>
            </Box>
            {files.length > 0 && (
              <List dense>
                {files.map((file, index) => (
                  <ListItem
                    key={index}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label={t('leaveApplication.removeFileLabel')}
                        onClick={() => handleRemoveFile(index)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={file.name}
                      secondary={formatFileSize(file.size)}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          <Collapse in={overlappingApplications.length > 0}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('leaveApplication.overlapWarningTitle', '該日期範圍內已有以下待批核或已批準的假期申請')}
              </Typography>
              <List dense disablePadding>
                {overlappingApplications.map((app) => (
                  <ListItem key={app.id} disablePadding sx={{ py: 0.25 }}>
                    <ListItemText
                      primary={`${app.transaction_id || `LA-${String(app.id).padStart(6, '0')}`} · ${i18n.language === 'en' ? (app.leave_type_name || app.leave_type_name_zh || '') : (app.leave_type_name_zh || app.leave_type_name || '')} · ${formatDateUTC8(app.start_date)} ~ ${formatDateUTC8(app.end_date)}`}
                      secondary={app.status === 'approved' ? t('leaveApplication.statusApproved', '已批準') : t('leaveApplication.statusPending', '待批核')}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {t('leaveApplication.overlapWarningMessage', '無法提交。請修改日期或時段，待無重疊後再提交。')}
              </Typography>
            </Alert>
          </Collapse>

          {checkingOverlap && overlappingApplications.length === 0 && formData.start_date && formData.end_date && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {t('leaveApplication.checkingOverlap', '正在檢查是否有重疊假期…')}
            </Typography>
          )}

          {loading && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading || overlappingApplications.length > 0}
          >
            {loading ? t('leaveApplication.submitting') : t('leaveApplication.submitButton')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default LeaveApplication;
