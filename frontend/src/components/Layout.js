import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Business as BusinessIcon,
  Work as WorkIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  Lock as LockIcon,
  ExitToApp as ExitToAppIcon,
  Description as DescriptionIcon,
  Language as LanguageIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 260;

const Layout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout, isSystemAdmin, isDeptHead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [langAnchorEl, setLangAnchorEl] = useState(null);

  const menuItems = [
    { key: 'dashboard', icon: <DashboardIcon />, path: '/', show: true },
    { key: 'applyLeave', icon: <AssignmentIcon />, path: '/leave/apply', show: true },
    { key: 'leaveHistory', icon: <HistoryIcon />, path: '/leave/history', show: true },
    { key: 'leaveBalance', icon: <AccountBalanceIcon />, path: '/leave/balance', show: true },
    { key: 'myDocuments', icon: <DescriptionIcon />, path: '/documents/my', show: true },
    { key: 'formLibrary', icon: <DescriptionIcon />, path: '/form-library', show: true },
    { key: 'pendingApproval', icon: <CheckCircleIcon />, path: '/approval/list', show: true },
    { key: 'approvalHistory', icon: <HistoryIcon />, path: '/approval/history', show: true },
    { key: 'departmentGroupBalances', icon: <AccountBalanceIcon />, path: '/department-group-balances', show: true },
    { key: 'documentUpload', icon: <DescriptionIcon />, path: '/documents/upload', show: isSystemAdmin },
    { key: 'paperFlow', icon: <DescriptionIcon />, path: '/admin/paper-flow', show: isSystemAdmin },
    { key: 'userManagement', icon: <PeopleIcon />, path: '/admin/users', show: isSystemAdmin },
    { key: 'leaveTypeManagement', icon: <EventNoteIcon />, path: '/admin/leave-types', show: isSystemAdmin },
    { key: 'balanceManagement', icon: <AccountBalanceWalletIcon />, path: '/admin/balances', show: isSystemAdmin },
    { key: 'departmentManagement', icon: <BusinessIcon />, path: '/admin/departments', show: isSystemAdmin },
    { key: 'positionManagement', icon: <WorkIcon />, path: '/admin/positions', show: isSystemAdmin },
    { key: 'groupManagement', icon: <GroupIcon />, path: '/admin/groups', show: isSystemAdmin }
  ];

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    setLangAnchorEl(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const drawer = (
    <Box>
      <Toolbar sx={{ bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6" noWrap component="div">
          {t('layout.appTitle')}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.filter(item => item.show).map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
            >
              <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={t(`layout.${item.key}`)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.path === location.pathname) ? 
              t(`layout.${menuItems.find(item => item.path === location.pathname)?.key}`) : 
              t('layout.systemTitle')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={(e) => setLangAnchorEl(e.currentTarget)}
              sx={{ color: 'white' }}
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
            <Typography variant="body2">{user?.display_name || `${user?.surname} ${user?.given_name}`}</Typography>
            <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                {user?.display_name?.charAt(0) || user?.surname?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={() => { navigate('/change-password'); handleMenuClose(); }}>
              <ListItemIcon>
                <LockIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('layout.changePassword')}</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { 
              handleMenuClose();
              logout();
              navigate('/login');
            }}>
              <ListItemIcon>
                <ExitToAppIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('layout.logout')}</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: 8
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

