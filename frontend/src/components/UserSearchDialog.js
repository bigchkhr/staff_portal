import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  Typography,
  InputAdornment
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// 優化 ListItem 組件，避免不必要的重新渲染
const UserListItem = memo(({ user, selected, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(user);
  }, [user.id, user.employee_number, onSelect]);

  const primaryText = useMemo(() => 
    `${user.employee_number} - ${user.display_name || user.name_zh || '-'}`,
    [user.employee_number, user.display_name, user.name_zh]
  );

  const secondaryText = useMemo(() => user.email || '', [user.email]);

  return (
    <ListItem disablePadding>
      <ListItemButton selected={selected} onClick={handleClick}>
        <ListItemText
          primary={primaryText}
          secondary={secondaryText}
        />
      </ListItemButton>
    </ListItem>
  );
}, (prevProps, nextProps) => {
  // 自定義比較函數，只有當關鍵屬性改變時才重新渲染
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.employee_number === nextProps.user.employee_number &&
    prevProps.user.display_name === nextProps.user.display_name &&
    prevProps.user.name_zh === nextProps.user.name_zh &&
    prevProps.user.email === nextProps.user.email &&
    prevProps.selected === nextProps.selected &&
    prevProps.onSelect === nextProps.onSelect
  );
});

UserListItem.displayName = 'UserListItem';

const UserSearchDialog = ({ open, onClose, onSelect, selectedUserId = null }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
      setSearchTerm('');
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按 employee_number 排序
      usersList.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
      setFilteredUsers(usersList); // 初始顯示所有用戶
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    const trimmedSearch = searchTerm.trim().toLowerCase();
    
    if (!trimmedSearch) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter((u) => {
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
        const value = candidate.toString().toLowerCase();
        return value.includes(trimmedSearch);
      });
    });

    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleSelect = useCallback((user) => {
    onSelect(user);
    onClose();
  }, [onSelect, onClose]);

  const handleSearchTermChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // 優化 InputProps，避免每次渲染都創建新對象
  const inputProps = useMemo(() => ({
    startAdornment: (
      <InputAdornment position="start">
        <SearchIcon />
      </InputAdornment>
    ),
  }), []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('adminPaperFlow.selectApplicant')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, mt: 1 }}>
          <TextField
            fullWidth
            placeholder={t('adminPaperFlow.searchUserPlaceholder')}
            value={searchTerm}
            onChange={handleSearchTermChange}
            onKeyPress={handleKeyPress}
            InputProps={inputProps}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handleSearch}
            sx={{ minWidth: 100 }}
          >
            {t('common.search')}
          </Button>
        </Box>
        <UserList 
          loading={loading}
          filteredUsers={filteredUsers}
          selectedUserId={selectedUserId}
          onSelect={handleSelect}
          t={t}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
};

// 優化用戶列表組件，避免在輸入時重新渲染
const UserList = memo(({ loading, filteredUsers, selectedUserId, onSelect, t }) => {
  if (loading) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {t('common.loading')}
      </Typography>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {t('adminPaperFlow.noUsersFound')}
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
      <List>
        {filteredUsers.map((user) => (
          <UserListItem
            key={user.id}
            user={user}
            selected={selectedUserId === user.id}
            onSelect={onSelect}
          />
        ))}
      </List>
    </Box>
  );
}, (prevProps, nextProps) => {
  // 自定義比較函數，只有當關鍵屬性改變時才重新渲染
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.selectedUserId !== nextProps.selectedUserId) return false;
  if (prevProps.filteredUsers.length !== nextProps.filteredUsers.length) return false;
  
  // 檢查 filteredUsers 的 ID 是否相同
  const prevIds = prevProps.filteredUsers.map(u => u.id).sort().join(',');
  const nextIds = nextProps.filteredUsers.map(u => u.id).sort().join(',');
  if (prevIds !== nextIds) return false;
  
  return true;
});

UserList.displayName = 'UserList';

export default UserSearchDialog;

