import React, { useState, useEffect } from 'react';
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
  ListItemSecondaryAction
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Group as GroupIcon 
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const AdminGroups = () => {
  const { t } = useTranslation();
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
  const [formData, setFormData] = useState({
    name: '',
    name_zh: '',
    description: '',
    checker_id: '',
    approver_1_id: '',
    approver_2_id: '',
    approver_3_id: ''
  });

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    try {
      const [deptResponse, delegResponse] = await Promise.all([
        axios.get('/api/groups/department'),
        axios.get('/api/groups/delegation')
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
        approver_3_id: ''
      });
    } else {
      setFormData({ 
        name: '', 
        name_zh: '', 
        description: ''
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
        approver_3_id: group.approver_3_id || ''
      });
    } else {
      setFormData({
        name: group.name,
        name_zh: group.name_zh,
        description: group.description || ''
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

  const handleDeleteGroup = async (groupId, type) => {
    const confirmed = window.confirm(t('adminGroups.confirmDelete'));
    if (!confirmed) {
      return;
    }

    try {
      const endpoint = type === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      await axios.delete(`${endpoint}/${groupId}`);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.message || t('adminGroups.deleteFailed'));
    }
  };

  const handleOpenMembers = async (group, type) => {
    setSelectedGroup(group);
    setSelectedGroupType(type);
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

  const handleAddMember = async (userId) => {
    try {
      const endpoint = selectedGroupType === 'department' ? '/api/groups/department' : '/api/groups/delegation';
      await axios.post(`${endpoint}/${selectedGroup.id}/members`, { user_id: userId });
      handleOpenMembers(selectedGroup, selectedGroupType);
      fetchGroups();
    } catch (error) {
      alert(error.response?.data?.message || t('adminGroups.addMemberFailed'));
    }
  };

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
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen('department')}
            sx={{ mb: 2 }}
          >
            {t('adminGroups.addDepartmentGroup')}
          </Button>
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
                      <TableCell>{group.name}</TableCell>
                      <TableCell>{group.name_zh}</TableCell>
                      <TableCell>{group.checker_name_zh || '-'}</TableCell>
                      <TableCell>{group.approver_1_name_zh || '-'}</TableCell>
                      <TableCell>{group.approver_2_name_zh || '-'}</TableCell>
                      <TableCell>{group.approver_3_name_zh || '-'}</TableCell>
                      <TableCell>{group.user_ids?.length || 0}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEdit(group, 'department')}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenMembers(group, 'department')}>
                          <GroupIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteGroup(group.id, 'department')}>
                          <DeleteIcon />
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
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => handleOpen('delegation')}
            sx={{ mb: 2 }}
          >
            {t('adminGroups.addDelegationGroup')}
          </Button>
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
                      <TableCell>{group.name}</TableCell>
                      <TableCell>{group.name_zh}</TableCell>
                      <TableCell>{group.description || '-'}</TableCell>
                      <TableCell>{group.user_ids?.length || 0}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEdit(group, 'delegation')}>
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleOpenMembers(group, 'delegation')}>
                          <GroupIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteGroup(group.id, 'delegation')}>
                          <DeleteIcon />
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
                    {delegationGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name_zh}
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
                    {delegationGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name_zh}
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
                    {delegationGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name_zh}
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
                    {delegationGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name_zh}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('adminGroups.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">{t('adminGroups.save')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={membersDialogOpen} onClose={() => setMembersDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('adminGroups.membersDialogTitle', { name: selectedGroup?.name_zh })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('adminGroups.addMember')}</Typography>
            <FormControl fullWidth>
              <InputLabel>{t('adminGroups.selectUser')}</InputLabel>
              <Select
                label={t('adminGroups.selectUser')}
                onChange={(e) => handleAddMember(e.target.value)}
                value=""
              >
                {users.filter(u => !groupMembers.find(m => m.id === u.id)).map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.employee_number} ({user.display_name})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('adminGroups.currentMembers')}</Typography>
          <List>
            {groupMembers.map((member) => (
              <ListItem key={member.id}>
                <ListItemText
                  primary={`${member.employee_number} (${member.display_name})`}
                  secondary={member.department_name_zh}
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
