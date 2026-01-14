import React, { useState, useEffect, useCallback, memo } from 'react';
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
  useMediaQuery,
  Switch,
  FormControlLabel,
  Tooltip,
  Pagination,
  CircularProgress
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Search as SearchIcon } from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../utils/dateFormat';
import UserFormDialog from '../components/UserFormDialog';
import { useAuth } from '../contexts/AuthContext';

// 將表格行提取為獨立的 memoized 組件，避免不必要的重新渲染
const UserTableRow = memo(({ user, onEdit, onToggleForcePasswordChange, i18n, t, isMobile, index, isHRMember }) => {
  const departmentName = i18n.language === 'en' 
    ? (user.department_name || user.department_name_zh || '-')
    : (user.department_name_zh || user.department_name || '-');
  const displayName = user.display_name || user.name_zh || '-';
  const positionName = i18n.language === 'en' 
    ? (user.position_name || user.position_name_zh || '-')
    : (user.position_name_zh || user.position_name || '-');
  const statusText = user.deactivated ? t('adminUsers.deactivated') : t('adminUsers.active');
  
  const handleForcePasswordChangeToggle = async (e) => {
    e.stopPropagation();
    await onToggleForcePasswordChange(user.id, e.target.checked);
  };
  
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
          </Grid>

          <Divider sx={{ my: 1.5 }} />

          {isHRMember && (
            <Box sx={{ mb: 1.5 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!user.force_password_change}
                    onChange={handleForcePasswordChangeToggle}
                    size="small"
                    color="warning"
                  />
                }
                label={t('adminUsers.forcePasswordChange')}
              />
            </Box>
          )}
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
      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{departmentName}</TableCell>
      <TableCell sx={{ 
        whiteSpace: 'nowrap', 
        color: 'text.secondary', 
        width: '15%',
        maxWidth: '15%',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>{positionName}</TableCell>
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
const UsersTable = memo(({ users, onEdit, onToggleForcePasswordChange, i18n, t, isMobile, isTablet, isHRMember }) => {
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
              onToggleForcePasswordChange={onToggleForcePasswordChange}
              i18n={i18n}
              t={t}
              isMobile={isMobile}
              isHRMember={isHRMember}
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
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.department')}</TableCell>
              <TableCell sx={{ 
                whiteSpace: 'nowrap', 
                width: '15%',
                maxWidth: '15%',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>{t('adminUsers.position')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.accountStatus')}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{t('adminUsers.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
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
                  onToggleForcePasswordChange={onToggleForcePasswordChange}
                  i18n={i18n}
                  t={t}
                  isMobile={false}
                  index={index}
                  isHRMember={isHRMember}
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
  const { user: currentUser } = useAuth();
  const isHRMember = currentUser?.is_hr_member || currentUser?.is_system_admin;
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingUserData, setEditingUserData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15); // 每頁顯示數量
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(() => {
    setSearchKeyword(searchTerm);
    setPage(1); // 搜尋時重置到第一頁
  }, [searchTerm]);

  const handleSearchKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // 處理搜尋輸入框的變化 - 只更新本地狀態，不觸發任何 API 調用
  const handleSearchTermChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // 處理分頁變化
  const handlePageChange = useCallback((event, value) => {
    setPage(value);
  }, []);

  // 當 page 或 searchKeyword 變化時重新獲取數據
  useEffect(() => {
    fetchUsers();
  }, [page, searchKeyword]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit
      };
      
      if (searchKeyword.trim()) {
        params.search = searchKeyword.trim();
      }

      const response = await axios.get('/api/admin/users', { params });
      setUsers(response.data.users || []);
      
      if (response.data.pagination) {
        setTotal(response.data.pagination.total || 0);
        setTotalPages(response.data.pagination.totalPages || 1);
      }
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchKeyword]);

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
    // 重新獲取當前頁的數據
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleForcePasswordChange = useCallback(async (userId, forcePasswordChange) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, { force_password_change: forcePasswordChange });
      // 更新本地狀態
      setUsers(prevUsers => 
        prevUsers.map(u => 
          u.id === userId ? { ...u, force_password_change: forcePasswordChange } : u
        )
      );
    } catch (error) {
      console.error('Toggle force password change error:', error);
      alert(error.response?.data?.message || t('adminUsers.operationFailed'));
    }
  }, [t]);

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

      {total > 0 && (
        <Paper 
          elevation={2}
          sx={{ 
            p: { xs: 2, sm: 3 },
            mb: 3,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            總共: {total} {t('adminUsers.title') || '用戶'}
          </Typography>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <UsersTable 
            users={users} 
            onEdit={handleEdit}
            onToggleForcePasswordChange={handleToggleForcePasswordChange}
            i18n={i18n}
            t={t}
            isMobile={isMobile}
            isTablet={isTablet}
            isHRMember={isHRMember}
          />
          
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 2 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                size={isMobile ? 'small' : 'medium'}
                showFirstButton
                showLastButton
                sx={{
                  '& .MuiPaginationItem-root': {
                    fontSize: { xs: '0.875rem', sm: '1rem' }
                  }
                }}
              />
            </Box>
          )}
        </>
      )}

      <UserFormDialog
        open={open}
        editing={editing}
        initialData={editingUserData}
        onClose={handleClose}
        onSuccess={handleSuccess}
        isHRMember={isHRMember}
        onToggleForcePasswordChange={handleToggleForcePasswordChange}
      />
    </Box>
  );
};

export default AdminUsers;
