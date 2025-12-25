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
  Switch
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
    reason: ''
  });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [files, setFiles] = useState([]);
  const [includeWeekends, setIncludeWeekends] = useState(true); // 預設包含週末
  const [yearManuallySet, setYearManuallySet] = useState(false); // 標記年份是否被手動設置

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

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

  // 計算工作日（排除週末）
  const calculateWorkingDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    
    let count = 0;
    let current = dayjs(startDate);
    const end = dayjs(endDate);
    
    // 使用 isBefore 和 isSame 來替代 isSameOrBefore
    while (current.isBefore(end, 'day') || current.isSame(end, 'day')) {
      const dayOfWeek = current.day(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current = current.add(1, 'day');
    }
    
    return count;
  };

  // 計算天數，考慮半日假期
  // 規則：
  // - 開始上午 + 結束下午 = 整數（如4日或5日）
  // - 開始上午 + 結束上午 = 半日數（如4.5日或5.5日）
  // - 開始下午 + 結束下午 = 半日數（如3.5日或6.5日）
  // - 開始下午 + 結束上午 = 整數 - 1（因為第一天下午+最後一天上午=1日）
  const calculateDays = (startDate, endDate, startSession, endSession, includeWeekends) => {
    if (!startDate || !endDate || !startSession || !endSession) return 0;

    // 計算基礎天數
    let baseDays;
    if (includeWeekends) {
      // 包含週末：計算總天數
      baseDays = endDate.diff(startDate, 'day') + 1;
    } else {
      // 不包含週末：只計算工作日
      baseDays = calculateWorkingDays(startDate, endDate);
    }

    // 如果是同一天
    if (startDate.isSame(endDate, 'day')) {
      // 上午 + 下午 = 1日
      if (startSession === 'AM' && endSession === 'PM') {
        return 1;
      }
      // 相同時段 = 0.5日
      if (startSession === endSession) {
        return 0.5;
      }
      // 下午 + 上午（同一天不應該出現，但處理為0.5日）
      return 0.5;
    }

    // 多天的情況
    // 開始上午 + 結束下午 = 整數
    if (startSession === 'AM' && endSession === 'PM') {
      return baseDays;
    }
    
    // 開始上午 + 結束上午 = 整數 - 0.5
    if (startSession === 'AM' && endSession === 'AM') {
      return baseDays - 0.5;
    }
    
    // 開始下午 + 結束下午 = 整數 - 0.5
    if (startSession === 'PM' && endSession === 'PM') {
      return baseDays - 0.5;
    }
    
    // 開始下午 + 結束上午 = 整數 - 1
    // 因為第一天下午(0.5) + 中間完整天數 + 最後一天上午(0.5) = baseDays - 1
    if (startSession === 'PM' && endSession === 'AM') {
      return baseDays - 1;
    }

    return baseDays;
  };

  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const days = calculateDays(
        formData.start_date,
        formData.end_date,
        formData.start_session,
        formData.end_session,
        includeWeekends
      );
      setFormData(prev => ({ ...prev, days: days > 0 ? days.toString() : '' }));
    }
  }, [formData.start_date, formData.end_date, formData.start_session, formData.end_session, includeWeekends]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes);
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
      formDataToSend.append('application_date', new Date().toISOString().split('T')[0]); // 格式：YYYY-MM-DD
      if (formData.reason) {
        formDataToSend.append('reason', formData.reason);
      }
      
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
      
      setFormData({
        leave_type_id: '',
        year: new Date().getFullYear(), // 重置為當前年份
        start_date: null,
        start_session: 'AM', // 預設為上午
        end_date: null,
        end_session: 'PM', // 預設為下午
        days: '',
        reason: ''
      });
      setFiles([]);
      setBalance(null);
      setIncludeWeekends(true); // 重置為預設值
      setYearManuallySet(false); // 重置年份手動設置標記
    } catch (error) {
      // 使用 Sweet Alert 顯示錯誤訊息
      await Swal.fire({
        icon: 'error',
        title: '申請失敗',
        text: error.response?.data?.message || t('leaveApplication.submitError'),
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
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

          <TextField
            fullWidth
            label={t('leaveApplication.days')}
            type="number"
            value={formData.days}
            onChange={(e) => setFormData(prev => ({ ...prev, days: e.target.value }))}
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
            sx={{ mb: 2 }}
          />

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

          {loading && (
            <LinearProgress sx={{ mb: 2 }} />
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? t('leaveApplication.submitting') : t('leaveApplication.submitButton')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default LeaveApplication;
