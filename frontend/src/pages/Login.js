import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  InputAdornment
} from '@mui/material';
import { keyframes } from '@mui/system';
import { 
  Language as LanguageIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import logo from '../components/logo.webp';

const Login = () => {
  const { t, i18n } = useTranslation();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const gradientShift = keyframes`
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  `;

  const logoShine = keyframes`
    0% {
      transform: translate(-120%, 120%) rotate(45deg);
      opacity: 0;
    }
    2% {
      opacity: 1;
    }
    4% {
      transform: translate(120%, -120%) rotate(45deg);
      opacity: 1;
    }
    6% {
      opacity: 0;
    }
    100% {
      transform: translate(120%, -120%) rotate(45deg);
      opacity: 0;
    }
  `;

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setLangAnchorEl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Login form submitted:', { employeeNumber, password: '***' });

    const result = await login(employeeNumber, password);
    
    console.log('Login result:', result);
    
    if (result.success) {
      console.log('Navigating to dashboard...');
      navigate('/');
    } else {
      console.error('Login failed:', result.message);
      // 顯示錯誤訊息，優先使用返回的訊息
      const errorMsg = result.message || t('login.loginFailed');
      setError(errorMsg);
    }
    
    setLoading(false);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(-45deg, #FFE87C, #FFD89B, #87CEEB, #B0E0E6, #ADD8E6, #FFE87C)',
        backgroundSize: '400% 400%',
        animation: `${gradientShift} 15s ease infinite`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4
      }}
    >
      <Container component="main" maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <IconButton
          onClick={(e) => setLangAnchorEl(e.currentTarget)}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 1)',
            },
            boxShadow: 2
          }}
          title={t('language.selectLanguage')}
        >
          <LanguageIcon />
        </IconButton>
        <Menu
          anchorEl={langAnchorEl}
          open={Boolean(langAnchorEl)}
          onClose={() => setLangAnchorEl(null)}
        >
          <MenuItem onClick={() => handleLanguageChange('zh-TW')}>
            {t('language.zhTW')}
          </MenuItem>
          <MenuItem onClick={() => handleLanguageChange('zh-CN')}>
            {t('language.zhCN')}
          </MenuItem>
          <MenuItem onClick={() => handleLanguageChange('en')}>
            {t('language.en')}
          </MenuItem>
        </Menu>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative'
          }}
        >
        <Paper 
          elevation={3} 
          sx={{ 
            p: 4, 
            width: '100%',
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mb: 3,
              position: 'relative',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                maxWidth: '100px',
                maxHeight: '100px',
                width: '100px',
                height: '100px',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={logo}
                alt="Logo"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '300%',
                  height: '20px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 20%, rgba(255, 255, 255, 0.9) 50%, rgba(255, 255, 255, 0.3) 80%, transparent 100%)',
                  transformOrigin: 'center',
                  animation: `${logoShine} 15s linear infinite`,
                  pointerEvents: 'none',
                  zIndex: 1,
                  boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)',
                }}
              />
            </Box>
          </Box>
          <Typography component="h1" variant="h4" align="center" gutterBottom>
          {t('login.title')}
          </Typography>
          <Typography component="h2" variant="h6" align="center" color="text.secondary" sx={{ mb: 3 }}>
          {t('login.subtitle')}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="employee_number"
              label={t('login.employeeNumber')}
              name="employee_number"
              autoComplete="username"
              autoFocus
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('login.password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? t('login.loggingIn') : t('login.loginButton')}
            </Button>
            <Typography 
              variant="body2" 
              align="center"
              sx={{ 
                mt: 2,
                color: 'error.main',
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
            >
              {t('login.disclaimer')}
            </Typography>
          </Box>
        </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default Login;

