import React, { useState } from 'react';
import {
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';

function formatTimeShort(t) {
  if (t == null || t === '') return '--';
  const s = String(t);
  return s.length >= 5 ? s.substring(0, 5) : s;
}

/**
 * @param {{ applications?: object[], size?: 'small'|'medium', sx?: object }} props
 */
const OutdoorWorkCalendarChip = ({ applications, size = 'small', sx = {} }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!applications || applications.length === 0) return null;

  const flowLabel = (ft) => {
    if (ft === 'paper-flow') return t('outdoorWorkHistory.paperFlow');
    if (ft === 'e-flow') return t('outdoorWorkHistory.eFlow');
    return ft || '—';
  };

  return (
    <>
      <Chip
        label={t('outdoorWorkCalendar.cellLabel')}
        size={size}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        sx={{ cursor: 'pointer', fontWeight: 600, ...sx }}
        color="secondary"
        variant="outlined"
      />
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('outdoorWorkCalendar.detailTitle')}</DialogTitle>
        <DialogContent>
          {applications.map((app, idx) => (
            <Box key={app.id || idx} sx={{ mb: idx < applications.length - 1 ? 2 : 0 }}>
              {applications.length > 1 && (
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {t('outdoorWorkCalendar.recordOf', { current: idx + 1, total: applications.length })}
                </Typography>
              )}
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('outdoorWorkHistory.transactionId')}:</strong>{' '}
                {app.transaction_id != null ? String(app.transaction_id) : app.id}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('outdoorWorkApplication.startDate')} / {t('outdoorWorkApplication.startTime')}:</strong>{' '}
                {app.start_date} {formatTimeShort(app.start_time)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('outdoorWorkApplication.endDate')} / {t('outdoorWorkApplication.endTime')}:</strong>{' '}
                {app.end_date} {formatTimeShort(app.end_time)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('outdoorWorkApplication.totalHours')}:</strong>{' '}
                {app.total_hours != null ? app.total_hours : '—'}
              </Typography>
              {app.start_location ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('outdoorWorkApplication.startLocation')}:</strong> {app.start_location}
                </Typography>
              ) : null}
              {app.end_location ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('outdoorWorkApplication.endLocation')}:</strong> {app.end_location}
                </Typography>
              ) : null}
              {app.transportation ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('outdoorWorkApplication.transportation')}:</strong> {app.transportation}
                </Typography>
              ) : null}
              {app.expense != null && app.expense !== '' ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('outdoorWorkApplication.expense')}:</strong> {app.expense}
                </Typography>
              ) : null}
              {app.purpose ? (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('outdoorWorkApplication.purpose')}:</strong> {app.purpose}
                </Typography>
              ) : null}
              <Typography variant="body2" sx={{ mb: 0 }}>
                <strong>{t('outdoorWorkHistory.flowType')}:</strong> {flowLabel(app.flow_type)}
              </Typography>
              {idx < applications.length - 1 ? <Divider sx={{ mt: 2 }} /> : null}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OutdoorWorkCalendarChip;
