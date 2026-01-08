import React, { useState, useEffect } from 'react';
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
  useMediaQuery,
  Badge
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
  Language as LanguageIcon,
  Notifications as NotificationsIcon,
  Link as LinkIcon,
  Build as BuildIcon,
  CalendarToday as CalendarTodayIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

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
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
    // 設置定時刷新，每30秒更新一次
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // 當路由變化到批核相關頁面時，刷新待批核數量
  useEffect(() => {
    if (location.pathname.startsWith('/approval') || location.pathname === '/my-approvals') {
      fetchPendingCount();
    }
  }, [location.pathname]);

  const fetchPendingCount = async () => {
    try {
      const response = await axios.get('/api/approvals/pending');
      const count = response.data.applications?.length || 0;
      setPendingCount(count);
    } catch (error) {
      console.error('獲取待批核數量錯誤:', error);
      setPendingCount(0);
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardIcon />, path: '/', show: true },
    { key: 'announcements', icon: <NotificationsIcon />, path: '/announcements', show: true },
    { key: 'myApplications', icon: <AssignmentIcon />, path: '/my-applications', show: true },
    { 
      key: 'myApprovals', 
      icon: (
        <Badge badgeContent={pendingCount} color="error" max={99}>
          <CheckCircleIcon />
        </Badge>
      ), 
      path: '/my-approvals', 
      show: true 
    },
    { key: 'schedule', icon: <CalendarTodayIcon />, path: '/schedule', show: true },
    { key: 'attendance', icon: <AccessTimeIcon />, path: '/attendance', show: true },
    { key: 'groupLeaveCalendar', icon: <EventNoteIcon />, path: '/group-leave-calendar', show: true },
    { key: 'myDocuments', icon: <DescriptionIcon />, path: '/documents/my', show: true },
    { key: 'tools', icon: <BuildIcon />, path: '/tools', show: true },
    { key: 'documentUpload', icon: <DescriptionIcon />, path: '/documents/upload', show: isSystemAdmin },
    { key: 'manualApproval', icon: <AssignmentIcon />, path: '/manual-approval', show: isSystemAdmin },
    { key: 'systemMaintenance', icon: <SettingsIcon />, path: '/system-maintenance', show: isSystemAdmin }
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

