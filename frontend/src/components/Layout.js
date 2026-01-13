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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
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
  Chat as ChatIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import logo from './logo.webp';

const drawerWidth = 180;
const drawerWidthCollapsed = 64;

const Layout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout, isSystemAdmin, isDeptHead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopDrawerOpen, setDesktopDrawerOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [langAnchorEl, setLangAnchorEl] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    fetchPendingCount();
    fetchUnreadChatCount();
    // 設置定時刷新，減少更新頻率
    const interval = setInterval(() => {
      fetchPendingCount();
      // 只在不在訊息傳遞頁面時更新未讀數量（避免重複請求）
      const currentPath = window.location.pathname;
      if (currentPath !== '/chat') {
        fetchUnreadChatCount();
      }
    }, 60000); // 改為每60秒更新一次
    return () => clearInterval(interval);
  }, []);

  // 當路由變化到批核相關頁面時，刷新待批核數量
  useEffect(() => {
    if (location.pathname.startsWith('/approval') || location.pathname === '/my-approvals') {
      fetchPendingCount();
    }
  }, [location.pathname]);

  // 當路由變化到訊息傳遞頁面時，刷新未讀訊息數量
  useEffect(() => {
    if (location.pathname === '/chat') {
      fetchUnreadChatCount();
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

  const fetchUnreadChatCount = async () => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    console.log(`📨 [Layout] fetchUnreadChatCount 開始 - 時間: ${timestamp}`);
    
    try {
      const response = await axios.get('/api/chat/unread-count');
      const duration = Date.now() - startTime;
      const count = response.data.unreadCount || 0;
      setUnreadChatCount(count);
      console.log(`✅ [Layout] fetchUnreadChatCount 成功 - 未讀數量: ${count}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      console.log(`${statusIcon} [Layout] fetchUnreadChatCount 失敗 - 狀態: ${status}, 錯誤: ${error.response?.data?.message || error.message}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      console.error('獲取未讀訊息數量錯誤:', error);
      setUnreadChatCount(0);
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardIcon />, path: '/', show: true },
    { key: 'announcements', icon: <NotificationsIcon />, path: '/announcements', show: true },
    { 
      key: 'chatRoom', 
      icon: (
        <Badge badgeContent={unreadChatCount} color="error" max={99}>
          <ChatIcon />
        </Badge>
      ), 
      path: '/chat', 
      show: true 
    },
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
    { key: 'shiftManagement', icon: <CalendarTodayIcon />, path: '/shift-management', show: true },
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

  const handleDesktopDrawerToggle = () => {
    setDesktopDrawerOpen(!desktopDrawerOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const drawer = (
    <Box>
      <Toolbar 
        sx={{ 
          bgcolor: 'primary.main', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: { xs: '56px', sm: '64px' },
          px: { xs: 2, sm: 3 },
          position: 'relative'
        }}
      >
        {((!isMobile && desktopDrawerOpen) || isMobile) && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
          >
            <img
              src={logo}
              alt="Logo"
              style={{
                maxWidth: '40px',
                maxHeight: '40px',
                width: 'auto',
                height: 'auto',
                borderRadius: '6px',
              }}
            />
          </Box>
        )}
        {!isMobile && (
          <IconButton
            onClick={handleDesktopDrawerToggle}
            sx={{ 
              color: 'white',
              ml: 'auto',
              zIndex: 1
            }}
            title={desktopDrawerOpen ? t('layout.collapseMenu') || '收起選單' : t('layout.expandMenu') || '展開選單'}
          >
            {desktopDrawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        )}
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
              sx={{
                justifyContent: (!isMobile && !desktopDrawerOpen) ? 'center' : 'flex-start',
                minHeight: 48,
                px: (!isMobile && !desktopDrawerOpen) ? 1.5 : 2,
              }}
              title={(!isMobile && !desktopDrawerOpen) ? t(`layout.${item.key}`) : ''}
            >
              <ListItemIcon 
                sx={{ 
                  color: location.pathname === item.path ? 'primary.main' : 'inherit',
                  minWidth: (!isMobile && !desktopDrawerOpen) ? 'auto' : 40,
                  justifyContent: 'center'
                }}
              >
                {item.icon}
              </ListItemIcon>
              {((!isMobile && desktopDrawerOpen) || isMobile) && (
                <ListItemText 
                  primary={t(`layout.${item.key}`)}
                  primaryTypographyProps={{
                    fontSize: '0.875rem'
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  const currentDrawerWidth = (!isMobile && !desktopDrawerOpen) ? drawerWidthCollapsed : drawerWidth;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          ml: { md: `${currentDrawerWidth}px` },
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
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
        sx={{ 
          width: { md: currentDrawerWidth }, 
          flexShrink: { md: 0 },
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
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
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: currentDrawerWidth,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
          open={desktopDrawerOpen}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 2.5, md: 2 },
          width: { md: `calc(100% - ${currentDrawerWidth}px)` },
          mt: { xs: 7, sm: 8 },
          transition: theme.transitions.create(['width', 'padding'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
          maxWidth: '100%',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default Layout;

