import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Badge,
  IconButton,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  Divider,
  Collapse,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CalendarToday as CalendarIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Send as SendIcon,
  Undo as UndoIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import OutdoorWorkCalendarChip from '../components/OutdoorWorkCalendarChip';
import { getRosterDurationMinutes } from '../utils/rosterDuration';
import { HK_TZ, toHKCalendarDate, toHKDayjs } from '../utils/dateFormat';

// 配置 dayjs 時區插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 設置默認時區為香港（UTC+8）
dayjs.tz.setDefault('Asia/Hong_Kong');

const MAX_EDIT_DAYS = 31;

const buildDateRange = (from, to) => {
  const start = toHKDayjs(from);
  const end = toHKDayjs(to);
  if (!start || !end) return [];
  const dates = [];
  let current = start;
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current);
    current = current.add(1, 'day');
  }
  return dates;
};

const makeCellKey = (userId, dateStr) => `${Number(userId)}|${dateStr}`;

const parseCellKey = (key) => {
  const text = String(key || '');
  const idx = text.indexOf('|');
  if (idx < 0) return { userId: NaN, dateStr: '' };
  return { userId: Number(text.slice(0, idx)), dateStr: text.slice(idx + 1) };
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const Schedule = ({ noLayout = false }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isHRMember = Boolean(user?.is_hr_member || user?.is_system_admin);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // 根據語言格式化日期顯示
  const formatDateDisplay = (date) => {
    if (!date) return '';
    const dateStr = toHKCalendarDate(date);
    if (!dateStr) return '';
    const d = dayjs.tz(dateStr, 'YYYY-MM-DD', HK_TZ);
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    return isChinese ? d.format('DD/MM') : d.format('MM/DD');
  };
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [outdoorWorkByCell, setOutdoorWorkByCell] = useState({});
  const [helperSchedules, setHelperSchedules] = useState([]);
  // 默認設定為當天到當月最後一天
  const [startDate, setStartDate] = useState(() => dayjs().tz('Asia/Hong_Kong'));
  const [endDate, setEndDate] = useState(() => dayjs().tz('Asia/Hong_Kong').endOf('month'));
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [batchEditDialogOpen, setBatchEditDialogOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [batchStartTime, setBatchStartTime] = useState('');
  const [batchEndTime, setBatchEndTime] = useState('');
  const [batchLeaveTypeId, setBatchLeaveTypeId] = useState(null);
  const [batchLeaveSession, setBatchLeaveSession] = useState(null);
  const [batchStoreId, setBatchStoreId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLeaveTypeId, setEditLeaveTypeId] = useState(null);
  const [editLeaveSession, setEditLeaveSession] = useState(null);
  const [editStoreId, setEditStoreId] = useState(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [stores, setStores] = useState([]);
  const [selectedDefaultStoreId, setSelectedDefaultStoreId] = useState(null); // 控制面板選擇的店舖（不存到資料庫）
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pendingError, setPendingError] = useState(null); // 待顯示的錯誤訊息
  const [allowCheckerEdit, setAllowCheckerEdit] = useState(true); // checker 是否可以編輯排班表
  const [canControlCheckerEdit, setCanControlCheckerEdit] = useState(false); // 當前用戶是否可以控制 checker 編輯權限
  const [isApprover, setIsApprover] = useState(false); // 當前用戶是否為 approver（不包括 checker）
  const [checkerEditableStartDate, setCheckerEditableStartDate] = useState(null); // Checker 可編輯範圍開始（UTC+8）
  const [checkerEditableEndDate, setCheckerEditableEndDate] = useState(null); // Checker 可編輯範圍結束（UTC+8）
  const [checkerSectionExpanded, setCheckerSectionExpanded] = useState(false);
  const [requireCheckerApproval, setRequireCheckerApproval] = useState(false);
  const [isChecker, setIsChecker] = useState(false);
  const [changeSubmissions, setChangeSubmissions] = useState([]);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [editSetupOpen, setEditSetupOpen] = useState(false);
  const [setupMemberIds, setSetupMemberIds] = useState([]);
  const [setupStartDate, setSetupStartDate] = useState(null);
  const [setupEndDate, setSetupEndDate] = useState(null);
  const [editMemberIds, setEditMemberIds] = useState([]);
  const [editRangeStart, setEditRangeStart] = useState(null);
  const [editRangeEnd, setEditRangeEnd] = useState(null);
  const [selectedCellKeys, setSelectedCellKeys] = useState([]);
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const viewDates = useMemo(() => buildDateRange(startDate, endDate), [startDate, endDate]);
  const editDates = useMemo(() => buildDateRange(editRangeStart, editRangeEnd), [editRangeStart, editRangeEnd]);
  const dates = editMode && editDates.length > 0 ? editDates : viewDates;
  const displayedMembers = useMemo(() => {
    if (!editMode || !editMemberIds.length) return groupMembers;
    const idSet = new Set(editMemberIds.map(Number));
    return groupMembers.filter((m) => idSet.has(Number(m.id)));
  }, [editMode, groupMembers, editMemberIds]);
  const selectedCellKeySet = useMemo(() => new Set(selectedCellKeys), [selectedCellKeys]);

  useEffect(() => {
    fetchDepartmentGroups();
    fetchLeaveTypes();
    fetchStores();
  }, []);

  useEffect(() => {
    setEditMode(false);
    setEditSetupOpen(false);
    setSelectedCellKeys([]);
    setSelectionAnchor(null);
    setEditMemberIds([]);
    setEditRangeStart(null);
    setEditRangeEnd(null);
  }, [selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers();
      fetchSchedules();
      checkEditPermission();
    }
  }, [selectedGroupId, startDate, endDate, selectedDefaultStoreId]);

  // 處理開始日期變更，自動將結束日期設定為該月的最後一天
  const handleStartDateChange = (newValue) => {
    const next = toHKDayjs(newValue);
    if (!next) return;
    setStartDate(next);
    setEndDate(next.endOf('month'));
  };

  const handleEndDateChange = (newValue) => {
    const next = toHKDayjs(newValue);
    if (!next) return;
    const viewStart = toHKDayjs(startDate);
    if (viewStart) {
      if (next.month() !== viewStart.month() || next.year() !== viewStart.year()) {
        setEndDate(viewStart.endOf('month'));
        return;
      }
    }
    setEndDate(next);
  };

  // 當群組改變時，更新 allow_checker_edit 及 checker 可編輯日期範圍（一律以 UTC+8 香港日曆解讀）
  useEffect(() => {
    if (selectedGroupId) {
      const group = departmentGroups.find(g => g.id === selectedGroupId);
      if (group) {
        setAllowCheckerEdit(group.allow_checker_edit !== false);
        setRequireCheckerApproval(group.require_checker_schedule_approval === true);
        const start = group.checker_editable_start_date;
        const end = group.checker_editable_end_date;
        const startStr = toHKCalendarDate(start);
        const endStr = toHKCalendarDate(end);
        setCheckerEditableStartDate(startStr ? dayjs.tz(startStr, 'YYYY-MM-DD', HK_TZ) : null);
        setCheckerEditableEndDate(endStr ? dayjs.tz(endStr, 'YYYY-MM-DD', HK_TZ) : null);
      }
    }
  }, [selectedGroupId, departmentGroups]);

  // 監聽 modal 關閉，如果有待顯示的錯誤訊息，則顯示
  useEffect(() => {
    if (!csvImportDialogOpen && pendingError) {
      // Modal 已關閉，顯示錯誤訊息
      const error = pendingError;
      setPendingError(null); // 清除待顯示的錯誤
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || error.message || t('schedule.csvImportFailed'),
        allowOutsideClick: true,
        allowEscapeKey: true
      });
    }
  }, [csvImportDialogOpen, pendingError, t]);

  const fetchDepartmentGroups = async () => {
    try {
      // 獲取用戶有權限查看的排班群組
      const response = await axios.get('/api/schedules/accessible-groups');
      setDepartmentGroups(response.data.groups || []);
      
      // 如果用戶只屬於一個群組，自動選擇
      if (response.data.groups && response.data.groups.length === 1) {
        setSelectedGroupId(response.data.groups[0].id);
      }
    } catch (error) {
      console.error('Fetch department groups error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: t('schedule.fetchGroupsFailed')
      });
    }
  };

  const fetchGroupMembers = async () => {
    if (!selectedGroupId) return;
    
    try {
      const response = await axios.get(`/api/groups/department/${selectedGroupId}/members`);
      const members = response.data.members || [];
      // 後端已經按 positions.display_order 排序，不需要再次排序
      setGroupMembers(members);
    } catch (error) {
      console.error('Fetch group members error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.fetchGroupsFailed')
      });
    }
  };

  const fetchStores = async () => {
    try {
      const response = await axios.get('/api/stores');
      setStores(response.data.stores || []);
    } catch (error) {
      console.error('Fetch stores error:', error);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const response = await axios.get('/api/leave-types');
      // 只保留允許在排班表中輸入的假期類型
      const allowedLeaveTypes = (response.data.leaveTypes || []).filter(lt => lt.allow_schedule_input);
      setLeaveTypes(allowedLeaveTypes);
    } catch (error) {
      console.error('Fetch leave types error:', error);
    }
  };

  const fetchSchedules = async () => {
    if (!selectedGroupId) return;
    
    setLoading(true);
    try {
      // 確保日期有效並使用香港時區格式化
      let startDateStr, endDateStr;
      try {
        const start = dayjs(startDate);
        const end = dayjs(endDate);
        if (!start.isValid() || !end.isValid()) {
          throw new Error('Invalid date range');
        }
        startDateStr = toHKCalendarDate(start);
        endDateStr = toHKCalendarDate(end);
        if (!startDateStr || !endDateStr) {
          throw new Error('Invalid date range');
        }
      } catch (error) {
        console.error('Error formatting dates for API:', error);
        throw error;
      }
      
      // 獲取原本群組的排班（原舖）
      const schedulesResponse = await axios.get('/api/schedules', {
        params: {
          department_group_id: selectedGroupId,
          start_date: startDateStr,
          end_date: endDateStr
        }
      });
      const schedulesData = schedulesResponse.data.schedules || [];
      
      // 獲取幫舖排班（helper schedules）
      let helperSchedulesData = [];
      if (selectedDefaultStoreId) {
        try {
          const helperResponse = await axios.get('/api/schedules/helpers', {
            params: {
              department_group_id: selectedGroupId,
              store_id: selectedDefaultStoreId,
              start_date: startDateStr,
              end_date: endDateStr
            }
          });
          helperSchedulesData = helperResponse.data.helperSchedules || [];
        } catch (error) {
          console.error('Fetch helper schedules error:', error);
          // 如果獲取幫舖排班失敗，不影響原本群組的排班顯示
        }
      }
      setSchedules(schedulesData);
      setOutdoorWorkByCell(schedulesResponse.data.outdoor_work_by_cell || {});
      setChangeSubmissions(schedulesResponse.data.schedule_change_submissions || []);
      if (schedulesResponse.data.require_checker_schedule_approval !== undefined) {
        setRequireCheckerApproval(schedulesResponse.data.require_checker_schedule_approval === true);
      }
      setHelperSchedules(helperSchedulesData);
    } catch (error) {
      console.error('Fetch schedules error:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || t('schedule.fetchSchedulesFailed');
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const checkEditPermission = async () => {
    // 檢查用戶是否為批核成員
    try {
      const group = departmentGroups.find(g => g.id === selectedGroupId);
      if (!group) {
        setCanEdit(false);
        setCanControlCheckerEdit(false);
        setAllowCheckerEdit(true);
        setRequireCheckerApproval(false);
        setIsApprover(false);
        setIsChecker(false);
        return;
      }

      // 設置 allow_checker_edit 狀態
      setAllowCheckerEdit(group.allow_checker_edit !== false);
      setRequireCheckerApproval(group.require_checker_schedule_approval === true);

      // 檢查用戶是否為系統管理員
      if (user.is_system_admin) {
        setCanEdit(true);
        setCanControlCheckerEdit(true);
        setIsApprover(true); // 系統管理員視為 approver
        setIsChecker(false);
        return;
      }

      // 檢查用戶是否為批核成員（checker, approver_1, approver_2, approver_3）
      const userDelegationGroups = user.delegation_groups || [];
      const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

      const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
      const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
      const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
      const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

      // 只有 approver1, approver2, approver3 可以控制 checker 編輯權限
      setCanControlCheckerEdit(isApprover1 || isApprover2 || isApprover3);
      setIsApprover(isApprover1 || isApprover2 || isApprover3);
      setIsChecker(!!isChecker && !(isApprover1 || isApprover2 || isApprover3));

      if (isChecker) {
        setCanEdit(group.allow_checker_edit !== false);
      } else {
        setCanEdit(isApprover1 || isApprover2 || isApprover3);
      }
    } catch (error) {
      console.error('Check edit permission error:', error);
      setCanEdit(false);
      setCanControlCheckerEdit(false);
      setIsApprover(false);
      setIsChecker(false);
    }
  };

  // 檢查用戶是否為 checker、approver1、approver2、approver3
  const canViewLeaveTypeDetail = () => {
    // 系統管理員可以看到詳細假期類別
    if (user.is_system_admin) {
      return true;
    }

    const group = departmentGroups.find(g => g.id === selectedGroupId);
    if (!group) {
      return false;
    }

    const userDelegationGroups = user.delegation_groups || [];
    const userDelegationGroupIds = userDelegationGroups.map(g => Number(g.id));

    const isChecker = group.checker_id && userDelegationGroupIds.includes(Number(group.checker_id));
    const isApprover1 = group.approver_1_id && userDelegationGroupIds.includes(Number(group.approver_1_id));
    const isApprover2 = group.approver_2_id && userDelegationGroupIds.includes(Number(group.approver_2_id));
    const isApprover3 = group.approver_3_id && userDelegationGroupIds.includes(Number(group.approver_3_id));

    return isChecker || isApprover1 || isApprover2 || isApprover3;
  };

  const renderTerminationDateBelowPosition = (terminationDate, fontSizeRem) => {
    if (!canViewLeaveTypeDetail() || !terminationDate) return null;
    const dateKey = toHKCalendarDate(terminationDate);
    if (!dateKey) return null;
    const d = dayjs.tz(dateKey, 'YYYY-MM-DD', HK_TZ);
    const dateStr =
      i18n.language === 'en' ? d.format('MMM D, YYYY') : dateKey;
    return (
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          fontSize: fontSizeRem,
          color: '#4a4944',
          fontWeight: 500,
          mt: 0.25,
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {t('schedule.terminationDateLabel', { date: dateStr })}
      </Typography>
    );
  };

  const renderRosterTotalHoursCaption = (startTime, endTime, fontSizeRem = '0.65rem') => {
    const label = getRosterTotalHoursLabel(startTime, endTime);
    if (!label) return null;
    return (
      <Typography
        variant="caption"
        component="div"
        sx={{
          fontSize: fontSizeRem,
          color: '#4a4944',
          fontWeight: 400,
          mt: 0.25,
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
    );
  };

  // 將 API 回傳的日期統一解讀為 UTC+8 香港日曆的 YYYY-MM-DD
  const toHKDateStr = (val) => toHKCalendarDate(val);

  const scheduleDateKey = (val) => toHKCalendarDate(val);

  const scheduleByCellKey = useMemo(() => {
    const map = new Map();
    (schedules || []).forEach((s) => {
      const dateStr = scheduleDateKey(s.schedule_date);
      if (!dateStr) return;
      map.set(makeCellKey(s.user_id, dateStr), s);
    });
    return map;
  }, [schedules]);

  const changeByCellKey = useMemo(() => {
    const map = new Map();
    (changeSubmissions || []).forEach((submission) => {
      const isOwn = Number(submission.submitted_by_id) === Number(user?.id);
      if (submission.status === 'draft' && !isOwn) return;
      (submission.items || []).forEach((item) => {
        const itemDate = scheduleDateKey(item.schedule_date);
        if (!itemDate) return;
        const key = makeCellKey(item.user_id, itemDate);
        if (map.has(key)) return;
        map.set(key, {
          ...item,
          status: submission.status,
          submission_id: submission.id,
          submitted_by_id: submission.submitted_by_id,
          return_reason: submission.return_reason
        });
      });
    });
    return map;
  }, [changeSubmissions, user?.id]);

  const enrichScheduleDisplay = (schedule) => {
    if (!schedule) return schedule;
    const leaveType = leaveTypes.find((lt) => Number(lt.id) === Number(schedule.leave_type_id));
    const store = stores.find((st) => Number(st.id) === Number(schedule.store_id));
    return {
      ...schedule,
      leave_type_code: schedule.leave_type_code || leaveType?.code || null,
      leave_type_name: schedule.leave_type_name || leaveType?.name || null,
      leave_type_name_zh: schedule.leave_type_name_zh || leaveType?.name_zh || null,
      store_code: schedule.store_code || store?.store_code || null,
      store_short_name: schedule.store_short_name || store?.store_short_name_ || store?.store_short_name || null
    };
  };

  const upsertLocalSubmission = (submission) => {
    if (!submission) return;
    setChangeSubmissions((prev) => {
      const rest = prev.filter((s) => Number(s.id) !== Number(submission.id));
      if (submission.status === 'approved') return rest;
      return [submission, ...rest];
    });
  };

  const mergeOfficialSchedules = (incoming) => {
    const list = (Array.isArray(incoming) ? incoming : [incoming]).filter(Boolean).map(enrichScheduleDisplay);
    if (list.length === 0) return;
    setSchedules((prev) => {
      const next = [...prev];
      for (const schedule of list) {
        const dateStr = scheduleDateKey(schedule.schedule_date);
        const idx = next.findIndex((s) =>
          Number(s.user_id) === Number(schedule.user_id) &&
          scheduleDateKey(s.schedule_date) === dateStr
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...schedule, schedule_date: dateStr || next[idx].schedule_date };
        } else {
          next.push({ ...schedule, schedule_date: dateStr || schedule.schedule_date });
        }
      }
      return next;
    });
  };

  const removeOfficialSchedules = (pairs) => {
    const keys = new Set(
      (pairs || [])
        .map((p) => `${Number(p.user_id)}_${scheduleDateKey(p.schedule_date)}`)
        .filter((key) => !key.endsWith('_null'))
    );
    if (keys.size === 0) return;
    setSchedules((prev) => prev.filter((s) =>
      !keys.has(`${Number(s.user_id)}_${scheduleDateKey(s.schedule_date)}`)
    ));
  };

  const bumpGroupPendingCount = (delta) => {
    const n = Number(delta) || 0;
    if (!n || !selectedGroupId) return;
    setDepartmentGroups((prev) => prev.map((g) =>
      Number(g.id) === Number(selectedGroupId)
        ? { ...g, pending_item_count: Math.max(0, (Number(g.pending_item_count) || 0) + n) }
        : g
    ));
  };

  const applySaveResponse = (data, deletedOfficial = null) => {
    if (data?.requires_approval && data.submission) {
      upsertLocalSubmission(data.submission);
      return;
    }
    if (data?.submission && !data.schedule && !data.schedules) {
      upsertLocalSubmission(data.submission);
      return;
    }
    if (data?.schedule) mergeOfficialSchedules(data.schedule);
    if (data?.schedules) mergeOfficialSchedules(data.schedules);
    if (deletedOfficial) {
      removeOfficialSchedules([deletedOfficial]);
    }
  };

  const getMyOpenSubmission = () => {
    return changeSubmissions.find(s =>
      ['draft', 'returned'].includes(s.status) && Number(s.submitted_by_id) === Number(user?.id)
    ) || null;
  };

  const getMyPendingSubmission = () => {
    return changeSubmissions.find(s =>
      s.status === 'pending' && Number(s.submitted_by_id) === Number(user?.id)
    ) || null;
  };

  const isOwnSubmission = (submission) =>
    !!submission && Number(submission.submitted_by_id) === Number(user?.id);

  const getPendingSubmissions = () => changeSubmissions.filter(s => s.status === 'pending');

  const getDraftSubmissions = () => changeSubmissions.filter(s => s.status === 'draft');

  const isCheckerPendingLocked = () => {
    return !!(isChecker && requireCheckerApproval && getMyPendingSubmission());
  };

  const formatCellDateStr = (date) => toHKCalendarDate(date);

  const getChangeForUserAndDate = (userId, date) => {
    const dateStr = formatCellDateStr(date);
    if (!dateStr) return null;
    return changeByCellKey.get(makeCellKey(userId, dateStr)) || null;
  };

  const getDisplaySchedule = (userId, date) => {
    const official = getScheduleForUserAndDate(userId, date);
    const change = getChangeForUserAndDate(userId, date);
    if (!change) return official;
    if (change.action === 'delete') {
      return {
        ...(official || { user_id: userId, schedule_date: formatCellDateStr(date), id: official?.id || null }),
        _change: change,
        _proposedDelete: true
      };
    }
    return {
      ...(official || {}),
      id: official?.id || null,
      user_id: userId,
      schedule_date: formatCellDateStr(date) || official?.schedule_date,
      department_group_id: change.department_group_id || official?.department_group_id || selectedGroupId,
      start_time: change.start_time,
      end_time: change.end_time,
      leave_type_id: change.leave_type_id,
      leave_session: change.leave_session,
      store_id: change.store_id,
      remarks: change.remarks,
      leave_type_code: change.leave_type_code,
      leave_type_name: change.leave_type_name,
      leave_type_name_zh: change.leave_type_name_zh,
      store_code: change.store_code,
      store_short_name: change.store_short_name,
      _change: change,
      _changeItemId: change.id
    };
  };

  const getChangeStatusLabel = (status, action) => {
    if (action === 'delete') return t('schedule.proposedDelete');
    if (status === 'pending') return t('schedule.statusPending');
    if (status === 'returned') return t('schedule.statusReturned');
    return t('schedule.statusDraft');
  };

  const getChangeBadgeColor = (change) => {
    if (!change) return 'default';
    if (change.status === 'pending') return 'warning';
    return 'error';
  };

  const wrapWithChangeBadge = (change, children) => (
    <Badge
      invisible={!change}
      badgeContent={change ? getChangeStatusLabel(change.status, change.action) : 0}
      color={getChangeBadgeColor(change)}
      overlap="rectangular"
      sx={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        '& .MuiBadge-badge': {
          fontSize: '0.58rem',
          height: 16,
          minWidth: 16,
          px: 0.5,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          top: 2,
          right: 2,
          ...((change?.status === 'draft' || change?.status === 'returned')
            ? { bgcolor: '#c62828', color: '#ffffff' }
            : {})
        }
      }}
    >
      {children}
    </Badge>
  );

  const dateHasPendingChange = (date) => {
    const dateStr = formatCellDateStr(date);
    if (!dateStr) return false;
    return changeSubmissions.some((submission) =>
      submission.status === 'pending' &&
      (submission.items || []).some((item) => formatCellDateStr(item.schedule_date) === dateStr)
    );
  };

  const formatHistoryPayload = (payload) => {
    if (!payload) return '—';
    if (payload.action === 'delete') return t('schedule.proposedDelete');
    const time = `${payload.start_time ? String(payload.start_time).substring(0, 5) : '--:--'} - ${payload.end_time ? String(payload.end_time).substring(0, 5) : '--:--'}`;
    const leave = payload.leave_type_name_zh || payload.leave_type_id || '';
    const store = payload.store_short_name || payload.store_id || '';
    return [time, leave, store, payload.remarks].filter(Boolean).join(' / ');
  };

  const getChangeActionLabel = (action) => {
    const map = {
      direct_edit: t('schedule.changeActionDirectEdit'),
      direct_delete: t('schedule.changeActionDirectDelete'),
      draft_save: t('schedule.changeActionDraftSave'),
      submit: t('schedule.changeActionSubmit'),
      withdraw: t('schedule.changeActionWithdraw'),
      approve: t('schedule.changeActionApprove'),
      return: t('schedule.changeActionReturn')
    };
    return map[action] || action;
  };

  const handleOpenHistory = async (userId, date) => {
    const dateStr = formatCellDateStr(date);
    setHistoryTarget({ userId, dateStr });
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/schedules/change-logs', {
        params: {
          department_group_id: selectedGroupId,
          user_id: userId,
          schedule_date: dateStr
        }
      });
      setHistoryLogs(res.data.logs || []);
    } catch (error) {
      console.error('Fetch change logs error:', error);
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmitMyChanges = async () => {
    const open = getMyOpenSubmission();
    if (!open) return;
    try {
      const response = await axios.post(`/api/schedules/changes/${open.id}/submit`);
      const submitted = response.data.submission;
      upsertLocalSubmission(submitted);
      bumpGroupPendingCount((submitted?.items || []).length);
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.submitSuccess')
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  const handleWithdrawMyChanges = async () => {
    const pending = getMyPendingSubmission();
    if (!pending) return;
    const result = await Swal.fire({
      icon: 'question',
      title: t('schedule.withdrawChanges'),
      text: t('schedule.confirmWithdraw'),
      showCancelButton: true,
      confirmButtonText: t('schedule.withdrawChanges'),
      cancelButtonText: t('common.cancel')
    });
    if (!result.isConfirmed) return;
    try {
      const response = await axios.post(`/api/schedules/changes/${pending.id}/withdraw`);
      const withdrawn = response.data.submission;
      upsertLocalSubmission(withdrawn);
      bumpGroupPendingCount(-((withdrawn?.items || []).length));
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.withdrawSuccess')
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  const handleApproveSubmission = async (submissionId) => {
    const result = await Swal.fire({
      icon: 'question',
      title: t('schedule.approveChanges'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    });
    if (!result.isConfirmed) return;
    try {
      const response = await axios.post(`/api/schedules/changes/${submissionId}/approve`);
      const submitted = response.data.submission;
      const applied = response.data.applied || [];
      const toRemove = [];
      const toMerge = [];
      if (applied.length > 0) {
        applied.forEach((row) => {
          if (row.deleted) {
            toRemove.push({ user_id: row.user_id, schedule_date: row.schedule_date });
          } else if (row.schedule) {
            toMerge.push({
              ...row.schedule,
              leave_type_code: row.item?.leave_type_code || row.schedule.leave_type_code,
              leave_type_name: row.item?.leave_type_name || row.schedule.leave_type_name,
              leave_type_name_zh: row.item?.leave_type_name_zh || row.schedule.leave_type_name_zh,
              store_code: row.item?.store_code || row.schedule.store_code,
              store_short_name: row.item?.store_short_name || row.schedule.store_short_name
            });
          }
        });
      } else {
        (submitted?.items || []).forEach((item) => {
          if (item.action === 'delete') {
            toRemove.push({ user_id: item.user_id, schedule_date: item.schedule_date });
          } else {
            toMerge.push({
              user_id: item.user_id,
              department_group_id: item.department_group_id,
              schedule_date: item.schedule_date,
              start_time: item.start_time,
              end_time: item.end_time,
              leave_type_id: item.leave_type_id,
              leave_session: item.leave_session,
              store_id: item.store_id,
              remarks: item.remarks,
              leave_type_code: item.leave_type_code,
              leave_type_name: item.leave_type_name,
              leave_type_name_zh: item.leave_type_name_zh,
              store_code: item.store_code,
              store_short_name: item.store_short_name
            });
          }
        });
      }
      if (toRemove.length) removeOfficialSchedules(toRemove);
      if (toMerge.length) mergeOfficialSchedules(toMerge);
      upsertLocalSubmission({ ...(submitted || {}), status: 'approved' });
      bumpGroupPendingCount(-((submitted?.items || []).length));
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.approveSuccess')
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  const handleReturnSubmission = async (submissionId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.returnChanges'),
      input: 'textarea',
      inputPlaceholder: t('schedule.returnReasonPlaceholder'),
      showCancelButton: true,
      confirmButtonText: t('schedule.returnChanges'),
      cancelButtonText: t('common.cancel')
    });
    if (!result.isConfirmed) return;
    try {
      const response = await axios.post(`/api/schedules/changes/${submissionId}/return`, { reason: result.value || null });
      const returned = response.data.submission;
      upsertLocalSubmission(returned);
      bumpGroupPendingCount(-((returned?.items || []).length));
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.returnSuccess')
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  const handleToggleCheckerApproval = async (event) => {
    if (!isHRMember) return;
    const newValue = event.target.checked;
    if (!selectedGroupId) return;
    try {
      await axios.put(`/api/schedules/group/${selectedGroupId}/checker-edit-permission`, {
        require_checker_schedule_approval: newValue
      });
      setRequireCheckerApproval(newValue);
      setDepartmentGroups(prev => prev.map(g =>
        g.id === selectedGroupId ? { ...g, require_checker_schedule_approval: newValue } : g
      ));
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: newValue ? t('schedule.checkerApprovalEnabled') : t('schedule.checkerApprovalDisabled'),
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
      setRequireCheckerApproval(!newValue);
    }
  };

  const handleBatchUpdateCheckerApproval = async (enable) => {
    if (!isHRMember) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmBatchUpdate'),
      text: enable ? t('schedule.confirmEnableAllCheckerApproval') : t('schedule.confirmDisableAllCheckerApproval'),
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    });
    if (!result.isConfirmed) return;
    try {
      const response = await axios.put('/api/schedules/groups/batch-checker-edit-permission', {
        require_checker_schedule_approval: enable
      });
      setDepartmentGroups(prev => prev.map(g => ({ ...g, require_checker_schedule_approval: enable })));
      setRequireCheckerApproval(enable);
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.batchUpdateSuccess', { count: response.data?.updated_count ?? 0 }),
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.batchUpdateFailed')
      });
    }
  };

  // 檢查該日期是否在 checker 可編輯範圍內（UTC+8）；approver / 系統管理員不受限
  const canEditDate = (date) => {
    if (isApprover || user?.is_system_admin) return true;
    if (isCheckerPendingLocked()) return false;
    const group = departmentGroups.find(g => g.id === selectedGroupId);
    if (!group || !allowCheckerEdit) return false;
    const startStr = toHKDateStr(group.checker_editable_start_date);
    const endStr = toHKDateStr(group.checker_editable_end_date);
    if (startStr == null && endStr == null) return true;
    const dateStr = toHKCalendarDate(date);
    if (startStr != null && dateStr < startStr) return false;
    if (endStr != null && dateStr > endStr) return false;
    return true;
  };

  // 獲取應該顯示的假期類別文字
  const getLeaveTypeDisplayText = (schedule) => {
    if (!schedule || (!schedule.leave_type_name_zh && !schedule.leave_type_name && !schedule.leave_type_code)) {
      return null;
    }

    const canViewDetail = canViewLeaveTypeDetail();
    
    // 如果不能查看詳細類別，只顯示「假期」
    if (!canViewDetail) {
      const periodText = schedule.leave_session 
        ? ` (${schedule.leave_session === 'AM' ? t('schedule.morning') : t('schedule.afternoon')})`
        : '';
      return i18n.language === 'en' ? `Leave${periodText}` : `假期${periodText}`;
    }

    // 可以查看詳細類別，顯示具體的假期類別
    const leaveTypeDisplay = i18n.language === 'en'
      ? (schedule.leave_type_code || schedule.leave_type_name)
      : (schedule.leave_type_name_zh || schedule.leave_type_name);
    
    return schedule.leave_session 
      ? `${leaveTypeDisplay} (${schedule.leave_session === 'AM' ? t('schedule.morning') : t('schedule.afternoon')})`
      : leaveTypeDisplay;
  };

  const getScheduleForUserAndDate = (userId, date) => {
    if (date == null || userId == null) return null;
    const dateStr = formatCellDateStr(date);
    if (!dateStr) return null;
    return scheduleByCellKey.get(makeCellKey(userId, dateStr)) || null;
  };

  const getOutdoorWorkForUserAndDate = (userId, date) => {
    if (!date || !outdoorWorkByCell || typeof outdoorWorkByCell !== 'object') return [];
    const dateStr = toHKCalendarDate(date);
    if (!dateStr) return [];
    const key = `${Number(userId)}_${dateStr}`;
    return outdoorWorkByCell[key] || [];
  };

  const clampSetupRange = (start, end) => {
    let nextStart = toHKDayjs(start);
    let nextEnd = toHKDayjs(end);
    if (!nextStart || !nextEnd) return { start: nextStart, end: nextEnd };
    if (nextEnd.isBefore(nextStart, 'day')) nextEnd = nextStart;
    const maxEnd = nextStart.add(MAX_EDIT_DAYS - 1, 'day');
    if (nextEnd.isAfter(maxEnd, 'day')) nextEnd = maxEnd;
    const viewStart = toHKDayjs(startDate);
    const viewEnd = toHKDayjs(endDate);
    if (viewStart && nextStart.isBefore(viewStart, 'day')) nextStart = viewStart;
    if (viewEnd && nextEnd.isAfter(viewEnd, 'day')) nextEnd = viewEnd;
    if (nextEnd.isBefore(nextStart, 'day')) nextEnd = nextStart;
    return { start: nextStart, end: nextEnd };
  };

  const resetExcelSelection = () => {
    setSelectedCellKeys([]);
    setSelectionAnchor(null);
  };

  const handleExitEditMode = () => {
    setEditMode(false);
    setEditSetupOpen(false);
    resetExcelSelection();
    setEditMemberIds([]);
    setEditRangeStart(null);
    setEditRangeEnd(null);
  };

  const handleOpenEditSetup = () => {
    if (!canEdit || !selectedGroupId || groupMembers.length === 0) return;
    const defaultStart = startDate;
    const { start, end } = clampSetupRange(defaultStart, endDate);
    setSetupMemberIds(groupMembers.map((m) => m.id));
    setSetupStartDate(start);
    setSetupEndDate(end);
    setEditSetupOpen(true);
  };

  const handleConfirmEditSetup = () => {
    if (!setupMemberIds.length) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectUsersFirst')
      });
      return;
    }
    if (!setupStartDate || !setupEndDate) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectEditDateRange')
      });
      return;
    }
    const { start, end } = clampSetupRange(setupStartDate, setupEndDate);
    const dayCount = end.diff(start, 'day') + 1;
    if (dayCount > MAX_EDIT_DAYS) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.editRangeMaxDays', { days: MAX_EDIT_DAYS })
      });
      return;
    }
    setEditMemberIds(setupMemberIds);
    setEditRangeStart(start);
    setEditRangeEnd(end);
    resetExcelSelection();
    setEditMode(true);
    setEditSetupOpen(false);
  };

  const openExcelBatchDialog = () => {
    if (!selectedCellKeys.length) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectCellsFirst')
      });
      return;
    }
    setBatchStoreId(selectedDefaultStoreId);
    setBatchEditDialogOpen(true);
  };

  const handleSelectAllVisibleCells = () => {
    const keys = [];
    displayedMembers.forEach((member) => {
      dates.forEach((date) => {
        if (!canEditDate(date)) return;
        keys.push(makeCellKey(member.id, toHKCalendarDate(date)));
      });
    });
    setSelectedCellKeys(keys);
    if (displayedMembers.length && dates.length) {
      setSelectionAnchor({
        rowIndex: 0,
        colIndex: 0,
        userId: displayedMembers[0].id,
        dateStr: toHKCalendarDate(dates[0])
      });
    }
  };

  const handleMatrixCellClick = (event, member, date, rowIndex, colIndex) => {
    event.preventDefault();
    if (event.detail > 1) return;
    const dateStr = toHKCalendarDate(date);
    const key = makeCellKey(member.id, dateStr);

    if (!editMode) {
      if (canViewLeaveTypeDetail()) {
        handleOpenHistory(member.id, date);
      }
      return;
    }
    if (!canEdit || !canEditDate(date)) return;

    if (event.shiftKey && selectionAnchor) {
      const r1 = Math.min(selectionAnchor.rowIndex, rowIndex);
      const r2 = Math.max(selectionAnchor.rowIndex, rowIndex);
      const c1 = Math.min(selectionAnchor.colIndex, colIndex);
      const c2 = Math.max(selectionAnchor.colIndex, colIndex);
      const keys = [];
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
          const m = displayedMembers[r];
          const d = dates[c];
          if (!m || !d || !canEditDate(d)) continue;
          keys.push(makeCellKey(m.id, toHKCalendarDate(d)));
        }
      }
      if (event.ctrlKey || event.metaKey) {
        setSelectedCellKeys((prev) => [...new Set([...prev, ...keys])]);
      } else {
        setSelectedCellKeys(keys);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      setSelectedCellKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
      setSelectionAnchor({ rowIndex, colIndex, userId: member.id, dateStr });
      return;
    }

    setSelectedCellKeys([key]);
    setSelectionAnchor({ rowIndex, colIndex, userId: member.id, dateStr });
  };

  const handleMatrixCellDoubleClick = (event, member, date, rowIndex, colIndex) => {
    if (!editMode || !canEdit || !canEditDate(date)) return;
    event.preventDefault();
    const dateStr = toHKCalendarDate(date);
    const key = makeCellKey(member.id, dateStr);
    if (!selectedCellKeys.includes(key)) {
      setSelectedCellKeys([key]);
      setSelectionAnchor({ rowIndex, colIndex, userId: member.id, dateStr });
    }
    setBatchStoreId(selectedDefaultStoreId);
    setBatchEditDialogOpen(true);
  };

  const renderCellBody = (schedule, outdoorApps) => {
    const timeText = schedule && (schedule.start_time || schedule.end_time)
      ? `${schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - ${schedule.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}`
      : null;
    const hoursLabel = schedule ? getRosterTotalHoursLabel(schedule.start_time, schedule.end_time) : null;
    const leaveText = getLeaveTypeDisplayText(schedule);
    const storeLabel = schedule?.store_short_name || schedule?.store_code;
    const hasOutdoor = outdoorApps && outdoorApps.length > 0;
    const empty = !timeText && !leaveText && !storeLabel && !hasOutdoor;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2, alignItems: 'center', width: '100%', pointerEvents: 'none' }}>
        {timeText && (
          <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#1565c0', fontWeight: 600, lineHeight: 1.2 }}>
            {timeText}
          </Typography>
        )}
        {hoursLabel && (
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.2 }}>
            {hoursLabel}
          </Typography>
        )}
        {leaveText && (
          <Chip
            label={leaveText}
            size="small"
            sx={{
              fontSize: '0.65rem',
              height: '18px',
              bgcolor: '#c62828',
              color: '#ffffff',
              fontWeight: 600,
              '& .MuiChip-label': { color: '#ffffff', px: 0.75 },
            }}
          />
        )}
        {storeLabel && (
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.2 }}>
            {storeLabel}
          </Typography>
        )}
        {hasOutdoor && (
          <Box sx={{ pointerEvents: 'auto' }}>
            <OutdoorWorkCalendarChip applications={outdoorApps} sx={{ fontSize: '0.65rem', height: '18px' }} />
          </Box>
        )}
        {empty && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>---</Typography>
        )}
      </Box>
    );
  };

  const renderMemberDateCell = (member, date, rowIndex, colIndex) => {
    const schedule = getDisplaySchedule(member.id, date);
    const outdoorApps = getOutdoorWorkForUserAndDate(member.id, date);
    const dateStr = toHKCalendarDate(date);
    const cellKey = makeCellKey(member.id, dateStr);
    const selected = editMode && selectedCellKeySet.has(cellKey);
    const editable = editMode && canEdit && canEditDate(date);

    return (
      <TableCell
        key={dateStr}
        align="center"
        onClick={(event) => handleMatrixCellClick(event, member, date, rowIndex, colIndex)}
        onDoubleClick={(event) => handleMatrixCellDoubleClick(event, member, date, rowIndex, colIndex)}
        sx={{
          minWidth: 80,
          whiteSpace: 'nowrap',
          p: 0.5,
          py: 1,
          userSelect: 'none',
          cursor: editMode ? (editable ? 'cell' : 'not-allowed') : (canViewLeaveTypeDetail() ? 'pointer' : 'default'),
          bgcolor: selected
            ? 'rgba(25, 118, 210, 0.22)'
            : (schedule?._change?.status === 'pending'
              ? 'rgba(237, 108, 2, 0.12)'
              : (schedule?._change?.status === 'draft' || schedule?._change?.status === 'returned'
                ? 'rgba(198, 40, 40, 0.12)'
                : undefined)),
          outline: selected ? '2px solid' : undefined,
          outlineColor: selected ? 'primary.main' : undefined,
          outlineOffset: '-2px',
          '&:hover': {
            bgcolor: selected
              ? 'rgba(25, 118, 210, 0.28)'
              : (schedule?._change?.status === 'pending'
                ? 'rgba(237, 108, 2, 0.2)'
                : (schedule?._change?.status === 'draft' || schedule?._change?.status === 'returned'
                  ? 'rgba(198, 40, 40, 0.2)'
                  : 'action.hover')),
          },
        }}
      >
        {wrapWithChangeBadge(schedule?._change, renderCellBody(schedule, outdoorApps))}
      </TableCell>
    );
  };

  const handleOpenEditDialog = (userId, date) => {
    if (!editMode || !canEdit) return;
    if (!canEditDate(date)) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.error'),
        text: t('schedule.checkerDateOutOfRange')
      });
      return;
    }

    const dateStr = toHKCalendarDate(date);
    if (!dateStr) {
      console.warn('Invalid date in handleOpenEditDialog');
      return;
    }
    
    const existingSchedule = getDisplaySchedule(userId, date);

    if (existingSchedule) {
      setEditingSchedule(existingSchedule);
      
      // 處理開始時間，支援HH:mm格式（0-32小時）
      if (existingSchedule.start_time) {
        const startTimeStr = existingSchedule.start_time;
        // 解析時間字符串，提取HH:mm部分
        const timeMatch = startTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          setEditStartTime(startTimeStr.substring(0, 5)); // 只取HH:mm部分
        } else {
          setEditStartTime('');
        }
      } else {
        setEditStartTime('');
      }
      
      // 處理結束時間，支援26:00格式（0-32小時）
      if (existingSchedule.end_time) {
        const endTimeStr = existingSchedule.end_time;
        // 解析時間字符串，提取HH:mm部分
        const timeMatch = endTimeStr.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          setEditEndTime(endTimeStr.substring(0, 5)); // 只取HH:mm部分
        } else {
          setEditEndTime('');
        }
      } else {
        setEditEndTime('');
      }
      
      // 設置假期類型
      setEditLeaveTypeId(existingSchedule.leave_type_id || null);
      setEditLeaveSession(existingSchedule.leave_session || null);
      // 設置店舖 - 如果有現有值則使用，否則為 null
      setEditStoreId(existingSchedule.store_id || null);
      setEditRemarks(existingSchedule.remarks || '');
      
    } else {
      // 獲取該員工所屬的群組作為默認值
      const member = groupMembers.find(m => m.id === userId);
      const defaultGroupId = member ? selectedGroupId : null;
      
      setEditingSchedule({
        user_id: userId,
        schedule_date: dateStr,
        id: null,
        department_group_id: defaultGroupId
      });
      setEditStartTime('');
      setEditEndTime('');
      setEditLeaveTypeId(null);
      setEditLeaveSession(null);
      // 設置店舖默認值為 null
      setEditStoreId(null);
      setEditRemarks('');
    }
    setEditDialogOpen(true);
  };

  // 計算結束時間（開始時間 + 9小時）
  const calculateEndTime = (startTime) => {
    if (!startTime || startTime.trim() === '') {
      return '';
    }
    
    // 解析開始時間
    let hours, minutes;
    
    // 處理4位數字格式（如2330）
    if (/^\d{4}$/.test(startTime)) {
      hours = parseInt(startTime.substring(0, 2), 10);
      minutes = parseInt(startTime.substring(2, 4), 10);
    } else {
      // 處理HH:mm格式
      const parts = startTime.split(':');
      if (parts.length !== 2) {
        return '';
      }
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    }
    
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 32 || minutes < 0 || minutes > 59) {
      return '';
    }
    
    // 加9小時
    const totalMinutes = hours * 60 + minutes + 9 * 60;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    
    // 格式化為HH:mm（支持0-32小時格式）
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  // 處理開始時間輸入（支援0-32小時格式，支援4位數字輸入如2330）
  const handleStartTimeChange = (e) => {
    const value = e.target.value;
    // 允許輸入格式：HH:mm 或 H:mm，或4位數字（如2330），小時範圍0-32
    if (value === '') {
      setEditStartTime('');
      setEditEndTime(''); // 清空開始時間時也清空結束時間
      return;
    }
    
    // 只允許數字和冒號
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    let finalStartTime = '';
    let shouldAutoCalculate = false;
    
    // 如果輸入的是4位數字（如2330），自動轉換為23:30格式
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      // 驗證範圍
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        finalStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        shouldAutoCalculate = true;
      }
    } else if (value.length <= 5) {
      // 限制長度（最多5個字符：HH:mm）
      const parts = value.split(':');
      
      if (parts.length === 1) {
        // 只有小時部分，或 3 位數字過渡（如 094）以便輸入第 4 位後變成 0945
        const hours = parseInt(parts[0], 10);
        if (!isNaN(hours) && hours >= 0 && hours <= 32) {
          setEditStartTime(value);
          // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
          if (selectedDefaultStoreId && !editStoreId) {
            setEditStoreId(selectedDefaultStoreId);
          }
          return; // 還未輸入完整，不自動計算
        }
        // 3 位純數字（如 094）允許暫存，輸入第 4 位即會觸發 4 位轉 09:45
        if (value.length === 3 && /^\d{3}$/.test(value)) {
          setEditStartTime(value);
          if (selectedDefaultStoreId && !editStoreId) setEditStoreId(selectedDefaultStoreId);
          return;
        }
      } else if (parts.length === 2) {
        // 有小時和分鐘
        const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
        const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
        
        // 驗證小時範圍（0-32）
        if (hours !== -1 && (hours < 0 || hours > 32)) {
          return;
        }
        
        // 驗證分鐘範圍（0-59）或允許部分輸入
        if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
          return;
        }
        
        // 如果分鐘部分超過2位數，截斷
        if (parts[1].length > 2) {
          finalStartTime = `${parts[0]}:${parts[1].substring(0, 2)}`;
          shouldAutoCalculate = true;
        } else {
          // 檢查是否已輸入完整的時間格式（HH:mm）
          if (hours !== -1 && minutes !== -1 && parts[0].length === 2 && parts[1].length === 2) {
            finalStartTime = value;
            shouldAutoCalculate = true;
          } else {
            setEditStartTime(value);
            // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
            if (selectedDefaultStoreId && !editStoreId) {
              setEditStoreId(selectedDefaultStoreId);
            }
            return; // 還未輸入完整，不自動計算
          }
        }
      } else {
        // 多個冒號，不允許
        return;
      }
    }
    
    if (finalStartTime) {
      setEditStartTime(finalStartTime);
      // 自動計算結束時間（開始時間 + 9小時）
      if (shouldAutoCalculate) {
        const calculatedEndTime = calculateEndTime(finalStartTime);
        if (calculatedEndTime) {
          setEditEndTime(calculatedEndTime);
        }
      }
      // 如果控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
      if (selectedDefaultStoreId && !editStoreId) {
        setEditStoreId(selectedDefaultStoreId);
      }
    }
  };

  // 失焦時將 4 位數字轉成 HH:mm（後備，確保不需打冒號）
  const normalizeEditStartTimeBlur = () => {
    const v = (editStartTime || '').trim();
    if (/^\d{4}$/.test(v)) {
      const h = parseInt(v.substring(0, 2), 10);
      const m = parseInt(v.substring(2, 4), 10);
      if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
        setEditStartTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        const calculated = calculateEndTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        if (calculated) setEditEndTime(calculated);
      }
    }
  };
  const normalizeEditEndTimeBlur = () => {
    const v = (editEndTime || '').trim();
    if (/^\d{4}$/.test(v)) {
      const h = parseInt(v.substring(0, 2), 10);
      const m = parseInt(v.substring(2, 4), 10);
      if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
        setEditEndTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  };

  // 處理結束時間輸入（支援0-32小時格式，支援4位數字輸入如2330）
  const handleEndTimeChange = (e) => {
    const value = e.target.value;
    // 允許輸入格式：HH:mm 或 H:mm，或4位數字（如2330），小時範圍0-32
    if (value === '') {
      setEditEndTime('');
      return;
    }
    
    // 只允許數字和冒號
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    // 如果輸入的是4位數字（如2330），自動轉換為23:30格式
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      // 驗證範圍
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        setEditEndTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        return;
      }
    }
    
    // 限制長度（最多5個字符：HH:mm）
    if (value.length > 5) {
      return;
    }
    
    // 驗證格式：允許部分輸入，但必須符合 HH:mm 或 H:mm 格式
    const parts = value.split(':');
    
    if (parts.length === 1) {
      // 只有小時部分，或 3 位數字過渡（如 094）以便輸入第 4 位後變成 09:45
      const hours = parseInt(parts[0], 10);
      if (isNaN(hours) || hours < 0 || hours > 32) {
        // 3 位純數字允許暫存，輸入第 4 位即會觸發 4 位轉 HH:mm
        if (value.length === 3 && /^\d{3}$/.test(value)) {
          setEditEndTime(value);
        }
        return;
      }
      setEditEndTime(value);
    } else if (parts.length === 2) {
      // 有小時和分鐘
      const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
      const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
      
      // 驗證小時範圍（0-32）
      if (hours !== -1 && (hours < 0 || hours > 32)) {
        return;
      }
      
      // 驗證分鐘範圍（0-59）或允許部分輸入
      if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
        return;
      }
      
      // 如果分鐘部分超過2位數，截斷
      if (parts[1].length > 2) {
        setEditEndTime(`${parts[0]}:${parts[1].substring(0, 2)}`);
      } else {
        setEditEndTime(value);
      }
    } else {
      // 多個冒號，不允許
      return;
    }
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule) return;
    const scheduleDate = editingSchedule.schedule_date ? toHKDayjs(editingSchedule.schedule_date) : null;
    if (scheduleDate && !canEditDate(scheduleDate)) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.error'),
        text: t('schedule.checkerDateOutOfRange')
      });
      return;
    }

    try {
      // 處理開始時間，支援0-32小時格式；接受 4 位數字（如 0945）自動轉成 09:45
      let startTimeValue = null;
      let startToValidate = (editStartTime || '').trim();
      if (/^\d{4}$/.test(startToValidate)) {
        const h = parseInt(startToValidate.substring(0, 2), 10);
        const m = parseInt(startToValidate.substring(2, 4), 10);
        if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
          startToValidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      if (startToValidate !== '') {
        const timeMatch = startToValidate.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          // 驗證範圍
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            startTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidStartTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidStartTimeFormat')
          });
          return;
        }
      }
      
      // 處理結束時間，支援0-32小時格式；接受 4 位數字自動轉成 HH:mm
      let endTimeValue = null;
      let endToValidate = (editEndTime || '').trim();
      if (/^\d{4}$/.test(endToValidate)) {
        const h = parseInt(endToValidate.substring(0, 2), 10);
        const m = parseInt(endToValidate.substring(2, 4), 10);
        if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
          endToValidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      if (endToValidate !== '') {
        const timeMatch = endToValidate.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          // 驗證範圍
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            endTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidEndTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidEndTimeFormat')
          });
          return;
        }
      }

      const scheduleData = {
        user_id: editingSchedule.user_id,
        department_group_id: selectedGroupId,
        schedule_date: editingSchedule.schedule_date,
        start_time: startTimeValue,
        end_time: endTimeValue,
        leave_type_id: editLeaveTypeId || null,
        leave_session: editLeaveSession || null,
        store_id: editStoreId || null,
        remarks: editRemarks.trim() || null
      };

      let response;
      if (editingSchedule.id) {
        // 更新現有記錄
        response = await axios.put(`/api/schedules/${editingSchedule.id}`, scheduleData);
      } else {
        // 建立新記錄
        response = await axios.post('/api/schedules', scheduleData);
      }

      setEditDialogOpen(false);
      setEditingSchedule(null);
      setEditStartTime('');
      setEditEndTime('');
      setEditLeaveTypeId(null);
      setEditLeaveSession(null);
      setEditStoreId(null);
      setEditRemarks('');

      applySaveResponse(response.data);
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: response.data?.requires_approval ? t('schedule.draftSaved') : t('schedule.updateSuccess')
      });
    } catch (error) {
      console.error('Save schedule error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
    }
  };

  // 格式化結束時間用於顯示（支援26:00格式）
  const formatEndTimeForDisplay = (endTime) => {
    if (!endTime) return '';
    // 如果是字符串格式，直接返回前5個字符（HH:mm）
    if (typeof endTime === 'string') {
      return endTime.length >= 5 ? endTime.substring(0, 5) : endTime;
    }
    // 如果是Date對象或其他格式，轉換為字符串
    return endTime.toString().substring(0, 5);
  };

  const getRosterTotalHoursLabel = (startTime, endTime) => {
    const mins = getRosterDurationMinutes(startTime, endTime);
    if (mins == null) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return t('schedule.rosterTotalHours', { hours: h });
    return t('schedule.rosterTotalHoursMinutes', { hours: h, minutes: m });
  };

  // 取得假期顯示文字（簡化：只顯示假期類型，不區分上下午）
  const getLeaveDisplayText = (schedule) => {
    if (!schedule) return null;
    
    // 如果有假期類型，就顯示假期
    if (schedule.leave_type_name_zh || schedule.leave_type_name) {
      return schedule.leave_type_name_zh || schedule.leave_type_name;
    }
    
    return null;
  };

  // 渲染週曆視圖（手機版）- 每個人一行，日期作為列
  const renderWeekCalendarView = () => {
    return (
      <Box
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0,0,0,0.1)',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0,0,0,0.3)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.5)',
            },
          },
        }}
      >
        <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontWeight: 600,
                      minWidth: 120,
                      maxWidth: 120,
                      boxShadow: '2px 0 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {t('schedule.employee')}
                  </TableCell>
                  {dates.map(date => (
                    <TableCell
                      key={toHKCalendarDate(date)}
                      align="center"
                      sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        fontWeight: 600,
                        minWidth: 80,
                        whiteSpace: 'nowrap',
                        fontSize: '0.85rem',
                      }}
                    >
                      <Badge
                        variant="dot"
                        color="warning"
                        invisible={!dateHasPendingChange(date)}
                        overlap="circular"
                      >
                        <Box>
                          <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                            {formatDateDisplay(date)}
                          </Typography>
                          <Typography variant="caption" display="block" sx={{ opacity: 0.9, mt: 0.5 }}>
                            {date.format('ddd')}
                          </Typography>
                        </Box>
                      </Badge>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            <TableBody>
              {displayedMembers.map((member, rowIndex) => (
                <TableRow key={member.id}>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      bgcolor: 'grey.50',
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      minWidth: 120,
                      maxWidth: 120,
                      boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isApprover ? (
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          component={Link}
                          to={`/monthly-attendance-summary?employee_number=${member.employee_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'primary.main',
                            textDecoration: 'none',
                            '&:hover': {
                              textDecoration: 'underline',
                              color: 'primary.dark',
                            },
                            cursor: 'pointer',
                          }}
                        >
                          {member.employee_number}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{
                            fontSize: '0.75rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {member.employee_number}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.65rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'block',
                        }}
                      >
                        {member.display_name || member.name_zh || member.name}
                      </Typography>
                      {member.position_code || member.position_name || member.position_name_zh ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            display: 'block',
                            fontSize: '0.6rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {member.position_code || (i18n.language === 'en'
                            ? (member.position_name || member.position_name_zh)
                            : (member.position_name_zh || member.position_name))}
                        </Typography>
                      ) : null}
                      {renderTerminationDateBelowPosition(member.termination_date, '0.6rem')}
                    </Box>
                  </TableCell>
                  {dates.map((date, colIndex) => renderMemberDateCell(member, date, rowIndex, colIndex))}
                </TableRow>
              ))}
              {/* 統計行：顯示每日 FT 和 PT 數量 */}
              <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                <TableCell
                  sx={{
                    bgcolor: 'grey.100',
                    borderRight: '2px solid',
                    borderColor: 'divider',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    minWidth: 120,
                    maxWidth: 120,
                    boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                  }}
                >
                  {t('schedule.summary') || '統計'}
                </TableCell>
                {dates.map(date => {
                  const dateStr = toHKCalendarDate(date);
                  // 計算該日期有排班的 FT 和 PT 數量
                  let ftCount = 0;
                  let ptCount = 0;
                  
                  // 統計群組成員（只計算有排班時間的）
                  groupMembers.forEach(member => {
                    const schedule = getScheduleForUserAndDate(member.id, date);
                    // 判斷是否有排班時間：必須有 start_time 或 end_time（不包括只有 leave_type 但沒有時間的）
                    const hasScheduleTime = schedule && (
                      schedule.start_time || 
                      schedule.end_time
                    );
                    
                    if (hasScheduleTime) {
                      const employmentMode = member.position_employment_mode || member.employment_mode;
                      if (employmentMode === 'FT') {
                        ftCount++;
                      } else if (employmentMode === 'PT') {
                        ptCount++;
                      }
                    }
                  });
                  
                  // 統計 helper schedules（只計算有排班時間的）
                  // 後端已經根據選擇的店舖篩選了 helper，直接統計所有返回的 helper
                  helperSchedules.forEach(helper => {
                    const helperDateStr = toHKCalendarDate(helper.schedule_date);
                    
                    if (helperDateStr === dateStr) {
                      // 判斷是否有排班時間：必須有 start_time 或 end_time
                      const hasScheduleTime = helper.start_time || helper.end_time;
                      
                      if (hasScheduleTime) {
                        const employmentMode = helper.position_employment_mode;
                        if (employmentMode === 'FT') {
                          ftCount++;
                        } else if (employmentMode === 'PT') {
                          ptCount++;
                        }
                      }
                    }
                  });
                  
                  return (
                    <TableCell
                      key={dateStr}
                      align="center"
                      sx={{
                        py: 1,
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        bgcolor: 'grey.100',
                        minWidth: 80,
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.7rem' }}>
                          FT: {ftCount}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main', fontSize: '0.7rem' }}>
                          PT: {ptCount}
                        </Typography>
                      </Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      );
    };

  // 處理批量編輯開始時間輸入
  const handleBatchStartTimeChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setBatchStartTime('');
      setBatchEndTime(''); // 清空開始時間時也清空結束時間
      return;
    }
    
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    let finalStartTime = '';
    let shouldAutoCalculate = false;
    
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        finalStartTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        shouldAutoCalculate = true;
      }
    } else if (value.length <= 5) {
      const parts = value.split(':');
      
      if (parts.length === 1) {
        const hours = parseInt(parts[0], 10);
        if (!isNaN(hours) && hours >= 0 && hours <= 32) {
          setBatchStartTime(value);
          // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
          if (selectedDefaultStoreId && !batchStoreId) {
            setBatchStoreId(selectedDefaultStoreId);
          }
          return; // 還未輸入完整，不自動計算
        }
        // 3 位純數字（如 094）允許暫存，輸入第 4 位即會觸發 4 位轉 09:45
        if (value.length === 3 && /^\d{3}$/.test(value)) {
          setBatchStartTime(value);
          if (selectedDefaultStoreId && !batchStoreId) setBatchStoreId(selectedDefaultStoreId);
          return;
        }
      } else if (parts.length === 2) {
        const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
        const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
        
        if (hours !== -1 && (hours < 0 || hours > 32)) {
          return;
        }
        
        if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
          return;
        }
        
        if (parts[1].length > 2) {
          finalStartTime = `${parts[0]}:${parts[1].substring(0, 2)}`;
          shouldAutoCalculate = true;
        } else {
          // 檢查是否已輸入完整的時間格式（HH:mm）
          if (hours !== -1 && minutes !== -1 && parts[0].length === 2 && parts[1].length === 2) {
            finalStartTime = value;
            shouldAutoCalculate = true;
          } else {
            setBatchStartTime(value);
            // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
            if (selectedDefaultStoreId && !batchStoreId) {
              setBatchStoreId(selectedDefaultStoreId);
            }
            return; // 還未輸入完整，不自動計算
          }
        }
      }
    }
    
    if (finalStartTime) {
      setBatchStartTime(finalStartTime);
      // 自動計算結束時間（開始時間 + 9小時）
      if (shouldAutoCalculate) {
        const calculatedEndTime = calculateEndTime(finalStartTime);
        if (calculatedEndTime) {
          setBatchEndTime(calculatedEndTime);
        }
      }
      // 如果控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
      if (selectedDefaultStoreId && !batchStoreId) {
        setBatchStoreId(selectedDefaultStoreId);
      }
    }
  };

  // 批量編輯：失焦時將 4 位數字轉成 HH:mm
  const normalizeBatchStartTimeBlur = () => {
    const v = (batchStartTime || '').trim();
    if (/^\d{4}$/.test(v)) {
      const h = parseInt(v.substring(0, 2), 10);
      const m = parseInt(v.substring(2, 4), 10);
      if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setBatchStartTime(formatted);
        const calculated = calculateEndTime(formatted);
        if (calculated) setBatchEndTime(calculated);
      }
    }
  };
  const normalizeBatchEndTimeBlur = () => {
    const v = (batchEndTime || '').trim();
    if (/^\d{4}$/.test(v)) {
      const h = parseInt(v.substring(0, 2), 10);
      const m = parseInt(v.substring(2, 4), 10);
      if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
        setBatchEndTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  };

  // 處理批量編輯結束時間輸入
  const handleBatchEndTimeChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setBatchEndTime('');
      return;
    }
    
    if (!/^[\d:]*$/.test(value)) {
      return;
    }
    
    if (/^\d{4}$/.test(value)) {
      const hours = parseInt(value.substring(0, 2), 10);
      const minutes = parseInt(value.substring(2, 4), 10);
      
      if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
        setBatchEndTime(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        return;
      }
    }
    
    if (value.length > 5) {
      return;
    }
    
    const parts = value.split(':');
    
    if (parts.length === 1) {
      const hours = parseInt(parts[0], 10);
      if (isNaN(hours) || hours < 0 || hours > 32) {
        // 3 位純數字允許暫存，輸入第 4 位即會觸發 4 位轉 HH:mm
        if (value.length === 3 && /^\d{3}$/.test(value)) {
          setBatchEndTime(value);
        }
        return;
      }
      setBatchEndTime(value);
    } else if (parts.length === 2) {
      const hours = parts[0] === '' ? -1 : parseInt(parts[0], 10);
      const minutes = parts[1] === '' ? -1 : parseInt(parts[1], 10);
      
      if (hours !== -1 && (hours < 0 || hours > 32)) {
        return;
      }
      
      if (minutes !== -1 && (minutes < 0 || minutes > 59)) {
        return;
      }
      
      if (parts[1].length > 2) {
        setBatchEndTime(`${parts[0]}:${parts[1].substring(0, 2)}`);
      } else {
        setBatchEndTime(value);
      }
    } else {
      return;
    }
  };

  const handleBatchSave = async () => {
    const excelCells = selectedCellKeys.map(parseCellKey).filter((cell) => cell.userId && cell.dateStr);
    const useExcelCells = excelCells.length > 0;
    if (!useExcelCells && (selectedUsers.length === 0 || selectedDates.length === 0)) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectCellsFirst')
      });
      return;
    }

    try {
      // 處理開始時間；接受 4 位數字（如 0945）自動轉成 09:45
      let startTimeValue = null;
      let batchStartToValidate = (batchStartTime || '').trim();
      if (/^\d{4}$/.test(batchStartToValidate)) {
        const h = parseInt(batchStartToValidate.substring(0, 2), 10);
        const m = parseInt(batchStartToValidate.substring(2, 4), 10);
        if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
          batchStartToValidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      if (batchStartToValidate !== '') {
        const timeMatch = batchStartToValidate.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            startTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidStartTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidStartTimeFormat')
          });
          return;
        }
      }
      
      // 處理結束時間；接受 4 位數字自動轉成 HH:mm
      let endTimeValue = null;
      let batchEndToValidate = (batchEndTime || '').trim();
      if (/^\d{4}$/.test(batchEndToValidate)) {
        const h = parseInt(batchEndToValidate.substring(0, 2), 10);
        const m = parseInt(batchEndToValidate.substring(2, 4), 10);
        if (h >= 0 && h <= 32 && m >= 0 && m <= 59) {
          batchEndToValidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
      if (batchEndToValidate !== '') {
        const timeMatch = batchEndToValidate.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          
          if (hours >= 0 && hours <= 32 && minutes >= 0 && minutes <= 59) {
            endTimeValue = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else {
            Swal.fire({
              icon: 'error',
              title: t('schedule.error'),
              text: t('schedule.invalidEndTime')
            });
            return;
          }
        } else {
          Swal.fire({
            icon: 'error',
            title: t('schedule.error'),
            text: t('schedule.invalidEndTimeFormat')
          });
          return;
        }
      }

      const schedulesData = [];

      if (useExcelCells) {
        excelCells.forEach((cell) => {
          schedulesData.push({
            user_id: cell.userId,
            department_group_id: selectedGroupId,
            schedule_date: cell.dateStr,
            start_time: startTimeValue,
            end_time: endTimeValue,
            leave_type_id: batchLeaveTypeId !== null && batchLeaveTypeId !== undefined && batchLeaveTypeId !== '' ? Number(batchLeaveTypeId) : null,
            leave_session: batchLeaveSession !== null && batchLeaveSession !== undefined && batchLeaveSession !== '' ? batchLeaveSession : null,
            store_id: batchStoreId !== null && batchStoreId !== undefined && batchStoreId !== '' ? Number(batchStoreId) : null
          });
        });
      } else {
        selectedDates.forEach(date => {
          const dateStr = toHKCalendarDate(date);
          if (!dateStr) return;
          selectedUsers.forEach(userId => {
            schedulesData.push({
              user_id: userId,
              department_group_id: selectedGroupId,
              schedule_date: dateStr,
              start_time: startTimeValue,
              end_time: endTimeValue,
              leave_type_id: batchLeaveTypeId !== null && batchLeaveTypeId !== undefined && batchLeaveTypeId !== '' ? Number(batchLeaveTypeId) : null,
              leave_session: batchLeaveSession !== null && batchLeaveSession !== undefined && batchLeaveSession !== '' ? batchLeaveSession : null,
              store_id: batchStoreId !== null && batchStoreId !== undefined && batchStoreId !== '' ? Number(batchStoreId) : null
            });
          });
        });
      }

      const response = await axios.post('/api/schedules/batch', { schedules: schedulesData });
      
      setBatchEditDialogOpen(false);
      setSelectedUsers([]);
      setSelectedDates([]);
      setBatchStartTime('');
      setBatchEndTime('');
      setBatchLeaveTypeId(null);
      setBatchLeaveSession(null);
      setBatchStoreId(null);
      resetExcelSelection();

      applySaveResponse(response.data);
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: response.data?.requires_approval
          ? t('schedule.draftSaved')
          : t('schedule.batchScheduleUpdateSuccess', { count: schedulesData.length })
      });
    } catch (error) {
      console.error('Batch save error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.batchUpdateFailed')
      });
    }
  };

  // 處理 CSV 文件選擇
  const handleCsvFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        Swal.fire({
          icon: 'error',
          title: t('schedule.error'),
          text: t('schedule.invalidFileType')
        });
        return;
      }
      setCsvFile(file);
    }
  };

  // 處理 CSV 匯入
  // 正確解析 CSV 行，處理包含逗號、引號等特殊字符的欄位
  const parseCSVLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 轉義的引號
          current += '"';
          i++; // 跳過下一個引號
        } else {
          // 切換引號狀態
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // 在引號外的逗號，表示欄位分隔符
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // 添加最後一個欄位
    values.push(current.trim());
    
    return values;
  };

  const handleCsvImport = async () => {
    if (!csvFile) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.error'),
        text: t('schedule.pleaseSelectFile')
      });
      return;
    }

    setImporting(true);
    try {
      // 讀取 CSV 文件
      const text = await csvFile.text();
      // 處理不同類型的換行符（\r\n, \n, \r）
      const lines = text.split(/\r?\n|\r/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error(t('schedule.csvEmptyOrInvalid'));
      }

      // 解析 CSV（假設第一行是標題）
      const headers = parseCSVLine(lines[0]);
      const data = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 9) continue; // 跳過不完整的行（新格式需要至少 9 欄）

        // 跳過第一列（欄A: 數位）
        const dataValues = values.slice(1);
        
        // 根據新的 POS CSV 格式（跳過第一列後）：
        // 欄B=分行代碼, 欄C=運行日期(不參考), 欄D=員工ID, 欄E=員工姓名(不匯入), 欄F=TILL(不參考), 欄G=Clock in/Clock out, 欄H=日期, 欄I=時間
        const row = {
          employee_number: dataValues[2] || '', // 欄D: 員工ID (跳過第一列後索引為2)
          name: null, // 欄E: 員工姓名 (不匯入，設為 null)
          branch_code: dataValues[0] || '', // 欄B: 分行代碼 (跳過第一列後索引為0)
          date: dataValues[6] || '', // 欄H: 日期 (跳過第一列後索引為6)
          clock_time: dataValues[7] || '', // 欄I: 時間 (跳過第一列後索引為7)
          in_out: dataValues[5] || '' // 欄G: Clock in/Clock out (跳過第一列後索引為5)
        };

        if (row.employee_number && row.date && row.clock_time && row.in_out) {
          data.push(row);
        }
      }

      if (data.length === 0) {
        throw new Error(t('schedule.noValidData'));
      }

      // 發送到後端
      const response = await axios.post('/api/attendances/import-csv', { data });

      setCsvImportDialogOpen(false);
      setCsvFile(null);
      
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.csvImportSuccess', { count: response.data.imported_count })
      });

      // 如果有錯誤，顯示警告
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('CSV import errors:', response.data.errors);
      }
    } catch (error) {
      console.error('CSV import error:', error);
      // 先關閉 modal，並保存錯誤訊息待 modal 完全關閉後顯示
      setPendingError(error);
      setCsvImportDialogOpen(false);
      setCsvFile(null);
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteSchedule = async (schedule) => {
    const scheduleDate = schedule?.schedule_date ? toHKDayjs(schedule.schedule_date) : null;
    if (scheduleDate && !canEditDate(scheduleDate)) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.error'),
        text: t('schedule.checkerDateOutOfRange')
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmDelete'),
      text: t('schedule.deleteConfirmMessage'),
      showCancelButton: true,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    });

    if (result.isConfirmed) {
      try {
        let response;
        if (!schedule.id && schedule._changeItemId) {
          response = await axios.delete(`/api/schedules/changes/items/${schedule._changeItemId}`);
          applySaveResponse(response.data);
        } else {
          response = await axios.delete(`/api/schedules/${schedule.id}`);
          applySaveResponse(response.data, {
            user_id: schedule.user_id,
            schedule_date: schedule.schedule_date
          });
        }
        
        Swal.fire({
          icon: 'success',
          title: t('schedule.success'),
          text: response.data?.requires_approval ? t('schedule.draftSaved') : t('schedule.deleteSuccess')
        });
      } catch (error) {
        console.error('Delete schedule error:', error);
        Swal.fire({
          icon: 'error',
          title: t('schedule.error'),
          text: error.response?.data?.message || t('schedule.deleteFailed')
        });
      }
    }
  };

  const handleDeleteSelectedCells = async () => {
    if (!selectedCellKeys.length) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.selectCellsFirst')
      });
      return;
    }

    const targets = selectedCellKeys
      .map(parseCellKey)
      .map((cell) => getDisplaySchedule(cell.userId, cell.dateStr))
      .filter((schedule) => schedule && (schedule.id || schedule._changeItemId));

    if (targets.length === 0) {
      Swal.fire({
        icon: 'info',
        title: t('schedule.warning'),
        text: t('schedule.noScheduleToDelete')
      });
      return;
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmDelete'),
      text: t('schedule.deleteSelectedConfirm', { count: targets.length }),
      showCancelButton: true,
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel')
    });
    if (!result.isConfirmed) return;

    try {
      for (const schedule of targets) {
        if (!schedule.id && schedule._changeItemId) {
          const response = await axios.delete(`/api/schedules/changes/items/${schedule._changeItemId}`);
          applySaveResponse(response.data);
        } else if (schedule.id) {
          const response = await axios.delete(`/api/schedules/${schedule.id}`);
          applySaveResponse(response.data, {
            user_id: schedule.user_id,
            schedule_date: schedule.schedule_date
          });
        }
      }
      resetExcelSelection();
      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.draftSaved')
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.deleteFailed')
      });
    }
  };

  // 更新 checker 編輯權限設置（含可編輯日期範圍 UTC+8）
  const handleToggleCheckerEdit = async (event) => {
    const newValue = event.target.checked;
    if (!selectedGroupId) return;

    try {
      const payload = {
        allow_checker_edit: newValue,
        checker_editable_start_date: checkerEditableStartDate ? toHKCalendarDate(checkerEditableStartDate) : null,
        checker_editable_end_date: checkerEditableEndDate ? toHKCalendarDate(checkerEditableEndDate) : null
      };
      await axios.put(`/api/schedules/group/${selectedGroupId}/checker-edit-permission`, payload);
      
      setAllowCheckerEdit(newValue);
      
      // 更新本地群組數據
      setDepartmentGroups(prevGroups => 
        prevGroups.map(g => 
          g.id === selectedGroupId 
            ? { ...g, allow_checker_edit: newValue }
            : g
        )
      );

      // 重新檢查編輯權限（因為 checker 的權限可能改變）
      await checkEditPermission();

      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: newValue ? t('schedule.checkerEditEnabled') : t('schedule.checkerEditDisabled'),
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Update checker edit permission error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.updateFailed')
      });
      // 恢復原值
      setAllowCheckerEdit(!newValue);
    }
  };

  // 批量更新所有群組的 checker 編輯權限設置
  const handleBatchUpdateCheckerEdit = async (enable) => {
    const confirmText = enable 
      ? t('schedule.confirmEnableAllCheckerEdit')
      : t('schedule.confirmDisableAllCheckerEdit');

    const result = await Swal.fire({
      icon: 'warning',
      title: t('schedule.confirmBatchUpdate'),
      text: confirmText,
      showCancelButton: true,
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const payload = {
        allow_checker_edit: enable,
        checker_editable_start_date: checkerEditableStartDate ? toHKCalendarDate(checkerEditableStartDate) : null,
        checker_editable_end_date: checkerEditableEndDate ? toHKCalendarDate(checkerEditableEndDate) : null
      };
      const response = await axios.put('/api/schedules/groups/batch-checker-edit-permission', payload);

      const startStr = checkerEditableStartDate ? toHKCalendarDate(checkerEditableStartDate) : null;
      const endStr = checkerEditableEndDate ? toHKCalendarDate(checkerEditableEndDate) : null;
      setDepartmentGroups(prevGroups => 
        prevGroups.map(g => ({ ...g, allow_checker_edit: enable, checker_editable_start_date: startStr, checker_editable_end_date: endStr }))
      );

      if (selectedGroupId) {
        setAllowCheckerEdit(enable);
        setCheckerEditableStartDate(checkerEditableStartDate);
        setCheckerEditableEndDate(checkerEditableEndDate);
        await checkEditPermission();
      }

      Swal.fire({
        icon: 'success',
        title: t('schedule.success'),
        text: t('schedule.batchUpdateSuccess', { count: response.data?.updated_count ?? 0 }),
        timer: 3000,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Batch update checker edit permission error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: error.response?.data?.message || t('schedule.batchUpdateFailed')
      });
    }
  };

  const downloadCsvFile = (headers, rows, filename) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCsvTime = (time) => {
    if (!time) return '';
    return typeof time === 'string' ? time.substring(0, 5) : String(time).substring(0, 5);
  };

  const formatCsvHours = (startTime, endTime) => {
    const mins = getRosterDurationMinutes(startTime, endTime);
    if (mins == null) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  const formatOutdoorWorkCsv = (apps) => {
    if (!apps || apps.length === 0) return '';
    return apps.map((app) => {
      const start = formatCsvTime(app.start_time);
      const end = formatCsvTime(app.end_time);
      const label = t('outdoorWorkCalendar.cellLabel');
      if (start || end) return `${label} ${start || '--:--'}-${end || '--:--'}`;
      return label;
    }).join('; ');
  };

  const getMemberPositionLabel = (member) => {
    return member.position_code || (i18n.language === 'en'
      ? (member.position_name || member.position_name_zh)
      : (member.position_name_zh || member.position_name)) || '';
  };

  const getHelperUsersForExport = () => {
    const selectedStore = selectedDefaultStoreId
      ? stores.find((s) => Number(s.id) === Number(selectedDefaultStoreId))
      : null;
    const selectedStoreShortName = selectedStore?.store_short_name_ || null;
    if (!selectedStoreShortName) return [];

    const helperByUser = {};
    helperSchedules.forEach((helper) => {
      if (helper.store_short_name !== selectedStoreShortName) return;
      const userId = helper.user_id;
      if (!helperByUser[userId]) {
        helperByUser[userId] = {
          user_id: userId,
          employee_number: helper.employee_number,
          display_name: helper.user_name || helper.user_name_zh || '',
          position_code: helper.position_code,
          position_name: helper.position_name,
          position_name_zh: helper.position_name_zh,
          position_employment_mode: helper.position_employment_mode,
          employment_mode: helper.employment_mode,
          schedules: {}
        };
      }
      const dateStr = toHKCalendarDate(helper.schedule_date);
      helperByUser[userId].schedules[dateStr] = helper;
    });
    return Object.values(helperByUser);
  };

  const getExportGroupFilenamePrefix = (prefix, ext = 'csv') => {
    const group = departmentGroups.find((g) => g.id === selectedGroupId);
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    const groupLabel = (isChinese ? (group?.name_zh || group?.name) : (group?.name || group?.name_zh)) || selectedGroupId;
    const safeGroup = String(groupLabel).replace(/[\\/:*?"<>|]/g, '_');
    return `${prefix}-${safeGroup}-${dayjs(startDate).format('YYYYMMDD')}-${dayjs(endDate).format('YYYYMMDD')}.${ext}`;
  };

  const ensureExportReady = ({ allowChecker = false } = {}) => {
    if (!(isApprover || (allowChecker && isChecker))) return false;
    if (!selectedGroupId || groupMembers.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.noDataToExport')
      });
      return false;
    }
    return true;
  };

  const buildScheduleCellText = (member, date, schedule, isHelper) => {
    const outdoorApps = getOutdoorWorkForUserAndDate(isHelper ? member.user_id : member.id, date);
    const parts = [];
    if (schedule?.start_time || schedule?.end_time) {
      parts.push(
        `${schedule?.start_time ? formatCsvTime(schedule.start_time) : '--:--'}-${schedule?.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}`
      );
      const hours = formatCsvHours(schedule?.start_time, schedule?.end_time);
      if (hours) parts.push(hours);
    }
    const leaveText = getLeaveTypeDisplayText(schedule);
    if (leaveText) parts.push(leaveText);
    const storeLabel = schedule?.store_short_name || schedule?.store_code;
    if (storeLabel) parts.push(storeLabel);
    const outdoorText = formatOutdoorWorkCsv(outdoorApps);
    if (outdoorText) parts.push(outdoorText);
    if (canViewLeaveTypeDetail() && schedule?.remarks) {
      parts.push(schedule.remarks);
    }
    return parts.join('\n');
  };

  const handleExportCsv = () => {
    if (!ensureExportReady()) return;

    const includeRemarks = canViewLeaveTypeDetail();
    const headers = [
      t('common.employeeNumber'),
      t('schedule.employee'),
      t('schedule.position'),
      'FT/PT',
      t('schedule.scheduleDate'),
      t('schedule.weekday'),
      t('schedule.startTime'),
      t('schedule.endTime'),
      t('schedule.hours'),
      t('schedule.leaveType'),
      t('schedule.store'),
      t('outdoorWorkCalendar.cellLabel'),
      ...(includeRemarks ? [t('schedule.remarks')] : []),
      t('schedule.helper')
    ];

    const buildRow = (member, date, schedule, isHelper) => {
      const outdoorApps = getOutdoorWorkForUserAndDate(isHelper ? member.user_id : member.id, date);
      const row = [
        member.employee_number || '',
        member.display_name || member.name_zh || member.name || '',
        getMemberPositionLabel(member),
        member.position_employment_mode || member.employment_mode || '',
        toHKCalendarDate(date),
        date.format('ddd'),
        schedule?.start_time ? formatCsvTime(schedule.start_time) : '',
        schedule?.end_time ? formatEndTimeForDisplay(schedule.end_time) : '',
        formatCsvHours(schedule?.start_time, schedule?.end_time),
        getLeaveTypeDisplayText(schedule) || '',
        schedule?.store_short_name || schedule?.store_code || '',
        formatOutdoorWorkCsv(outdoorApps)
      ];
      if (includeRemarks) {
        row.push(schedule?.remarks || '');
      }
      row.push(isHelper ? t('schedule.helper') : '');
      return row;
    };

    const rows = [];
    groupMembers.forEach((member) => {
      viewDates.forEach((date) => {
        rows.push(buildRow(member, date, getScheduleForUserAndDate(member.id, date), false));
      });
    });
    getHelperUsersForExport().forEach((helperUser) => {
      viewDates.forEach((date) => {
        const dateStr = toHKCalendarDate(date);
        rows.push(buildRow(helperUser, date, helperUser.schedules[dateStr] || null, true));
      });
    });

    downloadCsvFile(headers, rows, getExportGroupFilenamePrefix('schedule-detail'));
  };

  const handleExportMatrixCsv = () => {
    if (!ensureExportReady()) return;

    const dateHeaders = viewDates.map((date) => formatDateDisplay(date));
    const headers = [
      t('common.employeeNumber'),
      t('schedule.employee'),
      t('schedule.position'),
      'FT/PT',
      t('schedule.helper'),
      ...dateHeaders
    ];

    const buildMatrixRow = (member, isHelper) => {
      const dateCells = viewDates.map((date) => {
        const schedule = isHelper
          ? (member.schedules?.[toHKCalendarDate(date)] || null)
          : getScheduleForUserAndDate(member.id, date);
        return buildScheduleCellText(member, date, schedule, isHelper);
      });
      return [
        member.employee_number || '',
        member.display_name || member.name_zh || member.name || '',
        getMemberPositionLabel(member),
        member.position_employment_mode || member.employment_mode || '',
        isHelper ? t('schedule.helper') : '',
        ...dateCells
      ];
    };

    const rows = [
      ...groupMembers.map((member) => buildMatrixRow(member, false)),
      ...getHelperUsersForExport().map((helperUser) => buildMatrixRow(helperUser, true))
    ];

    downloadCsvFile(headers, rows, getExportGroupFilenamePrefix('schedule-table'));
  };

  const handleExportPdf = async () => {
    if (!ensureExportReady({ allowChecker: true }) || exportingPdf) return;

    const helperUsers = getHelperUsersForExport();
    const exportRows = [
      ...groupMembers.map((member) => ({ member, isHelper: false })),
      ...helperUsers.map((member) => ({ member, isHelper: true }))
    ];
    if (exportRows.length === 0 || viewDates.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: t('schedule.warning'),
        text: t('schedule.noDataToExport')
      });
      return;
    }

    const group = departmentGroups.find((g) => g.id === selectedGroupId);
    const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
    const groupLabel = (isChinese ? (group?.name_zh || group?.name) : (group?.name || group?.name_zh)) || '';
    const rangeLabel = `${dayjs(startDate).format('YYYY-MM-DD')} – ${dayjs(endDate).format('YYYY-MM-DD')}`;

    const pdfLeaveBadge = (text) =>
      `<span style="display:inline-block;background:#c62828;color:#fff;padding:1px 4px;border-radius:3px;font-weight:700;line-height:1.25;">${escapeHtml(text)}</span>`;

    const buildPdfCellHtml = (member, date, schedule, isHelper) => {
      const lines = [];
      const change = schedule?._change;
      if (change && (change.status === 'draft' || change.status === 'returned')) {
        lines.push(pdfLeaveBadge(getChangeStatusLabel(change.status, change.action)));
      }
      if (schedule?._proposedDelete) {
        lines.push(pdfLeaveBadge(t('schedule.proposedDelete')));
      }
      if (schedule?.start_time || schedule?.end_time) {
        lines.push(
          escapeHtml(
            `${schedule?.start_time ? formatCsvTime(schedule.start_time) : '--:--'}-${schedule?.end_time ? formatEndTimeForDisplay(schedule.end_time) : '--:--'}`
          )
        );
        const hours = formatCsvHours(schedule?.start_time, schedule?.end_time);
        if (hours) lines.push(escapeHtml(hours));
      }
      const leaveText = getLeaveTypeDisplayText(schedule);
      if (leaveText) lines.push(pdfLeaveBadge(leaveText));
      const storeLabel = schedule?.store_short_name || schedule?.store_code;
      if (storeLabel) lines.push(escapeHtml(storeLabel));
      const outdoorText = formatOutdoorWorkCsv(
        getOutdoorWorkForUserAndDate(isHelper ? member.user_id : member.id, date)
      );
      if (outdoorText) lines.push(escapeHtml(outdoorText));
      if (canViewLeaveTypeDetail() && schedule?.remarks) {
        lines.push(escapeHtml(schedule.remarks));
      }
      if (lines.length === 0) return '';
      return lines.join('<br>');
    };

    const cellBase = 'border:0.4px solid #9e9e9e;padding:3px;vertical-align:middle;word-break:break-word;font-size:8px;line-height:1.2;';
    const dateColW = 56;
    const empColW = 108;
    const tableWidth = empColW + viewDates.length * dateColW;

    const dateHeaders = viewDates.map((date) => {
      const weekend = date.day() === 0 || date.day() === 6;
      const bg = weekend ? '#1565c0' : '#1976d2';
      return `<th style="${cellBase}width:${dateColW}px;min-width:${dateColW}px;background:${bg};color:#fff;font-weight:700;text-align:center;">${escapeHtml(formatDateDisplay(date))}<br><span style="font-weight:500;opacity:0.9;">${escapeHtml(date.format('ddd'))}</span></th>`;
    }).join('');

    const bodyRows = exportRows.map(({ member, isHelper }) => {
      const name = member.display_name || member.name_zh || member.name || '';
      const position = getMemberPositionLabel(member);
      const helperTag = isHelper
        ? `<div style="color:#666;font-size:7px;">${escapeHtml(t('schedule.helper'))}</div>`
        : '';
      const cells = viewDates.map((date) => {
        const schedule = isHelper
          ? (member.schedules?.[toHKCalendarDate(date)] || null)
          : getDisplaySchedule(member.id, date);
        const weekend = date.day() === 0 || date.day() === 6;
        const isDraft = schedule?._change?.status === 'draft' || schedule?._change?.status === 'returned';
        let bg = '#fff';
        if (isDraft) bg = '#ffebee';
        else if (weekend) bg = '#fff3e0';
        return `<td style="${cellBase}width:${dateColW}px;min-width:${dateColW}px;text-align:center;background:${bg};">${buildPdfCellHtml(member, date, schedule, isHelper)}</td>`;
      }).join('');
      return `<tr>
        <td style="${cellBase}width:${empColW}px;min-width:${empColW}px;max-width:${empColW}px;text-align:left;background:#f5f5f5;color:#222;">
          <div style="font-weight:700;color:#1565c0;">${escapeHtml(member.employee_number || '')}</div>
          <div style="font-weight:600;">${escapeHtml(name)}</div>
          ${position ? `<div style="color:#666;font-size:7px;">${escapeHtml(position)}</div>` : ''}
          ${helperTag}
        </td>
        ${cells}
      </tr>`;
    }).join('');

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:0;top:0;opacity:0.01;pointer-events:none;z-index:-1;background:#fff;';
    holder.innerHTML = `
      <div id="schedule-pdf-root" style="background:#fff;color:#222;width:${tableWidth + 24}px;font-family:'Microsoft JhengHei','PingFang TC','Noto Sans TC','Microsoft YaHei',sans-serif;padding:10px 12px;box-sizing:border-box;">
        <div style="font-size:15px;font-weight:700;margin-bottom:2px;">${escapeHtml(t('schedule.title'))}${groupLabel ? ` · ${escapeHtml(groupLabel)}` : ''}</div>
        <div style="font-size:10px;color:#555;margin-bottom:8px;">${escapeHtml(rangeLabel)}</div>
        <table style="border-collapse:collapse;table-layout:fixed;width:${tableWidth}px;font-size:8px;line-height:1.2;">
          <thead>
            <tr>
              <th style="${cellBase}width:${empColW}px;min-width:${empColW}px;background:#1976d2;color:#fff;font-weight:700;text-align:center;">${escapeHtml(t('schedule.employee'))}</th>
              ${dateHeaders}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    `;

    setExportingPdf(true);
    document.body.appendChild(holder);
    try {
      const root = holder.querySelector('#schedule-pdf-root');
      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        width: tableWidth + 24,
        windowWidth: tableWidth + 24
      });
      const imgData = canvas.toDataURL('image/png');
      const margin = 5;
      const cssPxToMm = 25.4 / 96;
      const cssWidthMm = (canvas.width / 2) * cssPxToMm;

      const fitOn = (pageW, pageH) => {
        const usableW = pageW - margin * 2;
        const usableH = pageH - margin * 2;
        let imgW = usableW;
        let imgH = (canvas.height * imgW) / canvas.width;
        if (imgH > usableH) {
          imgH = usableH;
          imgW = (canvas.width * imgH) / canvas.height;
        }
        return {
          imgW,
          imgH,
          x: margin + (usableW - imgW) / 2,
          y: margin + (usableH - imgH) / 2,
          shrink: imgW / cssWidthMm
        };
      };

      const a4Fit = fitOn(297, 210);
      const useA3 = a4Fit.shrink < 0.72;
      const format = useA3 ? 'a3' : 'a4';
      const fit = useA3 ? fitOn(420, 297) : a4Fit;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
      pdf.addImage(imgData, 'PNG', fit.x, fit.y, fit.imgW, fit.imgH);
      pdf.save(getExportGroupFilenamePrefix('schedule-table', 'pdf'));
    } catch (error) {
      console.error('Export PDF error:', error);
      Swal.fire({
        icon: 'error',
        title: t('schedule.error'),
        text: t('schedule.exportPdfFailed')
      });
    } finally {
      holder.remove();
      setExportingPdf(false);
    }
  };

  const content = (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={noLayout ? { mt: 0, mb: 0 } : { mt: 4, mb: 4 }}>
        <Paper 
          elevation={3}
          sx={{ 
            p: 4,
            borderRadius: 3,
            background: 'linear-gradient(to bottom, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h4" 
              gutterBottom
              sx={{ 
                fontWeight: 600,
                color: 'primary.main',
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <CalendarIcon sx={{ fontSize: 32 }} />
              {t('schedule.title')}
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>

          <Card 
            elevation={2}
            sx={{ 
              mb: 3, 
              p: 3,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            }}
          >
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('schedule.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label={t('schedule.selectGroup')}
                    disabled={editMode}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    {departmentGroups.map(group => {
                      const name = i18n.language === 'zh-TW' || i18n.language === 'zh-CN'
                        ? group.name_zh || group.name
                        : group.name;
                      const pending = Number(group.pending_item_count) || 0;
                      return (
                        <MenuItem key={group.id} value={group.id}>
                          {pending > 0 ? `${name} (${pending})` : name}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker timezone={HK_TZ}
                  label={t('schedule.startDate')}
                  value={startDate}
                  onChange={handleStartDateChange}
                  disabled={editMode}
                  format="DD/MM/YYYY"
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                      }
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <DatePicker timezone={HK_TZ}
                  label={t('schedule.endDate')}
                  value={endDate}
                  onChange={handleEndDateChange}
                  disabled={editMode}
                  format="DD/MM/YYYY"
                  minDate={startDate?.startOf('month')}
                  maxDate={startDate?.endOf('month')}
                  slotProps={{ 
                    textField: { 
                      fullWidth: true,
                      sx: {
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                      }
                    } 
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t('schedule.selectStoreForHelper') || t('schedule.store')}</InputLabel>
                  <Select
                    value={selectedDefaultStoreId || ''}
                    onChange={(e) => setSelectedDefaultStoreId(e.target.value || null)}
                    label={t('schedule.selectStoreForHelper') || t('schedule.store')}
                    disabled={editMode}
                    sx={{
                      bgcolor: 'background.paper',
                      borderRadius: 1,
                    }}
                  >
                    <MenuItem value="">
                      <em>{t('schedule.allStores')}</em>
                    </MenuItem>
                    {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {canEdit && (
                    <Button
                      variant={editMode ? 'contained' : 'outlined'}
                      onClick={() => (editMode ? handleExitEditMode() : handleOpenEditSetup())}
                      startIcon={<EditIcon />}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        boxShadow: editMode ? 3 : 0,
                        '&:hover': {
                          boxShadow: 4,
                          transform: 'translateY(-2px)',
                          transition: 'all 0.2s',
                        },
                      }}
                    >
                      {editMode ? t('schedule.exitEdit') : t('schedule.edit')}
                    </Button>
                  )}
                  {canEdit && editMode && (
                    <>
                      <Button
                        variant="outlined"
                        onClick={handleSelectAllVisibleCells}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        {t('schedule.selectAllCells')}
                      </Button>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={openExcelBatchDialog}
                        disabled={selectedCellKeys.length === 0}
                        startIcon={<SaveIcon />}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          boxShadow: 3,
                        }}
                      >
                        {t('schedule.setSelectedCells')} ({selectedCellKeys.length})
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        onClick={handleDeleteSelectedCells}
                        disabled={selectedCellKeys.length === 0}
                        startIcon={<DeleteIcon />}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        {t('schedule.deleteSelected')}
                      </Button>
                    </>
                  )}
                  {getMyOpenSubmission() && (
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleSubmitMyChanges}
                      startIcon={<SendIcon />}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      {t('schedule.submitChanges')} ({t('schedule.itemCount', { count: (getMyOpenSubmission().items || []).length })})
                    </Button>
                  )}
                  {getMyPendingSubmission() && (
                    <Button
                      variant="outlined"
                      color="warning"
                      onClick={handleWithdrawMyChanges}
                      startIcon={<UndoIcon />}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      {t('schedule.withdrawChanges')} ({t('schedule.itemCount', { count: (getMyPendingSubmission().items || []).length })})
                    </Button>
                  )}
                  {(isApprover || isChecker) && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        gap: 1.5,
                        alignItems: 'center',
                      }}
                    >
                      {isApprover && (
                        <>
                          <Button
                            variant="outlined"
                            onClick={handleExportMatrixCsv}
                            disabled={!selectedGroupId || groupMembers.length === 0 || loading || exportingPdf}
                            startIcon={<FileDownloadIcon />}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              bgcolor: 'background.paper',
                              '&:hover': {
                                boxShadow: 3,
                                transform: 'translateY(-2px)',
                                transition: 'all 0.2s',
                              },
                            }}
                          >
                            {t('schedule.exportCsvTable')}
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={handleExportCsv}
                            disabled={!selectedGroupId || groupMembers.length === 0 || loading || exportingPdf}
                            startIcon={<FileDownloadIcon />}
                            sx={{
                              borderRadius: 2,
                              textTransform: 'none',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              bgcolor: 'background.paper',
                              '&:hover': {
                                boxShadow: 3,
                                transform: 'translateY(-2px)',
                                transition: 'all 0.2s',
                              },
                            }}
                          >
                            {t('schedule.exportCsvDetail')}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        onClick={handleExportPdf}
                        disabled={!selectedGroupId || groupMembers.length === 0 || loading || exportingPdf}
                        startIcon={exportingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          bgcolor: 'background.paper',
                          '&:hover': {
                            boxShadow: 3,
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s',
                          },
                        }}
                      >
                        {t('schedule.exportPdf')}
                      </Button>
                    </Box>
                  )}
                </Box>
              </Grid>
              {/* Checker 排班設定（橫線下，可摺疊，預設收起） */}
              {canControlCheckerEdit && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Box
                      onClick={() => setCheckerSectionExpanded((prev) => !prev)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        py: 0.5,
                        userSelect: 'none',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t('schedule.checkerSettings')}
                      </Typography>
                      <IconButton size="small" aria-label={checkerSectionExpanded ? 'collapse' : 'expand'}>
                        {checkerSectionExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>
                    <Collapse in={checkerSectionExpanded}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, pb: 0.5 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={allowCheckerEdit}
                              onChange={handleToggleCheckerEdit}
                              color="primary"
                              size="small"
                            />
                          }
                          label={
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                              {t('schedule.allowCheckerEdit')}
                            </Typography>
                          }
                          sx={{ ml: 0, mr: 0, alignSelf: 'flex-start' }}
                        />
                        {isHRMember && (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={requireCheckerApproval}
                                onChange={handleToggleCheckerApproval}
                                color="warning"
                                size="small"
                              />
                            }
                            label={
                              <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                {t('schedule.requireCheckerApproval')}
                              </Typography>
                            }
                            sx={{ ml: 0, mr: 0, alignSelf: 'flex-start' }}
                          />
                        )}
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {t('schedule.batchControl')}
                          </Typography>
                          <Button
                            variant="outlined"
                            color="success"
                            size="small"
                            onClick={() => handleBatchUpdateCheckerEdit(true)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                          >
                            {t('schedule.enableAll')}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => handleBatchUpdateCheckerEdit(false)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                          >
                            {t('schedule.disableAll')}
                          </Button>
                          {isHRMember && (
                            <>
                              <Button
                                variant="outlined"
                                color="warning"
                                size="small"
                                onClick={() => handleBatchUpdateCheckerApproval(true)}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                              >
                                {t('schedule.requireCheckerApproval')} · {t('schedule.enableAll')}
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleBatchUpdateCheckerApproval(false)}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                              >
                                {t('schedule.requireCheckerApproval')} · {t('schedule.disableAll')}
                              </Button>
                            </>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 500, ml: 1 }}>
                            {t('schedule.checkerEditableRange')}
                          </Typography>
                          <DatePicker timezone={HK_TZ}
                            label={t('schedule.checkerEditableRangeStart')}
                            value={checkerEditableStartDate}
                            onChange={(newVal) => {
                              if (!newVal || !newVal.isValid()) {
                                setCheckerEditableStartDate(null);
                                const endStr = checkerEditableEndDate ? toHKCalendarDate(checkerEditableEndDate) : null;
                                axios.put('/api/schedules/groups/batch-checker-edit-permission', { checker_editable_start_date: null, checker_editable_end_date: endStr }).then(() => {
                                  setDepartmentGroups(prev => prev.map(g => ({ ...g, checker_editable_start_date: null, checker_editable_end_date: endStr })));
                                }).catch(() => {});
                                return;
                              }
                              const startStr = toHKCalendarDate(newVal);
                              const normalizedStart = dayjs.tz(startStr, 'YYYY-MM-DD', 'Asia/Hong_Kong');
                              setCheckerEditableStartDate(normalizedStart);
                              const endStr = checkerEditableEndDate ? toHKCalendarDate(checkerEditableEndDate) : null;
                              axios.put('/api/schedules/groups/batch-checker-edit-permission', {
                                checker_editable_start_date: startStr,
                                checker_editable_end_date: endStr
                              }).then(() => {
                                setDepartmentGroups(prev => prev.map(g => ({ ...g, checker_editable_start_date: startStr, checker_editable_end_date: endStr })));
                              }).catch(() => {});
                            }}
                            format="DD/MM/YYYY"
                            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, bgcolor: 'background.paper', borderRadius: 1 } } }}
                          />
                          <DatePicker timezone={HK_TZ}
                            label={t('schedule.checkerEditableRangeEnd')}
                            value={checkerEditableEndDate}
                            onChange={(newVal) => {
                              if (!newVal || !newVal.isValid()) {
                                setCheckerEditableEndDate(null);
                                const startStr = checkerEditableStartDate ? toHKCalendarDate(checkerEditableStartDate) : null;
                                axios.put('/api/schedules/groups/batch-checker-edit-permission', { checker_editable_start_date: startStr, checker_editable_end_date: null }).then(() => {
                                  setDepartmentGroups(prev => prev.map(g => ({ ...g, checker_editable_start_date: startStr, checker_editable_end_date: null })));
                                }).catch(() => {});
                                return;
                              }
                              const endStr = toHKCalendarDate(newVal);
                              const normalizedEnd = dayjs.tz(endStr, 'YYYY-MM-DD', 'Asia/Hong_Kong');
                              setCheckerEditableEndDate(normalizedEnd);
                              const startStr = checkerEditableStartDate ? toHKCalendarDate(checkerEditableStartDate) : null;
                              axios.put('/api/schedules/groups/batch-checker-edit-permission', {
                                checker_editable_start_date: startStr,
                                checker_editable_end_date: endStr
                              }).then(() => {
                                setDepartmentGroups(prev => prev.map(g => ({ ...g, checker_editable_start_date: startStr, checker_editable_end_date: endStr })));
                              }).catch(() => {});
                            }}
                            format="DD/MM/YYYY"
                            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, bgcolor: 'background.paper', borderRadius: 1 } } }}
                          />
                        </Box>
                      </Box>
                    </Collapse>
                  </Grid>
                </>
              )}
            </Grid>
          </Card>

          {getMyPendingSubmission() && (
            <Card elevation={1} sx={{ mt: 2, p: 2, bgcolor: '#fff8e1' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {t('schedule.pendingLocked')}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  onClick={handleWithdrawMyChanges}
                  startIcon={<UndoIcon />}
                >
                  {t('schedule.withdrawChanges')}
                </Button>
              </Box>
            </Card>
          )}
          {getMyOpenSubmission()?.status === 'returned' && (
            <Card elevation={1} sx={{ mt: 2, p: 2, bgcolor: '#ffebee' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('schedule.statusReturned')}
                {getMyOpenSubmission().return_reason ? `：${getMyOpenSubmission().return_reason}` : ''}
              </Typography>
            </Card>
          )}
          {isApprover && getPendingSubmissions().length > 0 && (
            <Card elevation={2} sx={{ mt: 2, p: 2 }}>
              <Badge
                badgeContent={getPendingSubmissions().reduce((sum, s) => sum + ((s.items || []).length), 0)}
                color="warning"
                max={999}
                sx={{ mb: 1.5, '& .MuiBadge-badge': { fontWeight: 700 } }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, pr: 1.5 }}>
                  {t('schedule.pendingSubmissions')}
                </Typography>
              </Badge>
              {getPendingSubmissions().map((submission) => (
                <Box
                  key={submission.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    py: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 220 }}>
                    {t('schedule.submittedBy')}: {submission.submitted_by_name || submission.submitted_by_name_zh}
                    {' · '}
                    {t('schedule.itemCount', { count: (submission.items || []).length })}
                    {submission.submitted_at ? ` · ${dayjs(submission.submitted_at).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm')}` : ''}
                  </Typography>
                  {isOwnSubmission(submission) ? (
                    <Typography variant="caption" color="text.secondary">
                      {t('schedule.waitingOtherApprover')}
                    </Typography>
                  ) : (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        onClick={() => handleApproveSubmission(submission.id)}
                      >
                        {t('schedule.approveChanges')}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleReturnSubmission(submission.id)}
                      >
                        {t('schedule.returnChanges')}
                      </Button>
                    </>
                  )}
                </Box>
              ))}
            </Card>
          )}
          {isApprover && getDraftSubmissions().length > 0 && (
            <Card elevation={1} sx={{ mt: 2, p: 2 }}>
              <Badge
                badgeContent={getDraftSubmissions().reduce((sum, s) => sum + ((s.items || []).length), 0)}
                color="default"
                max={999}
                sx={{ mb: 1.5, '& .MuiBadge-badge': { fontWeight: 700 } }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, pr: 1.5 }}>
                  {t('schedule.draftSubmissions')}
                </Typography>
              </Badge>
              {getDraftSubmissions().map((submission) => (
                <Box
                  key={submission.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    py: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 220 }}>
                    {t('schedule.submittedBy')}: {submission.submitted_by_name || submission.submitted_by_name_zh}
                    {' · '}
                    {t('schedule.statusDraft')}
                    {' · '}
                    {t('schedule.itemCount', { count: (submission.items || []).length })}
                    {submission.updated_at ? ` · ${dayjs(submission.updated_at).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm')}` : ''}
                  </Typography>
                </Box>
              ))}
            </Card>
          )}


          {editMode && (
            <Card elevation={1} sx={{ mb: 2, p: 2, bgcolor: '#e3f2fd' }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t('schedule.excelHint')}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                {t('schedule.editingRange')}: {editRangeStart ? formatDateDisplay(editRangeStart) : ''} – {editRangeEnd ? formatDateDisplay(editRangeEnd) : ''}
                {' · '}
                {t('schedule.selectUsers')}: {displayedMembers.length}
              </Typography>
            </Card>
          )}
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary">
                {t('common.loading')}
              </Typography>
            </Box>
          ) : selectedGroupId ? (
            isMobile ? (
              renderWeekCalendarView()
            ) : (
            <>
            <Card elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          py: 2,
                        }}
                      >
                        {t('schedule.employee')}
                      </TableCell>
                      {dates.map(date => (
                        <TableCell 
                          key={toHKCalendarDate(date)} 
                          align="center"
                          sx={{
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            py: 2,
                            minWidth: 100,
                          }}
                        >
                          <Badge
                            variant="dot"
                            color="warning"
                            invisible={!dateHasPendingChange(date)}
                            overlap="circular"
                          >
                            <Box>
                              <Typography variant="body2" display="block" sx={{ fontWeight: 600 }}>
                                {formatDateDisplay(date)}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ opacity: 0.9, mt: 0.5 }}>
                                {date.format('ddd')}
                              </Typography>
                            </Box>
                          </Badge>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                <TableBody>
                  {displayedMembers.map((member, rowIndex) => (
                    <TableRow key={member.id}>
                      <TableCell
                        sx={{
                          bgcolor: 'grey.50',
                          borderRight: '2px solid',
                          borderColor: 'divider',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                        }}
                      >
                        <Box>
                          {isApprover ? (
                            <Typography 
                              variant="body2" 
                              fontWeight="bold" 
                              component={Link}
                              to={`/monthly-attendance-summary?employee_number=${member.employee_number}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{ 
                                color: 'primary.main', 
                                mb: 0.5,
                                textDecoration: 'none',
                                '&:hover': {
                                  textDecoration: 'underline',
                                  color: 'primary.dark',
                                },
                                cursor: 'pointer',
                              }}
                            >
                              {member.employee_number}
                            </Typography>
                          ) : (
                            <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main', mb: 0.5 }}>
                              {member.employee_number}
                            </Typography>
                          )}
                          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                            {member.display_name || member.name_zh || member.name}
                          </Typography>
                          {member.position_code || member.position_name || member.position_name_zh ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', mt: 0.5 }}>
                              {member.position_code || (i18n.language === 'en'
                                ? (member.position_name || member.position_name_zh)
                                : (member.position_name_zh || member.position_name))}
                            </Typography>
                          ) : null}
                          {renderTerminationDateBelowPosition(member.termination_date, '0.75rem')}
                        </Box>
                      </TableCell>
                      {dates.map((date, colIndex) => renderMemberDateCell(member, date, rowIndex, colIndex))}
                    </TableRow>
                  ))}
                  {/* 顯示跨群組的 helper */}
                  {!editMode && (() => {
                    // 獲取選中的 store 的 store_short_name_
                    const selectedStore = selectedDefaultStoreId 
                      ? stores.find(s => Number(s.id) === Number(selectedDefaultStoreId))
                      : null;
                    const selectedStoreShortName = selectedStore?.store_short_name_ || null;
                    
                    // 按用戶分組 helper schedules，只處理 store_short_name 匹配的 helper
                    const helperByUser = {};
                    helperSchedules.forEach(helper => {
                      // 如果選中了 store，只處理 store_short_name 匹配的 helper
                      if (selectedStoreShortName) {
                        if (helper.store_short_name !== selectedStoreShortName) {
                          return; // 跳過不匹配的 helper
                        }
                      } else {
                        // 如果沒有選中 store，不顯示任何 helper
                        return;
                      }
                      
                      const userId = helper.user_id;
                      if (!helperByUser[userId]) {
                        helperByUser[userId] = {
                          user_id: userId,
                          employee_number: helper.employee_number,
                          display_name: helper.user_name || helper.user_name_zh || '',
                          group_name: helper.group_name_zh || helper.group_name || '',
                          position_name: helper.position_name,
                          position_name_zh: helper.position_name_zh,
                          termination_date: helper.user_termination_date || null,
                          schedules: {}
                        };
                      }
                      const dateStr = toHKCalendarDate(helper.schedule_date);
                      helperByUser[userId].schedules[dateStr] = helper;
                    });
                    
                    return Object.values(helperByUser).map(helperUser => (
                      <TableRow key={`helper-${helperUser.user_id}`}>
                        <TableCell
                          sx={{
                            bgcolor: 'grey.50',
                            borderRight: '2px solid',
                            borderColor: 'divider',
                            position: 'sticky',
                            left: 0,
                            zIndex: 1,
                          }}
                        >
                          <Box>
                            {isApprover ? (
                              <Typography 
                                variant="body2" 
                                fontWeight="bold" 
                                component={Link}
                                to={`/monthly-attendance-summary?employee_number=${helperUser.employee_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ 
                                  color: 'primary.main', 
                                  mb: 0.5,
                                  textDecoration: 'none',
                                  '&:hover': {
                                    textDecoration: 'underline',
                                    color: 'primary.dark',
                                  },
                                  cursor: 'pointer',
                                }}
                              >
                                {helperUser.employee_number}
                              </Typography>
                            ) : (
                              <Typography variant="body2" fontWeight="bold" sx={{ color: 'primary.main', mb: 0.5 }}>
                                {helperUser.employee_number}
                              </Typography>
                            )}
                            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                              {helperUser.display_name}
                            </Typography>
                            {helperUser.position_name || helperUser.position_name_zh ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem', mt: 0.5 }}>
                                {i18n.language === 'en'
                                  ? (helperUser.position_name || helperUser.position_name_zh)
                                  : (helperUser.position_name_zh || helperUser.position_name)}
                              </Typography>
                            ) : null}
                            {renderTerminationDateBelowPosition(helperUser.termination_date, '0.75rem')}
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                display: 'inline-block',
                                fontSize: '0.75rem', 
                                mt: 0.5,
                                bgcolor: '#c62828',
                                color: '#ffffff',
                                px: 1,
                                py: 0.5,
                                borderRadius: '20px',
                                fontWeight: 500,
                              }}
                            >
                              {t('schedule.helper') || 'Helper'}
                            </Typography>
                          </Box>
                        </TableCell>
                        {dates.map(date => {
                          const dateStr = toHKCalendarDate(date);
                          const schedule = helperUser.schedules[dateStr];
                          const outdoorApps = getOutdoorWorkForUserAndDate(helperUser.user_id, date);
                          return (
                            <TableCell 
                              key={dateStr} 
                              align="center"
                              sx={{
                                py: 1.5,
                                borderRight: '1px solid',
                                borderColor: 'divider',
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                },
                              }}
                            >
                              {schedule ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'center' }}>
                                  {(schedule.start_time || schedule.end_time) && (
                                    <>
                                      <Typography 
                                        variant="caption" 
                                        display="block" 
                                        sx={{ 
                                          fontSize: '0.7rem', 
                                          mb: 0.5, 
                                          color: '#1565c0',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {schedule.start_time ? schedule.start_time.substring(0, 5) : '--:--'} - {schedule.end_time ? (schedule.end_time.length > 5 ? schedule.end_time.substring(0, 5) : schedule.end_time) : '--:--'}
                                      </Typography>
                                      {renderRosterTotalHoursCaption(schedule.start_time, schedule.end_time, '0.65rem')}
                                    </>
                                  )}
                                  {getLeaveTypeDisplayText(schedule) && (
                                    <Chip
                                      label={getLeaveTypeDisplayText(schedule)}
                                      size="small"
                                      sx={{
                                        fontSize: '0.65rem',
                                        height: '18px',
                                        mb: 0.5,
                                        bgcolor: '#c62828',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        '& .MuiChip-label': { color: '#ffffff', px: 0.75 },
                                      }}
                                    />
                                  )}
                                  {schedule.store_short_name && (
                                    <Chip 
                                      label={schedule.store_short_name}
                                      size="small" 
                                      sx={{ 
                                        fontSize: '0.65rem', 
                                        height: '20px', 
                                        mb: 0.5,
                                        fontWeight: 600,
                                        boxShadow: 1,
                                        bgcolor: '#424242',
                                        color: '#ffffff',
                                      }}
                                    />
                                  )}
                                  <OutdoorWorkCalendarChip
                                    applications={outdoorApps}
                                    sx={{ fontSize: '0.65rem', height: '20px' }}
                                  />
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                                  <OutdoorWorkCalendarChip
                                    applications={outdoorApps}
                                    sx={{ fontSize: '0.65rem', height: '20px' }}
                                  />
                                  {outdoorApps.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      ---
                                    </Typography>
                                  )}
                                </Box>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ));
                  })()}
                  {/* 統計行：顯示每日 FT 和 PT 數量 */}
                  <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 'bold' }}>
                    <TableCell
                      sx={{
                        bgcolor: 'grey.100',
                        borderRight: '2px solid',
                        borderColor: 'divider',
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        fontWeight: 600,
                        fontSize: '0.9rem',
                      }}
                    >
                      {t('schedule.summary') || '統計'}
                    </TableCell>
                    {dates.map(date => {
                      const dateStr = toHKCalendarDate(date);
                      // 計算該日期有排班的 FT 和 PT 數量
                      let ftCount = 0;
                      let ptCount = 0;
                      
                      // 統計群組成員（只計算有排班時間的）
                      groupMembers.forEach(member => {
                        const schedule = getScheduleForUserAndDate(member.id, date);
                        // 判斷是否有排班時間：必須有 start_time 或 end_time（不包括只有 leave_type 但沒有時間的）
                        const hasScheduleTime = schedule && (
                          schedule.start_time || 
                          schedule.end_time
                        );
                        
                        if (hasScheduleTime) {
                          const employmentMode = member.position_employment_mode || member.employment_mode;
                          if (employmentMode === 'FT') {
                            ftCount++;
                          } else if (employmentMode === 'PT') {
                            ptCount++;
                          }
                        }
                      });
                      
                      // 統計 helper schedules（只計算有排班時間的）
                      // 後端已經根據選擇的店舖篩選了 helper，直接統計所有返回的 helper
                      helperSchedules.forEach(helper => {
                        const helperDateStr = toHKCalendarDate(helper.schedule_date);
                        
                        if (helperDateStr === dateStr) {
                          // 判斷是否有排班時間：必須有 start_time 或 end_time
                          const hasScheduleTime = helper.start_time || helper.end_time;
                          
                          if (hasScheduleTime) {
                            const employmentMode = helper.position_employment_mode;
                            if (employmentMode === 'FT') {
                              ftCount++;
                            } else if (employmentMode === 'PT') {
                              ptCount++;
                            }
                          }
                        }
                      });
                      
                      return (
                        <TableCell
                          key={dateStr}
                          align="center"
                          sx={{
                            py: 1.5,
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            bgcolor: 'grey.100',
                          }}
                        >
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              FT: {ftCount}
                            </Typography>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: 'secondary.main' }}>
                              PT: {ptCount}
                            </Typography>
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
              </TableContainer>
            </Card>
            </>
            )
          ) : (
            <Card 
              elevation={2}
              sx={{ 
                textAlign: 'center', 
                py: 6,
                borderRadius: 2,
                bgcolor: 'grey.50',
              }}
            >
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                {t('schedule.selectGroupFirst')}
              </Typography>
            </Card>
          )}
        </Paper>

        {/* 編輯排班對話框 */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => {
            setEditDialogOpen(false);
            setEditingSchedule(null);
            setEditStartTime('');
            setEditEndTime('');
            setEditLeaveTypeId(null);
            setEditLeaveSession(null);
            setEditStoreId(null);
            setEditRemarks('');
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: 6,
            }
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 600,
              py: 2.5,
            }}
          >
            {editingSchedule?.id ? t('schedule.editSchedule') : t('schedule.createSchedule')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            {/* 被編班員工資訊：員工編號、顯示名稱、排班日期 */}
            {editingSchedule && (() => {
              const member = groupMembers.find(m => Number(m.id) === Number(editingSchedule.user_id));
              // 若為幫舖員工則從 helperSchedules 取得
              const helperSchedule = !member && editingSchedule.schedule_date
                ? helperSchedules.find(s => {
                    const sDate = toHKCalendarDate(s.schedule_date);
                    return Number(s.user_id) === Number(editingSchedule.user_id) && sDate === editingSchedule.schedule_date;
                  })
                : null;
              const employeeNumber = member?.employee_number ?? helperSchedule?.employee_number ?? '—';
              const displayName = member ? (member.display_name || member.name_zh || member.name) : (helperSchedule ? (helperSchedule.user_name || helperSchedule.user_name_zh || '') : '—');
              const scheduleDateDisplay = editingSchedule.schedule_date
                ? formatDateDisplay(editingSchedule.schedule_date)
                : '';
              return (
                <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {t('schedule.scheduledEmployee')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {employeeNumber} · {displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {t('schedule.scheduleDate')}: {scheduleDateDisplay || '—'}
                  </Typography>
                </Box>
              );
            })()}
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.startTime')}
                    value={editStartTime}
                    onChange={handleStartTimeChange}
                    onBlur={normalizeEditStartTimeBlur}
                    placeholder="0945 或 09:45"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*', maxLength: 8 }}
                    fullWidth
                    helperText={t('schedule.startTimeHelper')}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.endTime')}
                    value={editEndTime}
                    onChange={handleEndTimeChange}
                    onBlur={normalizeEditEndTimeBlur}
                    placeholder="1845 或 18:45"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*', maxLength: 8 }}
                    fullWidth
                    helperText={t('schedule.endTimeHelper')}
                  />
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* 假期類別 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.leaveType')}</InputLabel>
                    <Select
                      value={editLeaveTypeId || ''}
                      onChange={(e) => {
                        const newLeaveTypeId = e.target.value || null;
                        setEditLeaveTypeId(newLeaveTypeId);
                        // 如果清空假期類型，也清空時段
                        if (!newLeaveTypeId) {
                          setEditLeaveSession(null);
                        } else {
                          // 如果選擇了假期類型，且控制面板已選擇店舖，且編輯排班中的店舖為空，則自動設置為控制面板選擇的店舖
                          if (selectedDefaultStoreId && !editStoreId) {
                            setEditStoreId(selectedDefaultStoreId);
                          }
                        }
                      }}
                      label={t('schedule.leaveType')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectLeaveType')}</em>
                      </MenuItem>
                      {leaveTypes.map(lt => (
                        <MenuItem key={lt.id} value={lt.id}>
                          {i18n.language === 'en' ? lt.name : (lt.name_zh || lt.name)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {editLeaveTypeId && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>{t('schedule.leavePeriod')}</InputLabel>
                      <Select
                        value={editLeaveSession || ''}
                        onChange={(e) => setEditLeaveSession(e.target.value || null)}
                        label={t('schedule.leavePeriod')}
                      >
                        <MenuItem value="">
                          <em>{t('schedule.fullDayLeave')}</em>
                        </MenuItem>
                        <MenuItem value="AM">{t('schedule.morningLeave')}</MenuItem>
                        <MenuItem value="PM">{t('schedule.afternoonLeave')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {/* 店舖選取 - 移到最底部 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.store')}</InputLabel>
                    <Select
                      value={editStoreId || ''}
                      onChange={(e) => setEditStoreId(e.target.value || null)}
                      label={t('schedule.store')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectStore')}</em>
                      </MenuItem>
                      {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {canEdit && (
                  <Grid item xs={12}>
                    <TextField
                      label={t('schedule.remarks')}
                      value={editRemarks}
                      onChange={(e) => setEditRemarks(e.target.value)}
                      fullWidth
                      multiline
                      minRows={2}
                      maxRows={4}
                      placeholder={t('schedule.remarksPlaceholder')}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setEditDialogOpen(false);
                setEditingSchedule(null);
                setEditStartTime('');
                setEditEndTime('');
                setEditLeaveTypeId(null);
                setEditLeaveSession(null);
                setEditStoreId(null);
                setEditRemarks('');
              }}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSaveSchedule} 
              variant="contained" 
              color="primary"
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 5,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        {/* 進入編輯前：選擇同事與最多一個月 */}
        <Dialog
          open={editSetupOpen}
          onClose={() => setEditSetupOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{t('schedule.editSetupTitle')}</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('schedule.editSetupHint', { days: MAX_EDIT_DAYS })}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <DatePicker timezone={HK_TZ}
                  label={t('schedule.startDate')}
                  value={setupStartDate}
                  onChange={(newValue) => {
                    if (!newValue || !newValue.isValid()) return;
                    const { start, end } = clampSetupRange(newValue, setupEndDate || newValue);
                    setSetupStartDate(start);
                    setSetupEndDate(end);
                  }}
                  minDate={startDate}
                  maxDate={endDate}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={6}>
                <DatePicker timezone={HK_TZ}
                  label={t('schedule.endDate')}
                  value={setupEndDate}
                  onChange={(newValue) => {
                    if (!newValue || !newValue.isValid()) return;
                    const { start, end } = clampSetupRange(setupStartDate || newValue, newValue);
                    setSetupStartDate(start);
                    setSetupEndDate(end);
                  }}
                  minDate={setupStartDate || startDate}
                  maxDate={
                    setupStartDate && endDate
                      ? (setupStartDate.add(MAX_EDIT_DAYS - 1, 'day').isAfter(endDate, 'day')
                        ? endDate
                        : setupStartDate.add(MAX_EDIT_DAYS - 1, 'day'))
                      : endDate
                  }
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {t('schedule.selectUsers')}
                  </Typography>
                  <Box>
                    <Button size="small" onClick={() => setSetupMemberIds(groupMembers.map((m) => m.id))}>
                      {t('schedule.selectAll')}
                    </Button>
                    <Button size="small" onClick={() => setSetupMemberIds([])}>
                      {t('schedule.clearSelection')}
                    </Button>
                  </Box>
                </Box>
                <Box sx={{ maxHeight: 240, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                  {groupMembers.map((member) => (
                    <Box key={member.id} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Checkbox
                        checked={setupMemberIds.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSetupMemberIds([...setupMemberIds, member.id]);
                          } else {
                            setSetupMemberIds(setupMemberIds.filter((id) => id !== member.id));
                          }
                        }}
                      />
                      <Typography variant="body2">
                        {member.employee_number} - {member.display_name || member.name_zh || member.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditSetupOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={handleConfirmEditSetup}>{t('schedule.enterEdit')}</Button>
          </DialogActions>
        </Dialog>

        {/* 批量編輯對話框 */}
        <Dialog 
          open={batchEditDialogOpen} 
          onClose={() => {
            setBatchEditDialogOpen(false);
            setSelectedUsers([]);
            setSelectedDates([]);
            setBatchStartTime('');
            setBatchEndTime('');
            setBatchLeaveTypeId(null);
            setBatchLeaveSession(null);
            setBatchStoreId(null);
          }}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: 6,
            }
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 600,
              py: 2.5,
            }}
          >
            {selectedCellKeys.length > 0 ? t('schedule.setSelectedCells') : t('schedule.batchEdit')}
          </DialogTitle>
          <DialogContent sx={{ p: 3, mt: 2 }}>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {selectedCellKeys.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {t('schedule.applyToSelectedCells', { count: selectedCellKeys.length })}
                  </Typography>
                </Grid>
              )}
              {selectedCellKeys.length === 0 && (
              <>
              {/* Desktop：選擇員工與選擇日期並排；Mobile：上下堆疊 */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                  {t('schedule.selectUsers')}
                </Typography>
                <Box sx={{ 
                  maxHeight: 200, 
                  overflow: 'auto', 
                  border: 2, 
                  borderColor: 'primary.light', 
                  borderRadius: 2, 
                  p: 2,
                  bgcolor: 'grey.50',
                  boxShadow: 1,
                }}>
                  {groupMembers.map(member => (
                    <Box key={member.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Checkbox
                        checked={selectedUsers.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, member.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== member.id));
                          }
                        }}
                      />
                      <Typography variant="body2">
                        {member.employee_number} - {member.display_name || member.name_zh || member.name}
                        {member.position_code || member.position_name || member.position_name_zh ? (
                          <span style={{ color: '#666', fontSize: '0.85em' }}>
                            {' '}({member.position_code || (i18n.language === 'en'
                              ? (member.position_name || member.position_name_zh)
                              : (member.position_name_zh || member.position_name))})
                          </span>
                        ) : null}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', mb: 2 }}>
                  {t('schedule.selectDates')}
                </Typography>
                <Box sx={{ 
                  maxHeight: 200, 
                  overflow: 'auto', 
                  border: 2, 
                  borderColor: 'primary.light', 
                  borderRadius: 2, 
                  p: 2,
                  bgcolor: 'grey.50',
                  boxShadow: 1,
                }}>
                  {dates.map(date => (
                    <Box key={toHKCalendarDate(date)} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Checkbox
                        checked={selectedDates.some(d => {
                          if (!d || !date) return false;
                          try {
                            const dDate = dayjs(d);
                            const checkDate = dayjs(date);
                            if (!dDate.isValid() || !checkDate.isValid()) return false;
                            return dDate.tz('Asia/Hong_Kong').startOf('day').isSame(checkDate.tz('Asia/Hong_Kong').startOf('day'), 'day');
                          } catch (error) {
                            return false;
                          }
                        })}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDates([...selectedDates, date]);
                          } else {
                            setSelectedDates(selectedDates.filter(d => {
                              if (!d || !date) return true;
                              try {
                                const dDate = dayjs(d);
                                const checkDate = dayjs(date);
                                if (!dDate.isValid() || !checkDate.isValid()) return true;
                                return !dDate.tz('Asia/Hong_Kong').startOf('day').isSame(checkDate.tz('Asia/Hong_Kong').startOf('day'), 'day');
                              } catch (error) {
                                return true;
                              }
                            }));
                          }
                        }}
                      />
                      <Typography variant="body2">
                        {formatDateDisplay(date)} ({date.format('ddd')})
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
              </>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom sx={{ mt: 1, fontWeight: 600, color: 'primary.main', mb: 2 }}>
                  {t('schedule.timeAndLeave')}
                </Typography>
                <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.startTime')}
                    value={batchStartTime}
                    onChange={handleBatchStartTimeChange}
                    onBlur={normalizeBatchStartTimeBlur}
                    placeholder="0945 或 09:45"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*', maxLength: 8 }}
                    fullWidth
                    helperText={t('schedule.startTimeHelper')}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t('schedule.endTime')}
                    value={batchEndTime}
                    onChange={handleBatchEndTimeChange}
                    onBlur={normalizeBatchEndTimeBlur}
                    placeholder="1845 或 18:45"
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9:]*', maxLength: 8 }}
                    fullWidth
                    helperText={t('schedule.endTimeHelper')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.leaveType')}</InputLabel>
                    <Select
                      value={batchLeaveTypeId || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || value === null || value === undefined) {
                          setBatchLeaveTypeId(null);
                          setBatchLeaveSession(null);
                        } else {
                          setBatchLeaveTypeId(Number(value));
                          // 如果選擇了假期類型，且控制面板已選擇店舖，且批量編輯中的店舖為空，則自動設置為控制面板選擇的店舖
                          if (selectedDefaultStoreId && !batchStoreId) {
                            setBatchStoreId(selectedDefaultStoreId);
                          }
                        }
                      }}
                      label={t('schedule.leaveType')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectLeaveType')}</em>
                      </MenuItem>
                      {leaveTypes.map(lt => (
                        <MenuItem key={lt.id} value={lt.id}>
                          {i18n.language === 'en' ? lt.name : (lt.name_zh || lt.name)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {batchLeaveTypeId && (
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>{t('schedule.leavePeriod')}</InputLabel>
                      <Select
                        value={batchLeaveSession || ''}
                        onChange={(e) => setBatchLeaveSession(e.target.value || null)}
                        label={t('schedule.leavePeriod')}
                      >
                        <MenuItem value="">
                          <em>{t('schedule.fullDayLeave')}</em>
                        </MenuItem>
                        <MenuItem value="AM">{t('schedule.morningLeave')}</MenuItem>
                        <MenuItem value="PM">{t('schedule.afternoonLeave')}</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {/* 店舖選取 */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('schedule.store')}</InputLabel>
                    <Select
                      value={batchStoreId || ''}
                      onChange={(e) => setBatchStoreId(e.target.value || null)}
                      label={t('schedule.store')}
                    >
                      <MenuItem value="">
                        <em>{t('schedule.selectStore')}</em>
                      </MenuItem>
                      {[...stores].sort((a, b) => (a.store_short_name_ || '').localeCompare(b.store_short_name_ || '')).map(store => (
                        <MenuItem key={store.id} value={store.id}>
                          {store.store_short_name_ || store.store_code} {store.store_short_name_ ? `(${store.store_code})` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                </Grid>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={() => {
                setBatchEditDialogOpen(false);
                setSelectedUsers([]);
                setSelectedDates([]);
                setBatchStartTime('');
                setBatchEndTime('');
                setBatchLeaveTypeId(null);
                setBatchLeaveSession(null);
                setBatchStoreId(null);
              }}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleBatchSave} 
              variant="contained" 
              color="primary"
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 5,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s',
                },
              }}
            >
              {t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={historyDialogOpen}
          onClose={() => {
            setHistoryDialogOpen(false);
            setHistoryLogs([]);
            setHistoryTarget(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>{t('schedule.changeHistory')}</DialogTitle>
          <DialogContent>
            {historyTarget && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('schedule.scheduleDate')}: {historyTarget.dateStr}
              </Typography>
            )}
            {historyLoading ? (
              <Typography variant="body2">{t('common.loading')}</Typography>
            ) : historyLogs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('schedule.noChangeHistory')}</Typography>
            ) : (
              historyLogs.map((log) => (
                <Box key={log.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {getChangeActionLabel(log.action)} · {log.actor_name || log.actor_name_zh}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {log.created_at ? dayjs(log.created_at).tz('Asia/Hong_Kong').format('YYYY-MM-DD HH:mm') : ''}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {t('schedule.beforeValue')}: {formatHistoryPayload(log.before_payload)}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {t('schedule.afterValue')}: {formatHistoryPayload(log.after_payload)}
                  </Typography>
                  {log.note && (
                    <Typography variant="caption" display="block" color="error.main">
                      {t('schedule.returnReason')}: {log.note}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHistoryDialogOpen(false)}>{t('common.confirm')}</Button>
          </DialogActions>
        </Dialog>

      </Container>
    </LocalizationProvider>
  );

  return content;
};

export default Schedule;
