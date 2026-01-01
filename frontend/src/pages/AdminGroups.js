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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  ListItemButton
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Group as GroupIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

// 優化用戶列表項組件，避免不必要的重新渲染
const UserListItem = memo(({ user, onAddMember }) => {
  const handleClick = useCallback(() => {
    onAddMember(user.id);
  }, [user.id, onAddMember]);

  const primaryText = useMemo(() => 
    `${user.employee_number} - ${user.display_name || user.name_zh || '-'}`,
    [user.employee_number, user.display_name, user.name_zh]
  );

  const secondaryText = useMemo(() => user.email || '', [user.email]);

  return (
    <ListItem disablePadding>
      <ListItemButton onClick={handleClick}>
        <ListItemText
          primary={primaryText}
          secondary={secondaryText}
        />
      </ListItemButton>
    </ListItem>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.user.id === nextProps.user.id &&
    prevProps.user.employee_number === nextProps.user.employee_number &&
    prevProps.user.display_name === nextProps.user.display_name &&
    prevProps.user.name_zh === nextProps.user.name_zh &&
    prevProps.user.email === nextProps.user.email &&
    prevProps.onAddMember === nextProps.onAddMember
  );
});

UserListItem.displayName = 'UserListItem';

// 優化用戶列表組件，避免在輸入時重新渲染
const UserList = memo(({ filteredUsers, onAddMember, memberSearchKeyword, t }) => {
  if (filteredUsers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {memberSearchKeyword.trim() ? t('adminPaperFlow.noUsersFound') : t('adminGroups.noUsersAvailable')}
      </Typography>
    );
  }

  return (
    <Box sx={{ maxHeight: 200, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <List dense>
        {filteredUsers.map((user) => (
          <UserListItem
            key={user.id}
            user={user}
            onAddMember={onAddMember}
          />
        ))}
      </List>
    </Box>
  );
}, (prevProps, nextProps) => {
  if (prevProps.filteredUsers.length !== nextProps.filteredUsers.length) return false;
  if (prevProps.memberSearchKeyword !== nextProps.memberSearchKeyword) return false;
  
  // 檢查 filteredUsers 的 ID 是否相同
  const prevIds = prevProps.filteredUsers.map(u => u.id).sort().join(',');
  const nextIds = nextProps.filteredUsers.map(u => u.id).sort().join(',');
  if (prevIds !== nextIds) return false;
  
  return true;
});

UserList.displayName = 'UserList';

const AdminGroups = () => {
  const { t, i18n } = useTranslation();
  const [tabValue, setTabValue] = useState(0);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [delegationGroups, setDelegationGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedGroupType, setSelectedGroupType] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [closedFilter, setClosedFilter] = useState('all'); // 'all', 'active', 'closed'
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSearchKeyword, setMemberSearchKeyword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    name_zh: '',
    description: '',
    checker_id: '',
    approver_1_id: '',
    approver_2_id: '',
    approver_3_id: '',
    closed: false
  });

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, [closedFilter]);

  const fetchGroups = async () => {
    try {
      // 根據 closedFilter 構建查詢參數
      const closedParam = closedFilter === 'all' ? undefined : (closedFilter === 'closed' ? 'true' : 'false');
      const deptParams = closedParam ? { params: { closed: closedParam } } : {};
      const delegParams = closedParam ? { params: { closed: closedParam } } : {};
      
      const [deptResponse, delegResponse] = await Promise.all([
        axios.get('/api/groups/department', deptParams),
        axios.get('/api/groups/delegation', delegParams)
      ]);
      setDepartmentGroups(deptResponse.data.groups || []);
      setDelegationGroups(delegResponse.data.groups || []);
    } catch (error) {
      console.error('Fetch groups error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users');
      const usersList = response.data.users || [];
      // 按 employee_number 排序
      usersList.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Fetch users error:', error);
    }
  };

  const handleOpen = (type) => {
    setEditing(null);
    setSelectedGroupType(type);
    if (type === 'department') {
      setFormData({ 
        name: '', 
        name_zh: '', 
        description: '',
        checker_id: '',
        approver_1_id: '',
        approver_2_id: '',
        approver_3_id: '',
        closed: false
      });
    } else {
      setFormData({ 
        name: '', 
        name_zh: '', 
        description: '',
        closed: false
      });
    }
    setOpen(true);
  };

  const handleEdit = (group, type) => {
    setEditing(group.id);
    setSelectedGroupType(type);
    if (type === 'department') {
      setFormData({
        name: group.name,
        name_zh: group.name_zh,
        description: group.description || '',
        checker_id: group.checker_id || '',
        approver_1_id: group.approver_1_id || '',
        approver_2_id: group.approver_2_id || '',
        approver_3_id: group.approver_3_id || '',
        closed: group.closed || false
      });
    } else {
      setFormData({
        name: group.name,
        name_zh: group.name_zh,
        description: group.description || '',
        closed: group.closed || false
      });
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    // 前端驗證必填欄位
    if (!formData.name || !formData.name_zh) {
      alert(t('adminGroups.fillRequiredFields'));
      return;
    }

    try {
      const endpoint = selectedGroupType === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      if (editing) {
        await axios.put(`${endpoint}/${editing}`, formData);
      } else {
        await axios.post(endpoint, formData);
      }
      setOpen(false);
      fetchGroups();
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || t('adminGroups.operationFailed');
      alert(errorMessage);
      console.error('Submit error:', error);
    }
  };

  const handleToggleClosed = async (group, type) => {
    const action = group.closed ? '啟用' : '關閉';
    const confirmed = window.confirm(`確定要${action}此群組嗎？`);
    if (!confirmed) {
      return;
    }

    try {
      const endpoint = type === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      await axios.put(`${endpoint}/${group.id}`, { ...group, closed: !group.closed });
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.message || `${action}群組失敗`);
    }
  };

  const handleOpenMembers = async (group, type) => {
    setSelectedGroup(group);
    setSelectedGroupType(type);
    setMemberSearchTerm('');
    setMemberSearchKeyword('');
    try {
      const endpoint = type === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      const response = await axios.get(`${endpoint}/${group.id}/members`);
      const members = response.data.members || [];
      // 按 employee_number 排序
      members.sort((a, b) => {
        const aNum = a.employee_number || '';
        const bNum = b.employee_number || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
      });
      setGroupMembers(members);
      setMembersDialogOpen(true);
    } catch (error) {
      console.error('Fetch members error:', error);
      const message = error.response?.data?.message || error.message || t('adminGroups.cannotLoadMembers');
      alert(message);
    }
  };

  const handleAddMember = useCallback(async (userId) => {
    try {
      const endpoint = selectedGroupType === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      await axios.post(`${endpoint}/${selectedGroup.id}/members`, { user_id: userId });
      handleOpenMembers(selectedGroup, selectedGroupType);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.message || t('adminGroups.addMemberFailed'));
    }
  }, [selectedGroup, selectedGroupType, t]);

  const handleRemoveMember = async (userId) => {
    try {
      const endpoint = selectedGroupType === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      await axios.delete(`${endpoint}/${selectedGroup.id}/members/${userId}`);
      handleOpenMembers(selectedGroup, selectedGroupType);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.message || t('adminGroups.removeMemberFailed'));
    }
  };

  // 計算可用用戶（排除已經是成員的用戶）- 使用 Set 優化性能
  const availableUsers = useMemo(() => {
    // 使用 Set 來存儲成員 ID，提高查找效率（O(1) vs O(n)）
    const memberIds = new Set(groupMembers.map(m => m.id));
    return users.filter(u => !memberIds.has(u.id));
  }, [users, groupMembers]);

  // 根據搜尋關鍵字過濾可用用戶（只在點擊搜尋按鈕或按 Enter 時更新）
  const filteredAvailableUsers = useMemo(() => {
    const trimmedSearch = memberSearchKeyword.trim().toLowerCase();
    
    if (!trimmedSearch) {
      return availableUsers;
    }

    return availableUsers.filter((u) => {
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
  }, [availableUsers, memberSearchKeyword]);

  // 優化 InputProps，避免每次渲染都創建新對象
  const memberSearchInputProps = useMemo(() => ({
    startAdornment: (
      <InputAdornment position="start">
        <SearchIcon />
      </InputAdornment>
    ),
  }), []);

  const handleMemberSearchChange = useCallback((e) => {
    // 直接更新狀態，不進行任何計算
    setMemberSearchTerm(e.target.value);
  }, []);

  const handleMemberSearch = useCallback(() => {
    setMemberSearchKeyword(memberSearchTerm);
  }, [memberSearchTerm]);

  const handleMemberSearchKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleMemberSearch();
    }
  }, [handleMemberSearch]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">{t('adminGroups.title')}</Typography>
      </Box>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab label={t('adminGroups.departmentGroups')} />
        <Tab label={t('adminGroups.delegationGroups')} />
      </Tabs>

      {tabValue === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpen('department')}
            >
              {t('adminGroups.addDepartmentGroup')}
            </Button>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>顯示狀態</InputLabel>
              <Select
                value={closedFilter}
                label="顯示狀態"
                onChange={(e) => setClosedFilter(e.target.value)}
              >
                <MenuItem value="all">全部</MenuItem>
                <MenuItem value="active">正常</MenuItem>
                <MenuItem value="closed">已關閉</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('adminGroups.name')}</TableCell>
                    <TableCell>{t('adminGroups.chineseName')}</TableCell>
                    <TableCell>{t('adminGroups.checkerGroup')}</TableCell>
                    <TableCell>{t('adminGroups.approver1Group')}</TableCell>
                    <TableCell>{t('adminGroups.approver2Group')}</TableCell>
                    <TableCell>{t('adminGroups.approver3Group')}</TableCell>
                    <TableCell>{t('adminGroups.memberCount')}</TableCell>
                    <TableCell>{t('adminGroups.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departmentGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </TableCell>
                      <TableCell>{group.name_zh}</TableCell>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.checker_name || group.checker_name_zh || '-')
                          : (group.checker_name_zh || group.checker_name || '-')}
                      </TableCell>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.approver_1_name || group.approver_1_name_zh || '-')
                          : (group.approver_1_name_zh || group.approver_1_name || '-')}
                      </TableCell>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.approver_2_name || group.approver_2_name_zh || '-')
                          : (group.approver_2_name_zh || group.approver_2_name || '-')}
                      </TableCell>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.approver_3_name || group.approver_3_name_zh || '-')
                          : (group.approver_3_name_zh || group.approver_3_name || '-')}
                      </TableCell>
                      <TableCell>{group.user_ids?.length || 0}</TableCell>
                      <TableCell>
                        <Chip 
                          label={group.closed ? '已關閉' : '正常'} 
                          color={group.closed ? 'default' : 'success'} 
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <IconButton size="small" onClick={() => handleEdit(group, 'department')}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenMembers(group, 'department')}>
                          <GroupIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleToggleClosed(group, 'department')}
                          color={group.closed ? 'success' : 'default'}
                        >
                          {group.closed ? <CheckCircleIcon /> : <BlockIcon />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      {tabValue === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpen('delegation')}
            >
              {t('adminGroups.addDelegationGroup')}
            </Button>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>顯示狀態</InputLabel>
              <Select
                value={closedFilter}
                label="顯示狀態"
                onChange={(e) => setClosedFilter(e.target.value)}
              >
                <MenuItem value="all">全部</MenuItem>
                <MenuItem value="active">正常</MenuItem>
                <MenuItem value="closed">已關閉</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('adminGroups.name')}</TableCell>
                    <TableCell>{t('adminGroups.chineseName')}</TableCell>
                    <TableCell>{t('adminGroups.description')}</TableCell>
                    <TableCell>{t('adminGroups.memberCount')}</TableCell>
                    <TableCell>{t('adminGroups.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {delegationGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </TableCell>
                      <TableCell>{group.name_zh}</TableCell>
                      <TableCell>{group.description || '-'}</TableCell>
                      <TableCell>{group.user_ids?.length || 0}</TableCell>
                      <TableCell>
                        <Chip 
                          label={group.closed ? '已關閉' : '正常'} 
                          color={group.closed ? 'default' : 'success'} 
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <IconButton size="small" onClick={() => handleEdit(group, 'delegation')}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenMembers(group, 'delegation')}>
                          <GroupIcon />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => handleToggleClosed(group, 'delegation')}
                          color={group.closed ? 'success' : 'default'}
                        >
                          {group.closed ? <CheckCircleIcon /> : <BlockIcon />}
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editing ? t('adminGroups.editDialogTitle') : t('adminGroups.addDialogTitle')}
          {selectedGroupType === 'department' ? t('adminGroups.departmentGroup') : t('adminGroups.delegationGroup')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('adminGroups.name')}
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
            <TextField
              label={t('adminGroups.chineseName')}
              value={formData.name_zh}
              onChange={(e) => setFormData(prev => ({ ...prev, name_zh: e.target.value }))}
              required
            />
            <TextField
              label={t('adminGroups.description')}
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
            {selectedGroupType === 'department' && (
              <>
                <FormControl>
                  <InputLabel>{t('adminGroups.checkerGroup')}</InputLabel>
                  <Select
                    value={formData.checker_id}
                    label={t('adminGroups.checkerGroup')}
                    onChange={(e) => setFormData(prev => ({ ...prev, checker_id: e.target.value }))}
                  >
                    <MenuItem value="">{t('adminGroups.none')}</MenuItem>
                    {delegationGroups.filter(g => !g.closed).map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>{t('adminGroups.approver1Group')}</InputLabel>
                  <Select
                    value={formData.approver_1_id}
                    label={t('adminGroups.approver1Group')}
                    onChange={(e) => setFormData(prev => ({ ...prev, approver_1_id: e.target.value }))}
                  >
                    <MenuItem value="">{t('adminGroups.none')}</MenuItem>
                    {delegationGroups.filter(g => !g.closed).map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>{t('adminGroups.approver2Group')}</InputLabel>
                  <Select
                    value={formData.approver_2_id}
                    label={t('adminGroups.approver2Group')}
                    onChange={(e) => setFormData(prev => ({ ...prev, approver_2_id: e.target.value }))}
                  >
                    <MenuItem value="">{t('adminGroups.none')}</MenuItem>
                    {delegationGroups.filter(g => !g.closed).map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <InputLabel>{t('adminGroups.approver3Group')}</InputLabel>
                  <Select
                    value={formData.approver_3_id}
                    label={t('adminGroups.approver3Group')}
                    onChange={(e) => setFormData(prev => ({ ...prev, approver_3_id: e.target.value }))}
                  >
                    <MenuItem value="">{t('adminGroups.none')}</MenuItem>
                    {delegationGroups.filter(g => !g.closed).map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {i18n.language === 'en' 
                          ? (group.name || group.name_zh || '-')
                          : (group.name_zh || group.name || '-')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
            <FormControl>
              <InputLabel>狀態</InputLabel>
              <Select
                value={formData.closed ? 'closed' : 'active'}
                label="狀態"
                onChange={(e) => setFormData(prev => ({ ...prev, closed: e.target.value === 'closed' }))}
              >
                <MenuItem value="active">正常</MenuItem>
                <MenuItem value="closed">已關閉</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('adminGroups.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('adminGroups.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={membersDialogOpen} onClose={() => setMembersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('adminGroups.membersDialogTitle', { 
            name: i18n.language === 'en' 
              ? (selectedGroup?.name || selectedGroup?.name_zh || '')
              : (selectedGroup?.name_zh || selectedGroup?.name || '')
          })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('adminGroups.addMember')}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                placeholder={t('adminPaperFlow.searchUserPlaceholder')}
                value={memberSearchTerm}
                onChange={handleMemberSearchChange}
                onKeyPress={handleMemberSearchKeyPress}
                InputProps={memberSearchInputProps}
              />
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={handleMemberSearch}
                sx={{ minWidth: 100 }}
              >
                {t('common.search')}
              </Button>
            </Box>
            <UserList
              filteredUsers={filteredAvailableUsers}
              onAddMember={handleAddMember}
              memberSearchKeyword={memberSearchKeyword}
              t={t}
            />
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('adminGroups.currentMembers')}</Typography>
          <List>
            {groupMembers.map((member) => (
              <ListItem key={member.id}>
                <ListItemText
                  primary={`${member.employee_number} (${member.display_name})`}
                  secondary={i18n.language === 'en' 
                    ? (member.department_name || member.department_name_zh || '-')
                    : (member.department_name_zh || member.department_name || '-')}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleRemoveMember(member.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMembersDialogOpen(false)}>{t('adminGroups.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminGroups;
