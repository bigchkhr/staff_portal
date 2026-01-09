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
import { useTranslation } from 'react-i18next';

const UserFormDialog = ({ open, editing, onClose, onSuccess, initialData = null, isHRMember = false, onToggleForcePasswordChange = null }) => {
  const { t, i18n } = useTranslation();
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
    deactivated: false,
    force_password_change: false
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
          deactivated: !!initialData.deactivated,
          force_password_change: !!initialData.force_password_change
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
          deactivated: false,
          force_password_change: false
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
        alert(t('adminUsers.enterPassword'));
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
      alert(error.response?.data?.message || t('adminUsers.operationFailed'));
    }
  };

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{editing ? t('adminUsers.editUser') : t('adminUsers.addUser')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label={t('adminUsers.employeeNumber')}
            value={formData.employee_number}
            onChange={handleChange('employee_number')}
            required
            disabled={!!editing}
          />
          <TextField
            label={t('adminUsers.surname')}
            value={formData.surname}
            onChange={handleChange('surname')}
            required
          />
          <TextField
            label={t('adminUsers.givenName')}
            value={formData.given_name}
            onChange={handleChange('given_name')}
            required
          />
          <TextField
            label={t('adminUsers.alias')}
            value={formData.alias}
            onChange={handleChange('alias')}
          />
          <TextField
            label={t('adminUsers.chineseName')}
            value={formData.name_zh}
            onChange={handleChange('name_zh')}
            required
          />
          <TextField
            label={t('adminUsers.displayName')}
            value={formData.display_name}
            onChange={handleChange('display_name')}
          />
          <TextField
            label={t('adminUsers.email')}
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
          />
          <TextField
            label={editing ? t('adminUsers.newPassword') : t('adminUsers.password')}
            type="password"
            value={formData.password}
            onChange={handleChange('password')}
            required={!editing}
          />
          <FormControl>
            <InputLabel>{t('adminUsers.department')}</InputLabel>
            <Select
              value={formData.department_id}
              label={t('adminUsers.department')}
              onChange={handleChange('department_id')}
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>
                  {i18n.language === 'en' 
                    ? (dept.name || dept.name_zh || '-')
                    : (dept.name_zh || dept.name || '-')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('adminUsers.position')}</InputLabel>
            <Select
              value={formData.position_id}
              label={t('adminUsers.position')}
              onChange={handleChange('position_id')}
            >
              {positions.map((pos) => (
                <MenuItem key={pos.id} value={pos.id}>
                  {i18n.language === 'en' 
                    ? (pos.name || pos.name_zh || '-')
                    : (pos.name_zh || pos.name || '-')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label={t('adminUsers.hireDate')}
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
            label={formData.deactivated ? t('adminUsers.accountDeactivated') : t('adminUsers.accountActive')}
          />
          {isHRMember && (
            <FormControlLabel
              control={(
                <Switch
                  checked={formData.force_password_change}
                  onChange={handleChange('force_password_change')}
                  color="warning"
                />
              )}
              label={t('adminUsers.forcePasswordChange')}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained">{t('common.save')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserFormDialog;

