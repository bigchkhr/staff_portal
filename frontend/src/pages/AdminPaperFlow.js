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
  Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Search as SearchIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import YearSelector from '../components/YearSelector';
import UserSearchDialog from '../components/UserSearchDialog';

const AdminPaperFlow = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    user_id: '',
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
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState(null);
  const [files, setFiles] = useState([]);
  const [yearManuallySet, setYearManuallySet] = useState(false); // 標記年份是否被手動設置
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchLeaveTypes();
    fetchUsers();
  }, []);

  // 當選擇的用戶改變時，更新表單數據
  useEffect(() => {
    if (selectedUser) {
      setFormData(prev => ({ ...prev, user_id: selectedUser.id }));
    }
  }, [selectedUser]);

  useEffect(() => {
    if (formData.leave_type_id && formData.user_id) {
      fetchBalance(formData.user_id, formData.leave_type_id, formData.year);
    }
  }, [formData.leave_type_id, formData.user_id, formData.year]);

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

  // 計算天數，考慮半日假期
  // 規則：
  // - 開始上午 + 結束下午 = 整數（如4日或5日）
  // - 開始上午 + 結束上午 = 半日數（如4.5日或5.5日）
  // - 開始下午 + 結束下午 = 半日數（如3.5日或6.5日）
  // - 開始下午 + 結束上午 = 整數 - 1（因為第一天下午+最後一天上午=1日）
  const calculateDays = (startDate, endDate, startSession, endSession) => {
    if (!startDate || !endDate || !startSession || !endSession) return 0;

    // 計算基礎天數（包含週末）
    const baseDays = endDate.diff(startDate, 'day') + 1;

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
        formData.end_session
      );
      setFormData(prev => ({ ...prev, days: days > 0 ? days.toString() : '' }));
    }
  }, [formData.start_date, formData.end_date, formData.start_session, formData.end_session]);

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      setLeaveTypes(response.data.leaveTypes);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.user_id || !formData.leave_type_id || !formData.start_date || !formData.start_session || 
        !formData.end_date || !formData.end_session || !formData.days) {
      setLoading(false);
      await Swal.fire({
        icon: 'error',
        title: t('adminPaperFlow.validationFailed'),
        text: t('adminPaperFlow.fillAllFields'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
      return;
    }

    try {
      const submitData = new FormData();
      submitData.append('user_id', formData.user_id);
      submitData.append('leave_type_id', formData.leave_type_id);
      submitData.append('start_date', formData.start_date.format('YYYY-MM-DD'));
      submitData.append('start_session', formData.start_session);
      submitData.append('end_date', formData.end_date.format('YYYY-MM-DD'));
      submitData.append('end_session', formData.end_session);
      submitData.append('total_days', parseFloat(formData.days));
      submitData.append('year', formData.year); // 發送年份
      if (formData.reason) {
        submitData.append('reason', formData.reason);
      }
      submitData.append('flow_type', 'paper-flow');

      // 附加檔案（包括拍照取得的圖片）
      if (files && files.length > 0) {
        files.forEach((file) => {
          submitData.append('files', file);
        });
      }

      const response = await axios.post('/api/leaves', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // 使用 Sweet Alert 顯示成功訊息
      await Swal.fire({
        icon: 'success',
        title: t('adminPaperFlow.applicationSuccess'),
        text: t('adminPaperFlow.applicationSubmitted', { transactionId: response.data.application.transaction_id }),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });
      
      setFormData({
        user_id: '',
        leave_type_id: '',
        year: new Date().getFullYear(), // 重置為當前年份
        start_date: null,
        start_session: 'AM', // 預設為上午
        end_date: null,
        end_session: 'PM', // 預設為下午
        days: '',
        reason: ''
      });
      setBalance(null);
      setFiles([]);
      setYearManuallySet(false); // 重置年份手動設置標記
      setSelectedUser(null);
    } catch (error) {
      // 使用 Sweet Alert 顯示錯誤訊息
      await Swal.fire({
        icon: 'error',
        title: t('adminPaperFlow.submitFailed'),
        text: error.response?.data?.message || t('adminPaperFlow.submitError'),
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  // 如果 selectedUser 已經設置，使用它；否則從表單數據中查找
  const displayUser = selectedUser || users.find(u => u.id === parseInt(formData.user_id));

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('adminPaperFlow.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('adminPaperFlow.description')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Box sx={{ mb: 2 }}>
            <InputLabel required sx={{ mb: 1 }}>{t('adminPaperFlow.applicant')}</InputLabel>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<SearchIcon />}
              onClick={() => setUserDialogOpen(true)}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                height: '56px',
                color: displayUser ? 'text.primary' : 'text.secondary'
              }}
            >
              {displayUser 
                ? `${displayUser.employee_number} - ${displayUser.display_name || displayUser.name_zh || '-'}`
                : t('adminPaperFlow.selectApplicant')
              }
            </Button>
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }} required>
            <InputLabel>{t('adminPaperFlow.leaveType')}</InputLabel>
            <Select
              value={formData.leave_type_id}
              label={t('adminPaperFlow.leaveType')}
              onChange={(e) => setFormData(prev => ({ ...prev, leave_type_id: e.target.value }))}
            >
              {leaveTypes.map((lt) => (
                <MenuItem key={lt.id} value={lt.id}>
                  {lt.name_zh} ({lt.name})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <YearSelector
            value={formData.year}
            onChange={(year) => {
              setFormData(prev => ({ ...prev, year }));
              setYearManuallySet(true); // 標記為手動設置
            }}
            labelKey="adminPaperFlow.year"
            suffix={t('adminPaperFlow.yearSuffix')}
            fullWidth
            required
            sx={{ mb: 2 }}
          />

          {leaveTypes.find(lt => lt.id === parseInt(formData.leave_type_id))?.requires_balance && balance && (
            <Box sx={{ mb: 2 }}>
              <Chip
                label={t('adminPaperFlow.availableBalance', { 
                  name: displayUser?.display_name || t('adminPaperFlow.applicant'), 
                  days: parseFloat(balance.balance).toFixed(1) 
                })}
                color={parseFloat(balance.balance) >= parseFloat(formData.days || 0) ? 'success' : 'error'}
                sx={{ mb: 1 }}
              />
            </Box>
          )}

          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('adminPaperFlow.startDate')}
                  value={formData.start_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, start_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label={t('adminPaperFlow.endDate')}
                  value={formData.end_date}
                  onChange={(date) => setFormData(prev => ({ ...prev, end_date: date }))}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, required: true } }}
                  minDate={formData.start_date}
                />
              </Grid>
            </Grid>
          </LocalizationProvider>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('adminPaperFlow.startSession')}</InputLabel>
                <Select
                  value={formData.start_session}
                  label={t('adminPaperFlow.startSession')}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_session: e.target.value }))}
                >
                  <MenuItem value="AM">{t('adminPaperFlow.sessionAM')}</MenuItem>
                  <MenuItem value="PM">{t('adminPaperFlow.sessionPM')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>{t('adminPaperFlow.endSession')}</InputLabel>
                <Select
                  value={formData.end_session}
                  label={t('adminPaperFlow.endSession')}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_session: e.target.value }))}
                >
                  <MenuItem value="AM">{t('adminPaperFlow.sessionAM')}</MenuItem>
                  <MenuItem value="PM">{t('adminPaperFlow.sessionPM')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <TextField
            fullWidth
            label={t('adminPaperFlow.days')}
            type="number"
            value={formData.days}
            onChange={(e) => setFormData(prev => ({ ...prev, days: e.target.value }))}
            required
            sx={{ mb: 2 }}
            inputProps={{ min: 0.5, step: 0.5 }}
          />

          {/* 檔案 / 拍照上載區塊 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              {t('adminPaperFlow.uploadPaperOrPhoto')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Button
                variant="outlined"
                component="label"
              >
                {t('adminPaperFlow.uploadFile')}
                <input
                  hidden
                  type="file"
                  multiple
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    setFiles(prev => [...prev, ...selectedFiles]);
                  }}
                />
              </Button>
              <Button
                variant="outlined"
                component="label"
              >
                {t('adminPaperFlow.uploadPhoto')}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple={false}
                  onChange={(e) => {
                    const selectedFiles = Array.from(e.target.files || []);
                    setFiles(prev => [...prev, ...selectedFiles]);
                  }}
                />
              </Button>
            </Box>

            {files.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  {t('adminPaperFlow.selectedFiles')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {files.map((file, index) => (
                    <Box
                      key={`${file.name}-${index}`}
                      sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                        {file.name}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        {t('adminPaperFlow.remove')}
                      </Button>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <TextField
            fullWidth
            label={t('adminPaperFlow.reason')}
            multiline
            rows={4}
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={loading}
          >
            {loading ? t('adminPaperFlow.submitting') : t('adminPaperFlow.submit')}
          </Button>
        </Box>
      </Paper>

      <UserSearchDialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        onSelect={(user) => setSelectedUser(user)}
        selectedUserId={formData.user_id}
      />
    </Container>
  );
};

export default AdminPaperFlow;

