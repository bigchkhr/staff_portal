import React, { useState, useEffect, useCallback } from 'react';
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
  Checkbox,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';
import YearSelector from '../components/YearSelector';

const WARNING_KEYS = {
  missing_hire_date: 'missingHireDate',
  missing_al_base: 'missingAlBase',
  missing_al_cap: 'missingAlCap',
  cap_below_base: 'capBelowBase',
  hired_after_year: 'hiredAfterYear',
  terminated_before_year: 'terminatedBeforeYear',
  no_service_in_year: 'noServiceInYear',
  adjusted_for_termination: 'adjustedForTermination',
  pro_rata_new_joiner: 'proRataNewJoiner',
  zero_after_rounding: 'zeroAfterRounding',
  has_existing_balance: 'hasExistingBalance',
  not_yet_entitled_3m: 'notYetEntitled3m',
  entitled_after_3m: 'entitledAfter3m'
};

const AdminAnnualLeaveBulk = () => {
  const { t, i18n } = useTranslation();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError('');
    setResultMsg('');
    try {
      const response = await axios.get('/api/admin/annual-leave/preview', {
        params: { year }
      });
      const data = response.data;
      setPreview(data);
      setRows(
        (data.items || []).map((item) => ({
          ...item,
          selected: !!item.selected_default,
          amount: item.calculated_days
        }))
      );
    } catch (err) {
      console.error(err);
      setPreview(null);
      setRows([]);
      setError(err.response?.data?.message || t('adminAnnualLeave.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [year, t]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const selectedRows = rows.filter((r) => r.selected && parseFloat(r.amount) > 0);
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  const toggleAll = (checked) => {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  };

  const toggleRow = (userId, checked) => {
    setRows((prev) =>
      prev.map((r) => (r.user_id === userId ? { ...r, selected: checked } : r))
    );
  };

  const updateAmount = (userId, value) => {
    setRows((prev) =>
      prev.map((r) => (r.user_id === userId ? { ...r, amount: value } : r))
    );
  };

  const handleConfirm = async () => {
    if (!preview?.leave_type || selectedRows.length === 0) return;
    setConfirming(true);
    setError('');
    try {
      const response = await axios.post('/api/admin/annual-leave/bulk', {
        year,
        leave_type_id: preview.leave_type.id,
        start_date: preview.start_date,
        end_date: preview.end_date,
        items: selectedRows.map((r) => ({
          user_id: r.user_id,
          amount: parseFloat(r.amount)
        }))
      });
      setConfirmOpen(false);
      setResultMsg(response.data.message || t('adminAnnualLeave.confirmSuccess'));
      await loadPreview();
    } catch (err) {
      setError(err.response?.data?.message || t('adminAnnualLeave.confirmFailed'));
    } finally {
      setConfirming(false);
    }
  };

  const renderWarnings = (warnings = []) =>
    warnings.map((w) => (
      <Chip
        key={w}
        size="small"
        label={t(`adminAnnualLeave.warnings.${WARNING_KEYS[w] || w}`)}
        color={w === 'has_existing_balance' ? 'warning' : 'default'}
        sx={{ mr: 0.5, mb: 0.5 }}
      />
    ));

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('adminAnnualLeave.title')}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('adminAnnualLeave.previewOnlyHint')}
        </Alert>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <YearSelector value={year} onChange={setYear} />
            <Button variant="outlined" onClick={loadPreview} disabled={loading}>
              {t('adminAnnualLeave.reloadPreview')}
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={loading || selectedRows.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {t('adminAnnualLeave.confirmGrant', { count: selectedRows.length })}
            </Button>
            {preview?.leave_type && (
              <Typography variant="body2" color="text.secondary">
                {t('adminAnnualLeave.leaveType')}:{' '}
                {preview.leave_type.name_zh || preview.leave_type.name} (
                {preview.leave_type.code})
              </Typography>
            )}
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {resultMsg && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {resultMsg}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={
                        selectedRows.length > 0 && !allSelected
                      }
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>{t('adminUsers.employeeNumber')}</TableCell>
                  <TableCell>{t('adminUsers.name')}</TableCell>
                  <TableCell>{t('adminUsers.hireDate')}</TableCell>
                  <TableCell>{t('adminUsers.terminationDate')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.completedYears')}</TableCell>
                  <TableCell align="right">{t('adminUsers.alBaseDays')}</TableCell>
                  <TableCell align="right">{t('adminUsers.alCapDays')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.fullEntitlement')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.daysWorked')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.rawDays')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.calculatedDays')}</TableCell>
                  <TableCell align="right">{t('adminAnnualLeave.existingBalance')}</TableCell>
                  <TableCell>{t('adminAnnualLeave.warningsLabel')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} align="center">
                      {t('adminAnnualLeave.noRows')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow
                      key={row.user_id}
                      hover
                      selected={row.selected}
                      sx={{
                        opacity: row.selectable ? 1 : 0.7,
                        backgroundColor: row.warnings?.includes('has_existing_balance')
                          ? 'action.hover'
                          : undefined
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!!row.selected}
                          onChange={(e) => toggleRow(row.user_id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{row.employee_number}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.display_name}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {i18n.language === 'en'
                            ? (row.position_name || row.position_name_zh || '-')
                            : (row.position_name_zh || row.position_name || '-')}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.hire_date || '-'}</TableCell>
                      <TableCell>{row.termination_date || '-'}</TableCell>
                      <TableCell align="right">
                        {row.completed_years != null ? row.completed_years : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {row.al_base_days != null ? row.al_base_days : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {row.al_cap_days != null ? row.al_cap_days : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {row.full_entitlement != null ? row.full_entitlement : '-'}
                      </TableCell>
                      <TableCell align="right">
                        {row.days_worked || 0}/{row.days_in_year || '-'}
                      </TableCell>
                      <TableCell align="right">{row.raw_days ?? '-'}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 100 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateAmount(row.user_id, e.target.value)}
                          inputProps={{ min: 0, step: 0.5 }}
                          disabled={!row.selected}
                          sx={{ width: 88 }}
                        />
                      </TableCell>
                      <TableCell align="right">{row.existing_balance ?? 0}</TableCell>
                      <TableCell>{renderWarnings(row.warnings)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={confirmOpen} onClose={() => !confirming && setConfirmOpen(false)}>
        <DialogTitle>{t('adminAnnualLeave.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {t('adminAnnualLeave.confirmBody', {
              year,
              count: selectedRows.length
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('adminAnnualLeave.confirmValidPeriod', {
              start: preview?.start_date,
              end: preview?.end_date
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={confirming}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} variant="contained" disabled={confirming}>
            {confirming ? <CircularProgress size={22} /> : t('adminAnnualLeave.confirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default AdminAnnualLeaveBulk;
