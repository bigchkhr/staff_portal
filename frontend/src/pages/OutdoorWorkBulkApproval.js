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
  Divider
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { formatDate } from '../utils/dateFormat';

const OutdoorWorkBulkApproval = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicantId } = useParams();

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchList = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/approvals/pending/outdoor-work/applicant/${applicantId}`);
        const apps = res.data.applications || [];
        setApplications(apps);
        setSelectedIds(apps.map(a => a.id)); // default 全數選取
      } catch (e) {
        console.error('Fetch outdoor work bulk approvals error:', e);
        setApplications([]);
        setSelectedIds([]);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [applicantId]);

  const applicantDisplay = useMemo(() => {
    const first = applications[0];
    if (!first) return '';
    const empNo = first.applicant_employee_number || first.user_employee_number;
    return `${first.applicant_display_name || ''}${empNo ? ` (${empNo})` : ''}`;
  }, [applications]);

  const allSelected = applications.length > 0 && selectedIds.length === applications.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < applications.length;

  const toggleAll = (checked) => {
    if (checked) setSelectedIds(applications.map(a => a.id));
    else setSelectedIds([]);
  };

  const toggleOne = (id, checked) => {
    setSelectedIds(prev => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter(x => x !== id);
    });
  };

  const submit = async (action) => {
    if (!selectedIds.length) {
      await Swal.fire({
        icon: 'warning',
        title: t('common.warning') || '提示',
        text: '請先選擇最少一個申請',
        confirmButtonText: '確定'
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: 'question',
      title: action === 'approve' ? '確認批核' : '確認拒絕',
      text: `將會對 ${selectedIds.length} 筆外勤工作申請進行${action === 'approve' ? '批核' : '拒絕'}。`,
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
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
        title: '完成',
        text: res.data.message || '批量操作完成',
        confirmButtonText: '確定'
      });

      navigate('/approval/list');
    } catch (e) {
      console.error('Bulk submit error:', e);
      const msg = e.response?.data?.message || '批量批核時發生錯誤';
      const forbiddenIds = Array.isArray(e.response?.data?.ids) ? e.response.data.ids : [];
      const detail = forbiddenIds.length
        ? `\n\n無權限項目（ID）：${forbiddenIds.join(', ')}\n常見原因：未輪到你嗰一關／你唔屬於該階段授權群組／該筆已被其他人處理。`
        : '';
      await Swal.fire({
        icon: 'error',
        title: '操作失敗',
        text: `${msg}${detail}`,
        confirmButtonText: '確定'
      });
    } finally {
      setSubmitting(false);
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
        外勤工作批量批核
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('approvalList.applicant') || '申請人'}：{applicantDisplay || '-'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        {applications.length === 0 ? (
          <Alert severity="info">此員工暫無待批核外勤工作申請。</Alert>
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
                    <TableCell>交易編號</TableCell>
                    <TableCell>日期時間</TableCell>
                    <TableCell>總時數</TableCell>
                    <TableCell>開始地點</TableCell>
                    <TableCell>結束地點</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {applications.map(app => (
                    <TableRow key={app.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(app.id)}
                          onChange={(e) => toggleOne(app.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{app.transaction_id || app.id}</TableCell>
                      <TableCell>
                        {app.start_date && app.end_date
                          ? `${formatDate(app.start_date)} ${app.start_time || ''} ~ ${formatDate(app.end_date)} ${app.end_time || ''}`
                          : '-'}
                      </TableCell>
                      <TableCell>{app.total_hours || 0}</TableCell>
                      <TableCell>{app.start_location || '-'}</TableCell>
                      <TableCell>{app.end_location || '-'}</TableCell>
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
                label="備註（可選）"
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
                批核已選取
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={submitting || selectedIds.length === 0}
                onClick={() => submit('reject')}
              >
                拒絕已選取
              </Button>
              <Button
                variant="outlined"
                disabled={submitting}
                onClick={() => navigate('/approval/list')}
              >
                返回
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default OutdoorWorkBulkApproval;

