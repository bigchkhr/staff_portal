import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Button,
  TextField,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Visibility as VisibilityIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { useAuth } from '../contexts/AuthContext';

const OutdoorWorkBulkApproval = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicantId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [canSelectMap, setCanSelectMap] = useState({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsApplication, setDetailsApplication] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const renderDateTime = (dateValue, timeValue) => {
    if (!dateValue) return '-';
    return (
      <>
        {formatDate(dateValue)}{' '}
        {timeValue ? (
          <Box component="span" sx={{ fontWeight: 'bold' }}>
            {timeValue}
          </Box>
        ) : (
          '-'
        )}
      </>
    );
  };

  const fetchList = async () => {
    try {
      setLoading(true);
      setPermissionsLoaded(false);
      setCanSelectMap({});
      setSelectedIds([]);
      const res = await axios.get(`/api/approvals/pending/outdoor-work/applicant/${applicantId}`);
      const apps = res.data.applications || [];
      setApplications(apps);
      // 待後續拉取 can-approve 權限後再決定可選取項目
      setSelectedIds([]);
    } catch (e) {
      console.error('Fetch outdoor work bulk approvals error:', e);
      setApplications([]);
      setSelectedIds([]);
      setCanSelectMap({});
      setPermissionsLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicantId]);

  useEffect(() => {
    let cancelled = false;

    const fetchPermissions = async () => {
      if (!applications.length) {
        setCanSelectMap({});
        setSelectedIds([]);
        setPermissionsLoaded(true);
        return;
      }

      setPermissionsLoading(true);
      setPermissionsLoaded(false);

      try {
        const results = await Promise.all(
          applications.map(async (app) => {
            try {
              const res = await axios.get(`/api/users/can-approve/${app.id}`, {
                params: { application_type: 'outdoor_work' }
              });
              return { id: app.id, canApprove: !!res.data?.canApprove };
            } catch (e) {
              console.error('Check can-approve error:', e);
              return { id: app.id, canApprove: false };
            }
          })
        );

        if (cancelled) return;

        const nextMap = {};
        for (const r of results) nextMap[r.id] = r.canApprove;

        setCanSelectMap(nextMap);

        const selectableIds = applications.filter(a => nextMap[a.id]).map(a => a.id);
        setSelectedIds(selectableIds);
      } finally {
        if (!cancelled) {
          setPermissionsLoading(false);
          setPermissionsLoaded(true);
        }
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [applications]);

  const applicantDisplay = useMemo(() => {
    const first = applications[0];
    if (!first) return '';
    const empNo = first.applicant_employee_number || first.user_employee_number;
    return `${first.applicant_display_name || ''}${empNo ? ` (${empNo})` : ''}`;
  }, [applications]);

  const selectableIds = useMemo(() => applications.filter(a => !!canSelectMap[a.id]).map(a => a.id), [applications, canSelectMap]);
  const allSelected = selectableIds.length > 0 && selectedIds.length === selectableIds.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < selectableIds.length;

  const toggleAll = (checked) => {
    if (checked) setSelectedIds(selectableIds);
    else setSelectedIds([]);
  };

  const toggleOne = (id, checked) => {
    if (!canSelectMap[id]) return;
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };

  const submit = async (action) => {
    if (!selectedIds.length) {
      await Swal.fire({
        icon: 'warning',
        title: t('common.warning'),
        text: t('outdoorWorkBulkApproval.noSelectionText'),
        confirmButtonText: t('common.confirm')
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: action === 'approve'
        ? t('outdoorWorkBulkApproval.confirmTitleApprove')
        : t('outdoorWorkBulkApproval.confirmTitleReject'),
      text: action === 'approve'
        ? t('outdoorWorkBulkApproval.confirmTextApprove', { count: selectedIds.length })
        : t('outdoorWorkBulkApproval.confirmTextReject', { count: selectedIds.length }),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: action === 'approve' ? '#2e7d32' : '#d32f2f'
    });

    if (!confirm.isConfirmed) return;

    try {
      setSubmitting(true);
      const res = await axios.post('/api/approvals/outdoor-work/bulk-approve', {
        applicant_id: applicantId,
        ids: selectedIds,
        action,
        remarks: comment
      });

      await Swal.fire({
        icon: 'success',
        title: t('outdoorWorkBulkApproval.successTitle'),
        text: res.data.message || t('outdoorWorkBulkApproval.successTextFallback'),
        confirmButtonText: t('common.confirm')
      });

      navigate('/approval/list');
    } catch (e) {
      console.error('Bulk submit error:', e);
      const msg = e.response?.data?.message || t('outdoorWorkBulkApproval.bulkOperationErrorFallback');
      const forbiddenIds = Array.isArray(e.response?.data?.ids) ? e.response.data.ids : [];
      const detail = forbiddenIds.length
        ? t('outdoorWorkBulkApproval.forbiddenDetail', { ids: forbiddenIds.join(', ') })
        : '';
      await Swal.fire({
        icon: 'error',
        title: t('outdoorWorkBulkApproval.errorTitle'),
        text: `${msg}${detail}`,
        confirmButtonText: t('common.confirm')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStageLabel = (stage) => {
    const stageMap = {
      checker: t('approvalDetail.stageChecker'),
      approver_1: t('approvalDetail.stageApprover1'),
      approver_2: t('approvalDetail.stageApprover2'),
      approver_3: t('approvalDetail.stageApprover3'),
      completed: t('approvalDetail.stageCompleted')
    };
    return stageMap[stage] || stage || '-';
  };

  const handleOpenDetails = async (applicationId) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsApplication(null);

    try {
      const res = await axios.get(`/api/outdoor-work/${applicationId}`);
      setDetailsApplication(res.data.application || null);
    } catch (e) {
      console.error('Fetch outdoor work details error:', e);
      const status = e?.response?.status;
      const message =
        status === 403 ? t('approvalDetail.noPermission') : status === 404 ? t('approvalDetail.applicationNotFound') : t('approvalDetail.fetchError');

      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.title'),
        text: message,
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });

      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setDetailsLoading(false);
    setDetailsApplication(null);
    setRejectReason('');
    setRejectSubmitting(false);
  };

  const handleRejectSingle = async () => {
    if (!detailsApplication) return;

    setRejectSubmitting(true);
    try {
      const res = await axios.post(`/api/outdoor-work/${detailsApplication.id}/approve`, {
        action: 'reject',
        remarks: rejectReason || '已拒絕'
      });

      await Swal.fire({
        icon: 'success',
        title: t('approvalDetail.rejectionSuccess'),
        text: res.data?.message || '',
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#3085d6'
      });

      handleCloseDetails();
      // 重新拉返待批核列表，確保被拒絕嘅項目唔會再出現
      await fetchList();
    } catch (e) {
      console.error('Reject single error:', e);
      const status = e?.response?.status;
      const msg = status === 403 ? t('approvalDetail.noPermission') : status === 404 ? t('approvalDetail.applicationNotFound') : t('approvalDetail.operationFailed');

      await Swal.fire({
        icon: 'error',
        title: t('approvalDetail.operationFailed'),
        text: e?.response?.data?.message || msg,
        confirmButtonText: t('common.confirm'),
        confirmButtonColor: '#d33'
      });
    } finally {
      setRejectSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: { xs: 1, sm: 2 } }}>
      <Typography variant="h5" gutterBottom>
        {t('outdoorWorkBulkApproval.title')}
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontWeight: 700 }}
        >
          {t('approvalDetail.applicantLabel')}{applicantDisplay || '-'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {applications.length === 0 ? (
          <Alert severity="info">{t('outdoorWorkBulkApproval.noApplications')}</Alert>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{t('outdoorWorkBulkApproval.startDateTime')}</TableCell>
                    <TableCell>{t('outdoorWorkBulkApproval.endDateTime')}</TableCell>
                    <TableCell>{t('approvalList.totalHours')}</TableCell>
                    <TableCell>{t('approvalList.startLocation')}</TableCell>
                    <TableCell>{t('approvalList.endLocation')}</TableCell>
                    <TableCell>{t('outdoorWorkBulkApproval.purpose')}</TableCell>
                    <TableCell sx={{ width: 72, textAlign: 'center' }}>{t('outdoorWorkBulkApproval.action')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {applications.map(app => (
                    <TableRow
                      key={app.id}
                      hover
                      sx={{
                        opacity: permissionsLoaded ? (canSelectMap[app.id] ? 1 : 0.45) : 1
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(app.id)}
                          disabled={!canSelectMap[app.id] || !permissionsLoaded || permissionsLoading}
                          onChange={(e) => toggleOne(app.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{renderDateTime(app.start_date, app.start_time)}</TableCell>
                      <TableCell>{renderDateTime(app.end_date, app.end_time)}</TableCell>
                      <TableCell>{app.total_hours || 0}</TableCell>
                      <TableCell>{app.start_location || '-'}</TableCell>
                      <TableCell>{app.end_location || '-'}</TableCell>
                      <TableCell>{app.purpose ? app.purpose : '-'}</TableCell>
                      <TableCell sx={{ width: 72, textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          aria-label={t('outdoorWorkBulkApproval.viewApplicationDetails')}
                          onClick={() => handleOpenDetails(app.id)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('outdoorWorkBulkApproval.remarksOptional')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="success"
                disabled={submitting || selectedIds.length === 0}
                onClick={() => submit('approve')}
              >
                {t('outdoorWorkBulkApproval.approveSelected')}
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={submitting || selectedIds.length === 0}
                onClick={() => submit('reject')}
              >
                {t('outdoorWorkBulkApproval.rejectSelected')}
              </Button>
              <Button
                variant="outlined"
                disabled={submitting}
                onClick={() => navigate('/approval/list')}
              >
                {t('outdoorWorkBulkApproval.backButton')}
              </Button>
            </Box>
          </>
        )}
      </Paper>

      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('outdoorWorkBulkApproval.viewApplicationDetails')}</DialogTitle>
        <DialogContent dividers>
          {detailsLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="320px">
              <CircularProgress />
            </Box>
          ) : !detailsApplication ? (
            <Box minHeight="320px" />
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.transactionId')}
                      secondary={detailsApplication.transaction_id || '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.applicant')}
                      secondary={
                        detailsApplication.applicant_display_name
                          ? `${detailsApplication.applicant_display_name}${
                              detailsApplication.applicant_employee_number
                                ? ` (${detailsApplication.applicant_employee_number})`
                                : ''
                            }`
                          : '-'
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalDetail.status')}
                      secondary={
                        <Chip
                          label={
                            detailsApplication.status === 'pending'
                              ? t('approvalDetail.pending')
                              : detailsApplication.status === 'approved'
                                ? t('approvalDetail.approved')
                                : t('approvalDetail.rejected')
                          }
                          color={
                            detailsApplication.status === 'pending'
                              ? 'warning'
                              : detailsApplication.status === 'approved'
                                ? 'success'
                                : 'error'
                          }
                          size="small"
                        />
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.currentStage')}
                      secondary={
                        <Chip
                          label={getStageLabel(detailsApplication.current_approval_stage)}
                          size="small"
                        />
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.dateTime')}
                      secondary={
                        <Box component="span">
                          {renderDateTime(detailsApplication.start_date, detailsApplication.start_time)} -{' '}
                          {renderDateTime(detailsApplication.end_date, detailsApplication.end_time)}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.totalHours')}
                      secondary={detailsApplication.total_hours ?? '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.startLocation')}
                      secondary={detailsApplication.start_location || '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.endLocation')}
                      secondary={detailsApplication.end_location || '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12} md={6}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.transportation')}
                      secondary={detailsApplication.transportation || '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalList.expense')}
                      secondary={detailsApplication.expense !== null && detailsApplication.expense !== undefined ? detailsApplication.expense : '-'}
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1' }}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary={t('outdoorWorkBulkApproval.purpose')}
                      secondary={
                        <Box sx={{ whiteSpace: 'pre-wrap' }}>
                          {detailsApplication.purpose || '-'}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>
                </List>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {t('approvalDetail.approvalProcess')}
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary={t('approvalDetail.checkerStage')}
                      secondary={
                        <Box component="div">
                          <Box component="div">
                            {detailsApplication.checker_at
                              ? `${t('approvalDetail.checkedAt')} ${formatDateTime(detailsApplication.checker_at)}${
                                  detailsApplication.checker_name
                                    ? ` - ${detailsApplication.checker_name}`
                                    : ''
                                }`
                              : t('approvalDetail.pendingCheck')}
                          </Box>
                          {detailsApplication.checker_remarks && (
                            <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1, fontWeight: 'bold' }}>
                              {detailsApplication.checker_remarks}
                            </Typography>
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary={t('approvalDetail.approver1Stage')}
                      secondary={
                        <Box component="div">
                          <Box component="div">
                            {detailsApplication.approver_1_at
                              ? `${t('approvalDetail.approvedAt')} ${formatDateTime(detailsApplication.approver_1_at)}${
                                  detailsApplication.approver_1_name
                                    ? ` - ${detailsApplication.approver_1_name}`
                                    : ''
                                }`
                              : detailsApplication.checker_at
                                ? t('approvalDetail.pendingApproval')
                                : t('approvalDetail.notStarted')}
                          </Box>
                          {detailsApplication.approver_1_remarks && (
                            <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1, fontWeight: 'bold' }}>
                              {detailsApplication.approver_1_remarks}
                            </Typography>
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary={t('approvalDetail.approver2Stage')}
                      secondary={
                        <Box component="div">
                          <Box component="div">
                            {detailsApplication.approver_2_at
                              ? `${t('approvalDetail.approvedAt')} ${formatDateTime(detailsApplication.approver_2_at)}${
                                  detailsApplication.approver_2_name
                                    ? ` - ${detailsApplication.approver_2_name}`
                                    : ''
                                }`
                              : detailsApplication.approver_1_at
                                ? t('approvalDetail.pendingApproval')
                                : t('approvalDetail.notStarted')}
                          </Box>
                          {detailsApplication.approver_2_remarks && (
                            <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1, fontWeight: 'bold' }}>
                              {detailsApplication.approver_2_remarks}
                            </Typography>
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary={t('approvalDetail.approver3Stage')}
                      secondary={
                        <Box component="div">
                          <Box component="div">
                            {detailsApplication.approver_3_at
                              ? `${t('approvalDetail.approvedAt')} ${formatDateTime(detailsApplication.approver_3_at)}${
                                  detailsApplication.approver_3_name
                                    ? ` - ${detailsApplication.approver_3_name}`
                                    : ''
                                }`
                              : detailsApplication.approver_2_at
                                ? t('approvalDetail.pendingApproval')
                                : t('approvalDetail.notStarted')}
                          </Box>
                          {detailsApplication.approver_3_remarks && (
                            <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1, fontWeight: 'bold' }}>
                              {detailsApplication.approver_3_remarks}
                            </Typography>
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'caption' }}
                      secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                    />
                  </ListItem>

                  {detailsApplication.status === 'rejected' && detailsApplication.rejected_by_name && (
                    <ListItem>
                      <ListItemText
                        primary={t('approvalDetail.rejection')}
                        secondary={
                          <Box component="div">
                            <Box component="div">
                              {t('approvalDetail.rejectedAt')} {formatDateTime(detailsApplication.rejected_at)} - {detailsApplication.rejected_by_name}
                            </Box>
                            {detailsApplication.rejection_reason && (
                              <Typography variant="body1" sx={{ color: '#d32f2f', mt: 1, fontWeight: 'bold' }}>
                                {detailsApplication.rejection_reason}
                              </Typography>
                            )}
                          </Box>
                        }
                        primaryTypographyProps={{ variant: 'caption' }}
                        secondaryTypographyProps={{ variant: 'body1', component: 'div' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>

                {user?.is_hr_member &&
                  detailsApplication?.status === 'pending' &&
                  detailsApplication?.current_approval_stage !== 'completed' && (
                    <Grid item xs={12}>
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {t('approvalDetail.rejectApplication')}
                        </Typography>
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          label={t('approvalDetail.rejectionReason')}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder={t('approvalDetail.rejectionReasonPlaceholder')}
                        />
                      </Box>
                    </Grid>
                  )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {user?.is_hr_member &&
            detailsApplication?.status === 'pending' &&
            detailsApplication?.current_approval_stage !== 'completed' && (
              <Button
                onClick={handleRejectSingle}
                variant="contained"
                color="error"
                disabled={rejectSubmitting}
                sx={{ ml: 'auto' }}
              >
                {rejectSubmitting ? t('approvalDetail.processing') : t('approvalDetail.rejectApplication')}
              </Button>
            )}
          <Button onClick={handleCloseDetails} variant="outlined">
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OutdoorWorkBulkApproval;

