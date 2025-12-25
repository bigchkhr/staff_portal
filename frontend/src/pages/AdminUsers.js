import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Card,
  CardContent,
  Grid,
  Divider,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/dateFormat';
import UserFormDialog from '../components/UserFormDialog';

// 將表格行提取為獨立的 memoized 組件，避免不必要的重新渲染
const UserTableRow = memo(({ user, onEdit, i18n, t, isMobile, index }) => {
  const departmentName = i18n.language === 'en' 
    ? (user.department_name || user.department_name_zh || '-')
    : (user.department_name_zh || user.department_name || '-');
  const displayName = user.display_name || user.name_zh || '-';
  const positionName = user.position_name_zh || '-';
  const hireDate = formatDate(user.hire_date);
  const statusText = user.deactivated ? t('adminUsers.deactivated') : t('adminUsers.active');
  
  if (isMobile) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.employeeNumber')}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {user.employee_number}
              </Typography>
            </Box>
            <Typography 
              variant="body2" 
              sx={{ 
                color: user.deactivated ? 'error.main' : 'success.main',
                fontWeight: 'medium'
              }}
            >
              {statusText}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Grid container spacing={1.5}>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.name')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {displayName}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.email')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {user.email}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.department')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {departmentName}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.position')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {positionName}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('adminUsers.hireDate')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {hireDate}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => onEdit(user)}
          >
            {t('adminUsers.edit')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <TableRow
      sx={{
        '&:nth-of-type(even)': {
          backgroundColor: 'action.hover'
        },
        '&:hover': {
          backgroundColor: 'action.selected'
        },
        transition: 'background-color 0.2s'
      }}
    >
      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{user.employee_number}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{displayName}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{user.email}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{departmentName}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{positionName}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{hireDate}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <Chip
          label={statusText}
          color={user.deactivated ? 'error' : 'success'}
          size="small"
          sx={{ fontWeight: 500 }}
        />
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>
        <IconButton 
          size="small" 
          onClick={() => onEdit(user)}
          color="primary"
          sx={{
            '&:hover': {
              backgroundColor: 'primary.light',
              color: 'white'
            },
            transition: 'all 0.2s'
          }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
});

UserTableRow.displayName = 'UserTableRow';

// 將表格提取為獨立的 memoized 組件，只有當 filteredUsers 改變時才重新渲染
const UsersTable = memo(({ users, onEdit, i18n, t, isMobile, isTablet }) => {
  if (isMobile) {
    return (
      <Box>
        {users.length === 0 ? (
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('adminUsers.noUsers')}
            </Typography>
          </Paper>
        ) : (
          users.map((u) => (
            <UserTableRow 
              key={u.id} 
              user={u} 
              onEdit={onEdit}
              i18n={i18n}
              t={t}
              isMobile={isMobile}
            />
          ))
        )}
      </Box>
    );
  }

  return (
    <Paper 
      elevation={2}
      sx={{ 
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <TableContainer sx={{ 
        maxWidth: '100%',
        overflowX: 'auto',
        '& .MuiTableCell-root': {
          fontSize: { xs: '0.75rem', sm: '0.875rem' },
          padding: { xs: '12px', sm: '16px' },
          whiteSpace: 'nowrap'
        }
      }}>
        <Table size={isTablet ? "small" : "medium"}>
          <TableHead>
            <TableRow sx={{ 
              backgroundColor: 'primary.main',
              '& .MuiTableCell-head': {
                color: 'white',
                fontWeight: 600,
                fontSize: '0.95rem'
              }
            }}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.employeeNumber')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.name')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.email')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.department')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.position')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.hireDate')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.accountStatus')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('adminUsers.noUsers')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((u, index) => (
                <UserTableRow 
                  key={u.id} 
                  user={u} 
                  onEdit={onEdit}
                  i18n={i18n}
                  t={t}
                  isMobile={false}
                  index={index}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
});

UsersTable.displayName = 'UsersTable';

