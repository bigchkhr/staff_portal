import React, { useState } from 'react';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  InputAdornment,
  IconButton
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

// 密碼強度驗證函數
const validatePasswordStrength = (password) => {
  const errors = [];
  
  // 至少 8 個字符
  if (password.length < 8) {
    errors.push('密碼長度至少需要 8 個字符');
  }
  
  // 至少包含一個大寫字母
  if (!/[A-Z]/.test(password)) {
    errors.push('密碼必須包含至少一個大寫字母');
  }
  
  // 至少包含一個小寫字母
  if (!/[a-z]/.test(password)) {
    errors.push('密碼必須包含至少一個小寫字母');
  }
  
  // 至少包含一個數字
  if (!/[0-9]/.test(password)) {
    errors.push('密碼必須包含至少一個數字');
  }
  
  // 至少包含一個特殊字符
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密碼必須包含至少一個特殊字符 (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  return errors;
};

const ChangePassword = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);
  const { changePassword } = useAuth();

  const handleClickShowPassword = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleMouseDownPassword = (e) => {
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors([]);

    if (formData.newPassword !== formData.confirmPassword) {
      await Swal.fire({
        icon: 'error',
        title: '密碼不一致',
        text: t('changePassword.passwordMismatch'),
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      return;
    }

    // 驗證密碼強度
    const validationErrors = validatePasswordStrength(formData.newPassword);
    if (validationErrors.length > 0) {
      setPasswordErrors(validationErrors);
      const errorList = validationErrors.map(err => `• ${err}`).join('<br>');
      await Swal.fire({
        icon: 'error',
        title: '密碼不符合強度要求',
        html: errorList,
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      return;
    }

    setLoading(true);

    const result = await changePassword(formData.currentPassword, formData.newPassword);

    if (result.success) {
      await Swal.fire({
        icon: 'success',
        title: '密碼更改成功',
        text: t('changePassword.passwordChanged'),
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordErrors([]);
    } else {
      await Swal.fire({
        icon: 'error',
        title: '更改密碼失敗',
        text: result.message,
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          {t('changePassword.title')}
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            margin="normal"
            required
            fullWidth
            label={t('changePassword.currentPassword')}
            type={showPassword.currentPassword ? 'text' : 'password'}
            value={formData.currentPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="切換密碼顯示"
                    onClick={() => handleClickShowPassword('currentPassword')}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showPassword.currentPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label={t('changePassword.newPassword')}
            type={showPassword.newPassword ? 'text' : 'password'}
            value={formData.newPassword}
            onChange={(e) => {
              setFormData(prev => ({ ...prev, newPassword: e.target.value }));
              // 即時驗證密碼強度
              if (e.target.value) {
                const validationErrors = validatePasswordStrength(e.target.value);
                setPasswordErrors(validationErrors);
              } else {
                setPasswordErrors([]);
              }
            }}
            helperText={
              formData.newPassword && passwordErrors.length > 0
                ? '密碼要求：至少 8 個字符，包含大小寫字母、數字和特殊字符'
                : formData.newPassword && passwordErrors.length === 0
                ? '密碼強度符合要求'
                : '密碼要求：至少 8 個字符，包含大小寫字母、數字和特殊字符'
            }
            error={formData.newPassword && passwordErrors.length > 0}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="切換密碼顯示"
                    onClick={() => handleClickShowPassword('newPassword')}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showPassword.newPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label={t('changePassword.confirmPassword')}
            type={showPassword.confirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="切換密碼顯示"
                    onClick={() => handleClickShowPassword('confirmPassword')}
                    onMouseDown={handleMouseDownPassword}
                    edge="end"
                  >
                    {showPassword.confirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? t('changePassword.changing') : t('changePassword.changeButton')}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ChangePassword;

