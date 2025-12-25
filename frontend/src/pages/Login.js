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
  MenuItem
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import logo from '../components/logo.webp';

const Login = () => {
  const { t, i18n } = useTranslation();
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

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
      setError(result.message || t('login.loginFailed'));
    }
    
    setLoading(false);
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative'
        }}
      >
        <IconButton
          onClick={(e) => setLangAnchorEl(e.currentTarget)}
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            mt: 2,
            mr: 2
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
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{
                maxWidth: '100px',
                maxHeight: '100px',
                width: 'auto',
                height: 'auto',
                borderRadius: '12px',
              }}
            />
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
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
  );
};

export default Login;