const AdminUsers = () => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingUserData, setEditingUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredUsers = useMemo(() => {
    const trimmedSearch = searchKeyword.trim();
    const normalizedSearch = trimmedSearch.toLowerCase();
    
    if (!trimmedSearch) {
      return users;
    }

    return users.filter((u) => {
      const englishFullName = `${u.given_name || ''} ${u.surname || ''}`.trim();
      const reversedEnglishFullName = `${u.surname || ''} ${u.given_name || ''}`.trim();

      const candidates = [
        u.id?.toString() || '',
        u.employee_number || '',
        englishFullName,
        reversedEnglishFullName,
        u.surname || '',
        u.given_name || '',
        u.display_name || '',
        u.name_zh || '',
        u.alias || ''
      ];

      return candidates.some((candidate) => {
        const value = candidate.toString();
        return (
          value.toLowerCase().includes(normalizedSearch) ||
          value.includes(trimmedSearch)
        );
      });
    });
  }, [users, searchKeyword]);

  const handleSearch = useCallback(() => {
    setSearchKeyword(searchTerm);
  }, [searchTerm]);

  const handleSearchKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 處理搜尋輸入框的變化 - 只更新本地狀態，不觸發任何 API 調用
  const handleSearchTermChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    // 注意：這裡只更新 searchTerm，不會觸發任何後端 API 調用
    // 只有點擊搜尋按鈕或按 Enter 鍵時才會更新 searchKeyword，觸發前端過濾
  }, []);

  // 只在組件初始化時獲取用戶列表一次
  useEffect(() => {
    fetchUsers();
  }, []); // 空依賴數組確保只執行一次

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  }, []);

  const handleOpen = useCallback(() => {
    setEditing(null);
    setEditingUserData(null);
    setOpen(true);
  }, []);

  const handleEdit = useCallback((userData) => {
    setEditing(userData.id);
    setEditingUserData(userData);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setEditing(null);
    setEditingUserData(null);
  }, []);

  const handleSuccess = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Box sx={{ px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{ 
          fontSize: { xs: '1.5rem', sm: '2rem' }, 
          mb: 3,
          fontWeight: 600,
          color: 'primary.main'
        }}
      >
        {t('adminUsers.title')}
      </Typography>

      <Paper 
        elevation={2}
        sx={{ 
          p: { xs: 2, sm: 3 }, 
          mb: 3,
          borderRadius: 2,
          background: 'linear-gradient(to bottom, #ffffff, #f8f9fa)'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            flexWrap: 'wrap',
            alignItems: { xs: 'stretch', sm: 'flex-end' },
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box sx={{ 
            display: 'flex',
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            flex: { xs: '1 1 100%', sm: '1 1 auto' },
            minWidth: { xs: '100%', sm: 300 },
            alignItems: 'flex-end'
          }}>
            <TextField
              label={t('common.search')}
              size="small"
              placeholder={t('adminUsers.searchPlaceholder')}
              value={searchTerm}
              onChange={handleSearchTermChange}
              onKeyPress={handleSearchKeyPress}
              sx={{ 
                flex: 1,
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
              fullWidth
            />
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              sx={{
                height: { xs: '48px', sm: '56px' },
                minWidth: { xs: '60px', sm: '100px' },
                borderRadius: 1,
                fontWeight: 500,
                boxShadow: 2,
                '&:hover': {
                  boxShadow: 4
                }
              }}
            >
              {isMobile ? '' : t('common.search')}
            </Button>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={handleOpen}
            fullWidth={isMobile}
            sx={{
              borderRadius: 1,
              fontWeight: 600,
              boxShadow: 2,
              height: { xs: '48px', sm: '56px' },
              width: { xs: '100%', sm: 'auto' },
              '&:hover': {
                boxShadow: 4
              }
            }}
          >
            {t('adminUsers.addUser')}
          </Button>
        </Box>
      </Paper>

      <UsersTable 
        users={filteredUsers} 
        onEdit={handleEdit}
        i18n={i18n}
        t={t}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <UserFormDialog
        open={open}
        editing={editing}
        initialData={editingUserData}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </Box>
  );
};

export default AdminUsers;
