import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import Layout from '../components/Layout';

const WARNING_KEYS = {
  missing_hire_date: 'missingHireDate',
  invalid_as_of: 'invalidAsOf',
  terminated_before_hire: 'terminatedBeforeHire',
  hired_after_as_of: 'hiredAfterAsOf',
  needs_backfill: 'needsBackfill',
  at_cap: 'atCap'
};

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

const AdminSicknessAllowance = () => {
  const { t } = useTranslation();
  const root = 'adminSicknessAllowance';
  const [asOf, setAsOf] = useState(localToday());
  const [mode, setMode] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [resultMsg, setResultMsg] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [manualUser, setManualUser] = useState(null);
  const [manualAmount, setManualAmount] = useState('');
  const [manualRemarks, setManualRemarks] = useState('');

  const loadPreview = useCallback(async (nextMode = mode, nextAsOf = asOf) => {
    setLoading(true);
    setError('');
    setResultMsg('');
    try {
      const response = await axios.get('/api/admin/sickness-allowance/preview', {
        params: { mode: nextMode, as_of: nextAsOf }
      });
      setMode(nextMode);
      setPreview(response.data);
      setRows(
        (response.data.items || []).map((item) => ({
          ...item,
          selected: !!item.selected_default
        }))
      );
    } catch (err) {
      console.error(err);
      setPreview(null);
      setRows([]);
      setError(err.response?.data?.message || t(`${root}.loadFailed`));
    } finally {
      setLoading(false);
    }
  }, [asOf, mode, t]);

  useEffect(() => {
    loadPreview('monthly', localToday());
    // 只在進入頁面時試算一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleRows = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => {
      const name = `${row.employee_number || ''} ${row.display_name || ''}`.toLowerCase();
      return name.includes(text);
    });
  }, [keyword, rows]);

  const selectedRows = rows.filter((row) => row.selected && row.selectable && row.grants_count > 0);
  const selectableVisible = visibleRows.filter((row) => row.selectable);
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((row) => row.selected);

  const toggleAll = (checked) => {
    const visibleIds = new Set(selectableVisible.map((row) => row.user_id));
    setRows((prev) =>
      prev.map((row) => (visibleIds.has(row.user_id) ? { ...row, selected: checked } : row))
    );
  };

  const toggleRow = (userId, checked) => {
    setRows((prev) =>
      prev.map((row) => (row.user_id === userId ? { ...row, selected: checked } : row))
    );
  };

  const handleConfirm = async () => {
    if (selectedRows.length === 0) return;
    setConfirming(true);
    setError('');
    try {
      const response = await axios.post('/api/admin/sickness-allowance/bulk', {
        mode: preview?.mode || mode,
        as_of: preview?.as_of || asOf,
        user_ids: selectedRows.map((row) => row.user_id)
      });
      setConfirmOpen(false);
      setResultMsg(response.data.message || t(`${root}.confirmSuccess`));
      await loadPreview(preview?.mode || mode, preview?.as_of || asOf);
    } catch (err) {
      setError(err.response?.data?.message || t(`${root}.confirmFailed`));
    } finally {
      setConfirming(false);
    }
  };

  const handleManual = async () => {
    if (!manualUser || manualAmount === '') return;
    setManualSaving(true);
    setError('');
    setResultMsg('');
    try {
      const response = await axios.post('/api/admin/sickness-allowance/manual', {
        user_id: manualUser.user_id,
        amount: parseFloat(manualAmount),
        remarks: manualRemarks
      });
      setResultMsg(response.data.message || t(`${root}.manualSuccess`));
      setManualAmount('');
      setManualRemarks('');
      await loadPreview(preview?.mode || mode, preview?.as_of || asOf);
    } catch (err) {
      setError(err.response?.data?.message || t(`${root}.manualFailed`));
    } finally {
      setManualSaving(false);
    }
  };

  const renderWarnings = (row) =>
    (row.warnings || []).map((warning) => (
      <Chip
        key={warning}
        size="small"
        color={warning === 'needs_backfill' || warning === 'at_cap' ? 'warning' : 'default'}
        label={
          warning === 'needs_backfill'
            ? t(`${root}.warnings.needsBackfill`, { count: row.ungranted_months, days: formatDays(row.catchup_days) })
            : t(`${root}.warnings.${WARNING_KEYS[warning] || warning}`)
        }
        sx={{ mr: 0.5, mb: 0.5 }}
      />
    ));

  const totalDays = selectedRows.reduce((sum, row) => sum + Number(row.days_to_grant || 0), 0);

  return (
    <Layout>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {t(`${root}.title`)}
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          {t(`${root}.hint`)}
        </Alert>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label={t(`${root}.asOf`)}
              type="date"
              value={asOf}
              onChange={(event) => setAsOf(event.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button variant="outlined" onClick={() => loadPreview('monthly', asOf)} disabled={loading}>
              {t(`${root}.previewMonthly`)}
            </Button>
            <Button variant="outlined" color="secondary" onClick={() => loadPreview('backfill', asOf)} disabled={loading}>
              {t(`${root}.previewBackfill`)}
            </Button>
            <Button
              variant="contained"
              disabled={loading || selectedRows.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              {t(`${root}.confirmGrant`, { count: selectedRows.length })}
            </Button>
            {preview?.leave_type && (
              <Typography variant="body2" color="text.secondary">
                {t(`${root}.leaveType`)}: {preview.leave_type.name_zh || preview.leave_type.name} ({preview.leave_type.code})
                {' · '}
                {preview.mode === 'backfill' ? t(`${root}.modeBackfill`) : t(`${root}.modeMonthly`)}
                {' · '}
                {preview.as_of}
              </Typography>
            )}
          </Box>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {resultMsg && <Alert severity="success" sx={{ mb: 2 }}>{resultMsg}</Alert>}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>{t(`${root}.manualTitle`)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(`${root}.manualHint`)}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Autocomplete
              sx={{ minWidth: 280 }}
              options={rows}
              value={manualUser}
              onChange={(_, value) => setManualUser(value)}
              getOptionLabel={(option) =>
                `${option.employee_number || ''} ${option.display_name || ''}`.trim()
              }
              isOptionEqualToValue={(option, value) => option.user_id === value.user_id}
              renderInput={(params) => <TextField {...params} label={t(`${root}.employee`)} size="small" />}
            />
            <TextField
              label={t(`${root}.days`)}
              type="number"
              size="small"
              value={manualAmount}
              onChange={(event) => setManualAmount(event.target.value)}
              inputProps={{ step: 0.5 }}
              sx={{ width: 120 }}
            />
            <TextField
              label={t(`${root}.remarks`)}
              size="small"
              value={manualRemarks}
              onChange={(event) => setManualRemarks(event.target.value)}
              sx={{ minWidth: 220 }}
            />
            <Button
              variant="contained"
              color="secondary"
              disabled={manualSaving || !manualUser || manualAmount === ''}
              onClick={handleManual}
            >
              {t(`${root}.manualGrant`)}
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <TextField
            label={t(`${root}.search`)}
            size="small"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            sx={{ mb: 2, minWidth: 240 }}
          />
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allVisibleSelected}
                        indeterminate={
                          selectableVisible.some((row) => row.selected) && !allVisibleSelected
                        }
                        onChange={(event) => toggleAll(event.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{t(`${root}.employee`)}</TableCell>
                    <TableCell>{t(`${root}.hireDate`)}</TableCell>
                    <TableCell align="right">{t(`${root}.completedMonths`)}</TableCell>
                    <TableCell align="right">{t(`${root}.currentBalance`)}</TableCell>
                    <TableCell align="right">{t(`${root}.daysToGrant`)}</TableCell>
                    <TableCell align="right">{t(`${root}.projectedBalance`)}</TableCell>
                    <TableCell>{t(`${root}.warningsLabel`)}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">{t(`${root}.noRows`)}</TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((row) => (
                      <TableRow key={row.user_id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!row.selected}
                            disabled={!row.selectable}
                            onChange={(event) => toggleRow(row.user_id, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {row.employee_number} {row.display_name}
                        </TableCell>
                        <TableCell>{row.hire_date || '-'}</TableCell>
                        <TableCell align="right">{row.completed_months}</TableCell>
                        <TableCell align="right">{formatDays(row.current_balance)}</TableCell>
                        <TableCell align="right">
                          {formatDays(row.days_to_grant)}
                          {row.latest_rate ? ` (${row.latest_rate})` : ''}
                        </TableCell>
                        <TableCell align="right">{formatDays(row.projected_balance)}</TableCell>
                        <TableCell>{renderWarnings(row)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        <Dialog open={confirmOpen} onClose={() => !confirming && setConfirmOpen(false)}>
          <DialogTitle>{t(`${root}.confirmTitle`)}</DialogTitle>
          <DialogContent>
            <Typography>
              {preview?.mode === 'backfill'
                ? t(`${root}.confirmBackfill`, { count: selectedRows.length, days: formatDays(totalDays), asOf: preview?.as_of || asOf })
                : t(`${root}.confirmMonthly`, { count: selectedRows.length, days: formatDays(totalDays), asOf: preview?.as_of || asOf })}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)} disabled={confirming}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={handleConfirm} disabled={confirming}>
              {t(`${root}.confirmAction`)}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
};

export default AdminSicknessAllowance;
