import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box
} from '@mui/material';
import axios from 'axios';

const UserFormDialog = ({ open, editing, onClose, onSuccess, initialData = null }) => {
  const [formData, setFormData] = useState({
    employee_number: '',
    surname: '',
    given_name: '',
    alias: '',
    name_zh: '',
    display_name: '',
    email: '',
    password: '',
    department_id: '',
    position_id: '',
    hire_date: '',
    deactivated: false
  });
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    if (open) {
      fetchDepartments();
      fetchPositions();
      
      if (editing && initialData) {
        setFormData({
          employee_number: initialData.employee_number || '',
          surname: initialData.surname || '',
          given_name: initialData.given_name || '',
          alias: initialData.alias || '',
          name_zh: initialData.name_zh || '',
          display_name: initialData.display_name || '',
          email: initialData.email || '',
          password: '',
          department_id: initialData.department_id || '',
          position_id: initialData.position_id || '',
          hire_date: initialData.hire_date ? initialData.hire_date.split('T')[0] : '',
          deactivated: !!initialData.deactivated
        });
      } else {
        setFormData({
          employee_number: '',
          surname: '',
          given_name: '',
          alias: '',
          name_zh: '',
          display_name: '',
          email: '',
          password: '',
          department_id: '',
          position_id: '',
          hire_date: '',
          deactivated: false
        });
      }
    }
  }, [open, editing, initialData]);

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/departments');
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Fetch departments error:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const response = await axios.get('/api/positions');
      setPositions(response.data.positions || []);
    } catch (error) {
      console.error('Fetch positions error:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const submitData = { ...formData };
      
      if (!editing && !submitData.password) {
        alert('請輸入密碼');
        return;
      }
      if (!submitData.password) {
        delete submitData.password;
      }

      if (editing) {
        await axios.put(`/api/admin/users/${editing}`, submitData);
      } else {
        await axios.post('/api/admin/users', submitData);
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      alert(error.response?.data?.message || '操作失敗');
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editing ? '編輯用戶' : '新增用戶'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="員工編號"
            value={formData.employee_number}
            onChange={handleChange('employee_number')}
            required
            disabled={!!editing}
          />
          <TextField
            label="姓氏"
            value={formData.surname}
            onChange={handleChange('surname')}
            required
          />
          <TextField
            label="名字"
            value={formData.given_name}
            onChange={handleChange('given_name')}
            required
          />
          <TextField
            label="別名"
            value={formData.alias}
            onChange={handleChange('alias')}
          />
          <TextField
            label="中文姓名"
            value={formData.name_zh}
            onChange={handleChange('name_zh')}
            required
          />
          <TextField
            label="Display Name"
            value={formData.display_name}
            onChange={handleChange('display_name')}
          />
          <TextField
            label="電子郵件"
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
          />
          <TextField
            label={editing ? '新密碼（留空則不更改）' : '密碼'}
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            required={!editing}
          />
          <FormControl>
            <InputLabel>部門</InputLabel>
            <Select
              value={formData.department_id}
              label="部門"
              onChange={handleChange('department_id')}
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {dept.name_zh}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>職位</InputLabel>
            <Select
              value={formData.position_id}
              label="職位"
              onChange={handleChange('position_id')}
            >
              {positions.map((pos) => (
                <MenuItem key={pos.id} value={pos.id}>
                  {pos.name_zh}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="入職日期"
            type="date"
            value={formData.hire_date}
            onChange={handleChange('hire_date')}
            InputLabelProps={{
              shrink: true
            }}
          />
          <FormControlLabel
            control={(
              <Switch
                checked={formData.deactivated}
                onChange={handleChange('deactivated')}
                color="error"
              />
            )}
            label={formData.deactivated ? '帳戶已停用（無法登入）' : '帳戶啟用中'}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained">儲存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormDialog;

