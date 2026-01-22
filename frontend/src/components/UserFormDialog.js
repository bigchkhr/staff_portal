import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Refresh as RefreshIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const UserFormDialog = ({ open, editing, onClose, onSuccess, initialData = null, isHRMember = false, onToggleForcePasswordChange = null }) => {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    employee_number: '',
    surname: '',
    given_name: '',
    alias: '',
    name_zh: '',
    display_name: '',
    email: '',
    password: '',
    department_id: '',
    position_id: '',
    hire_date: '',
    deactivated: false,
    force_password_change: false
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDepartments();
      fetchPositions();
      setShowPassword(false);
      
      if (editing && initialData) {
        setFormData({
          employee_number: initialData.employee_number || '',
          surname: initialData.surname || '',
          given_name: initialData.given_name || '',
          alias: initialData.alias || '',
          name_zh: initialData.name_zh || '',
          display_name: initialData.display_name || '',
          email: initialData.email || '',
          password: '',
          department_id: initialData.department_id || '',
          position_id: initialData.position_id || '',
          hire_date: initialData.hire_date ? initialData.hire_date.split('T')[0] : '',
          deactivated: !!initialData.deactivated,
          force_password_change: !!initialData.force_password_change
        });
      } else {
        setFormData({
          employee_number: '',
          surname: '',
          given_name: '',
          alias: '',
          name_zh: '',
          display_name: '',
          email: '',
          password: '',
          department_id: '',
          position_id: '',
          hire_date: '',
          deactivated: false,
          force_password_change: false
        });
      }
    }
  }, [open, editing, initialData]);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Fetch departments error:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get('/api/positions');
      setPositions(response.data.positions || []);
    } catch (error) {
      console.error('Fetch positions error:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const submitData = { ...formData };
      
      if (!editing && !submitData.password) {
        alert(t('adminUsers.enterPassword'));
        return;
      }
      if (!submitData.password) {
        delete submitData.password;
      }

      if (editing) {
        await axios.put(`/api/admin/users/${editing}`, submitData);
      } else {
        await axios.post('/api/admin/users', submitData);
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      alert(error.response?.data?.message || t('adminUsers.operationFailed'));
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateRandomPassword = async () => {
    // 生成包含大小寫字母、數字和特殊字符的隨機密碼
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    // 確保至少包含一個大寫字母、小寫字母、數字和特殊字符
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // 填充剩餘長度
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 打亂字符順序
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    setFormData(prev => ({ ...prev, password }));
    
    // 自動複製到剪貼板
    try {
      await navigator.clipboard.writeText(password);
      // 可以選擇顯示提示消息，但這裡先不顯示，避免打擾用戶
    } catch (err) {
      console.error('複製到剪貼板失敗:', err);
      // 如果 Clipboard API 不可用，可以嘗試使用 fallback 方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = password;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (fallbackErr) {
        console.error('Fallback 複製方法也失敗:', fallbackErr);
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editing ? t('adminUsers.editUser') : t('adminUsers.addUser')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label={t('adminUsers.employeeNumber')}
            value={formData.employee_number}
            onChange={handleChange('employee_number')}
            required
            disabled={!!editing}
          />
          <TextField
            label={t('adminUsers.surname')}
            value={formData.surname}
            onChange={handleChange('surname')}
            required
          />
          <TextField
            label={t('adminUsers.givenName')}
            value={formData.given_name}
            onChange={handleChange('given_name')}
            required
          />
          <TextField
            label={t('adminUsers.alias')}
            value={formData.alias}
            onChange={handleChange('alias')}
          />
          <TextField
            label={t('adminUsers.chineseName')}
            value={formData.name_zh}
            onChange={handleChange('name_zh')}
            required
          />
          <TextField
            label={t('adminUsers.displayName')}
            value={formData.display_name}
            onChange={handleChange('display_name')}
          />
          <TextField
            label={t('adminUsers.email')}
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              label={editing ? t('adminUsers.newPassword') : t('adminUsers.password')}
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange('password')}
              required={!editing}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label="切換密碼顯示"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={generateRandomPassword}
              startIcon={<RefreshIcon />}
              sx={{
                mt: 0.5,
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                textTransform: 'none',
              }}
            >
              {t('adminUsers.generateRandomPassword')}
            </Button>
          </Box>
          <FormControl>
            <InputLabel>{t('adminUsers.department')}</InputLabel>
            <Select
              value={formData.department_id}
              label={t('adminUsers.department')}
              onChange={handleChange('department_id')}
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {i18n.language === 'en' 
                    ? (dept.name || dept.name_zh || '-')
                    : (dept.name_zh || dept.name || '-')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('adminUsers.position')}</InputLabel>
            <Select
              value={formData.position_id}
              label={t('adminUsers.position')}
              onChange={handleChange('position_id')}
            >
              {positions.map((pos) => (
                <MenuItem key={pos.id} value={pos.id}>
                  {i18n.language === 'en' 
                    ? (pos.name || pos.name_zh || '-')
                    : (pos.name_zh || pos.name || '-')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('adminUsers.hireDate')}
            type="date"
            value={formData.hire_date}
            onChange={handleChange('hire_date')}
            InputLabelProps={{
              shrink: true
            }}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={formData.deactivated}
                onChange={handleChange('deactivated')}
                color="error"
              />
            )}
            label={formData.deactivated ? t('adminUsers.accountDeactivated') : t('adminUsers.accountActive')}
          />
          {isHRMember && (
            <FormControlLabel
              control={(
                <Switch
                  checked={formData.force_password_change}
                  onChange={handleChange('force_password_change')}
                  color="warning"
                />
              )}
              label={t('adminUsers.forcePasswordChange')}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained">{t('common.save')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormDialog;

