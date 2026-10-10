import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Container,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Hong_Kong');

const ROLE_PALETTE = [
  { bg: '#E3F2FD', fg: '#1565C0' },
  { bg: '#E8F5E9', fg: '#2E7D32' },
  { bg: '#FFF3E0', fg: '#EF6C00' },
  { bg: '#F3E5F5', fg: '#7B1FA2' },
  { bg: '#E0F7FA', fg: '#00838F' },
  { bg: '#FCE4EC', fg: '#C2185B' },
  { bg: '#FFF8E1', fg: '#F9A825' },
  { bg: '#E8EAF6', fg: '#3949AB' }
];
const roleKey = (id) => (id == null || id === '' ? '' : String(id));
const roleStyle = (id) => ROLE_PALETTE[Number(id) % ROLE_PALETTE.length];
const slotKey = (scheduleId, columnId) => `${scheduleId}:${columnId}`;

const formatMinute = (minute) => {
  const hour = Math.floor(Number(minute) / 60);
  const mins = Number(minute) % 60;
  const label = String(hour % 24).padStart(2, '0');
  const nextDay = hour >= 24 ? '+' : '';
  return mins ? `${label}:${String(mins).padStart(2, '0')}${nextDay}` : `${label}${nextDay}`;
};

const groupSlots = (minutes, step) => {
  const sorted = [...new Set((minutes || []).map(Number))].sort((a, b) => a - b);
  const size = Number(step) === 15 ? 15 : Number(step) === 30 ? 30 : 60;
  if (size === 15) {
    return sorted.map((start) => ({ id: start, minutes: [start], label: formatMinute(start) }));
  }
  const groups = new Map();
  sorted.forEach((start) => {
    const bucket = Math.floor(start / size) * size;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(start);
  });
  return [...groups.entries()].map(([hourStart, slots]) => ({
    id: hourStart,
    minutes: slots,
    label: formatMinute(hourStart)
  }));
};

const slotLoanId = (slots, minute) => {
  const saved = slots?.[minute] || slots?.[String(minute)];
  return saved?.loan_store_id ? String(saved.loan_store_id) : '';
};

function DutyRoleTooltip({ roles, extra, children }) {
  const list = (Array.isArray(roles) ? roles : [roles]).filter(Boolean);
  if (!extra && !list.length) return children;
  return (
    <Tooltip
      arrow
      enterDelay={250}
      enterNextDelay={250}
      componentsProps={{ tooltip: { sx: { maxWidth: 280 } } }}
      title={(
        <Box sx={{ py: 0.25 }}>
          {extra ? (
            <Typography variant="caption" sx={{ display: 'block', mb: list.length ? 0.5 : 0, color: 'inherit' }}>
              {extra}
            </Typography>
          ) : null}
          {list.map((role, index) => {
            const nameZh = role.name_zh || '';
            const nameEn = role.name || '';
            return (
              <Box key={role.id || index} sx={index ? { mt: 0.75, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.28)' } : undefined}>
                {nameZh ? (
                  <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35, color: 'inherit' }}>{nameZh}</Typography>
                ) : null}
                {nameEn && nameEn !== nameZh ? (
                  <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.35, color: 'inherit' }}>{nameEn}</Typography>
                ) : null}
                {role.description ? (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25, whiteSpace: 'pre-wrap', lineHeight: 1.35, color: 'inherit' }}>
                    {role.description}
                  </Typography>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}
    >
      {children}
    </Tooltip>
  );
}

function LoanArrow({ direction, label }) {
  if (!direction) return null;
  const outgoing = direction === 'out';
  const Icon = outgoing ? NorthIcon : SouthIcon;
  const color = outgoing ? '#d32f2f' : '#2e7d32';
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 1,
        right: 2,
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        maxWidth: 'calc(100% - 4px)',
        pointerEvents: 'none',
        lineHeight: 1
      }}
    >
      <Icon sx={{ fontSize: 11, color, flexShrink: 0 }} />
      {label ? (
        <Box
          component="span"
          sx={{
            fontSize: '0.58rem',
            fontWeight: 700,
            color,
            letterSpacing: '-0.02em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </Box>
      ) : null}
    </Box>
  );
}

const mondayOf = (date) => {
  const day = date.day();
  return date.subtract(day === 0 ? 6 : day - 1, 'day').startOf('day');
};

export function DutySlotTicks({ shiftSlots, slots, step = 60, incoming = false }) {
  const columns = groupSlots(shiftSlots, step);
  if (!columns.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center', mt: 0.25, maxWidth: 96 }}>
      {columns.map((column) => {
        const roleIds = [];
        (column.minutes || []).forEach((minute) => {
          const roleId = slots?.[minute]?.id || slots?.[String(minute)]?.id;
          if (roleId && !roleIds.includes(roleId)) roleIds.push(roleId);
        });
        const loaned = (column.minutes || []).some((minute) => slotLoanId(slots, minute));
        const style = roleIds.length === 1 ? roleStyle(roleIds[0]) : null;
        return (
          <Box
            key={column.id}
            sx={{
              position: 'relative',
              width: Number(step) === 60 ? 8 : 6,
              height: 8,
              borderRadius: '2px',
              bgcolor: style ? style.bg : '#eeeeee',
              boxShadow: style ? `inset 0 0 0 1px ${style.fg}55` : 'none',
              background: roleIds.length > 1
                ? `linear-gradient(90deg, ${roleStyle(roleIds[0]).bg} 50%, ${roleStyle(roleIds[1]).bg} 50%)`
                : undefined
            }}
          >
            {loaned && (
              <Box sx={{ position: 'absolute', top: -3, right: -3, width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: incoming ? '5px solid #2e7d32' : 'none', borderTop: incoming ? 'none' : '5px solid #d32f2f' }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

const DailyShiftDuties = ({
  embedded = false,
  groupId = '',
  storeId = '',
  anchorDate = null,
  fixedView = '',
  onSaved,
  onDirtyChange
}) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(groupId || '');
  const [selectedStoreId, setSelectedStoreId] = useState(storeId || '');
  const [slotStep, setSlotStep] = useState(60);
  const [scheduleDate, setScheduleDate] = useState(() => {
    if (anchorDate) {
      const parsed = dayjs(anchorDate).tz('Asia/Hong_Kong');
      if (parsed.isValid()) return parsed.startOf('day');
    }
    return dayjs().tz('Asia/Hong_Kong').startOf('day');
  });
  const [viewMode, setViewMode] = useState(fixedView || 'day');
  const onDirtyChangeRef = useRef(onDirtyChange);
  const onSavedRef = useRef(onSaved);
  onDirtyChangeRef.current = onDirtyChange;
  onSavedRef.current = onSaved;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [draftSlots, setDraftSlots] = useState({});
  const [savedSlots, setSavedSlots] = useState({});
  const [draftLoans, setDraftLoans] = useState({});
  const [savedLoans, setSavedLoans] = useState({});
  const [lendStoreId, setLendStoreId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState({});
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [loadedRange, setLoadedRange] = useState(null);

  const isChinese = i18n.language === 'zh-TW' || i18n.language === 'zh-CN';
  const translatedWeekdays = t('dailyShiftDuties.weekdays', { returnObjects: true });
  const weekdays = Array.isArray(translatedWeekdays)
    ? translatedWeekdays
    : ['一', '二', '三', '四', '五', '六', '日'];
  const todayStr = dayjs().tz('Asia/Hong_Kong').format('YYYY-MM-DD');
  const anchor = scheduleDate.tz('Asia/Hong_Kong').startOf('day');
  const anchorStr = anchor.format('YYYY-MM-DD');

  const range = useMemo(() => {
    if (viewMode === 'week') {
      const start = mondayOf(anchor);
      return { start, end: start.add(6, 'day') };
    }
    if (viewMode === 'month') {
      const first = anchor.startOf('month');
      const last = anchor.endOf('month').startOf('day');
      return { start: mondayOf(first), end: mondayOf(last).add(6, 'day'), month: anchor.format('YYYY-MM') };
    }
    return { start: anchor, end: anchor, month: anchor.format('YYYY-MM') };
  }, [anchorStr, viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const startStr = range.start.format('YYYY-MM-DD');
  const endStr = range.end.format('YYYY-MM-DD');

  const gridDates = useMemo(() => {
    const list = [];
    let cursor = range.start;
    while (cursor.isBefore(range.end) || cursor.isSame(range.end, 'day')) {
      list.push(cursor);
      cursor = cursor.add(1, 'day');
    }
    return list;
  }, [startStr, endStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const roleLabel = (role) => {
    if (!role) return '';
    const name = isChinese ? (role.name_zh || role.name) : (role.name || role.name_zh);
    return role.code ? `${role.code} · ${name}` : name;
  };

  const roleMeta = (roleId, row, hour) => {
    if (!roleId) return null;
    const listed = roles.find((item) => String(item.id) === String(roleId));
    if (listed) return listed;
    const saved = row?.slots?.[hour];
    if (saved && String(saved.id) === String(roleId)) return saved;
    return null;
  };

  const roleMark = (roleId, row, hour) => {
    const role = roleMeta(roleId, row, hour);
    if (!role) return '';
    if (role.code) return String(role.code).slice(0, 3);
    const name = isChinese ? (role.name_zh || role.name) : (role.name || role.name_zh);
    return String(name || '').slice(0, 1);
  };

  const personName = (row) => row.user_name || row.employee_number || '';

  const positionText = (row) => (
    isChinese
      ? (row.position_name_zh || row.position_name || '')
      : (row.position_name || row.position_name_zh || '')
  );

  const personLabel = (row) => {
    const position = positionText(row);
    const name = personName(row);
    return position ? `${name} (${position})` : name;
  };

  const leaveLabel = (row) => {
    const name = isChinese
      ? (row.leave_type_name_zh || row.leave_type_name || row.leave_type_code)
      : (row.leave_type_code || row.leave_type_name || row.leave_type_name_zh);
    if (!name) return '';
    if (row.leave_session === 'AM') return `${name} (${t('dailyShiftDuties.morning')})`;
    if (row.leave_session === 'PM') return `${name} (${t('dailyShiftDuties.afternoon')})`;
    return name;
  };

  const periodLabel = viewMode === 'day'
    ? anchor.format(isChinese ? 'YYYY年M月D日' : 'D MMM YYYY')
    : viewMode === 'week'
      ? `${range.start.format('D/M')} – ${range.end.format('D/M/YYYY')}`
      : anchor.format(isChinese ? 'YYYY年M月' : 'MMMM YYYY');

  useEffect(() => {
    if (!embedded) return;
    if (groupId) setSelectedGroupId(groupId);
    setSelectedStoreId(storeId || '');
  }, [embedded, groupId, storeId]);

  useEffect(() => {
    if (!user || !embedded) return undefined;
    let cancelled = false;
    axios.get('/api/stores')
      .then((response) => {
        if (!cancelled) setStores(response.data.stores || []);
      })
      .catch((error) => console.error('Load duty stores error:', error));
    return () => {
      cancelled = true;
    };
  }, [user, embedded]);

  useEffect(() => {
    if (!embedded || !anchorDate) return;
    const parsed = dayjs(anchorDate).tz('Asia/Hong_Kong');
    if (parsed.isValid()) setScheduleDate(parsed.startOf('day'));
    if (fixedView) setViewMode(fixedView);
  }, [embedded, anchorDate, fixedView]);

  useEffect(() => {
    if (!user || embedded) return;
    const loadFilters = async () => {
      try {
        const [groupRes, storeRes] = await Promise.all([
          axios.get('/api/schedules/accessible-groups'),
          axios.get('/api/stores')
        ]);
        const groups = groupRes.data.groups || [];
        const userDelegationGroupIds = (user.delegation_groups || []).map((g) => Number(g.id));
        const filtered = user.is_system_admin
          ? groups
          : groups.filter((group) => {
            const ids = [group.checker_id, group.approver_1_id, group.approver_2_id, group.approver_3_id, group.supervisor_id];
            return ids.some((id) => id && userDelegationGroupIds.includes(Number(id)));
          });
        if (!user.is_system_admin && filtered.length === 0) {
          navigate('/shift-management');
          return;
        }
        setDepartmentGroups(filtered);
        setStores(storeRes.data.stores || []);
        if (filtered.length === 1) setSelectedGroupId(filtered[0].id);
      } catch (error) {
        console.error('Load daily duty filters error:', error);
      }
    };
    loadFilters();
  }, [user, navigate]);

  const applyBoard = (data) => {
    const rows = data.staff || [];
    const next = {};
    const loans = {};
    rows.forEach((row) => {
      const slots = {};
      const rowLoans = {};
      (row.shift_slots || []).forEach((minute) => {
        slots[minute] = roleKey(row.slots?.[minute]?.id);
        rowLoans[minute] = slotLoanId(row.slots, minute);
      });
      next[row.schedule_id] = slots;
      loans[row.schedule_id] = rowLoans;
    });
    setStaff(rows);
    setRoles(data.roles || []);
    setCanEdit(!!data.can_edit);
    setDraftSlots(next);
    setSavedSlots(next);
    setDraftLoans(loans);
    setSavedLoans(loans);
    setSelectedKeys({});
    setSelectionAnchor(null);
    setLoadedRange({
      start: data.start_date || startStr,
      end: data.end_date || endStr,
      storeId: selectedStoreId || ''
    });
  };

  const fetchBoard = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    try {
      const params = {
        department_group_id: selectedGroupId,
        start_date: startStr,
        end_date: endStr
      };
      if (selectedStoreId) params.store_id = selectedStoreId;
      const response = await axios.get('/api/schedules/daily-duties', { params });
      applyBoard(response.data);
    } catch (error) {
      console.error('Fetch daily duties error:', error);
      setStaff([]);
      setRoles([]);
      setDraftSlots({});
      setSavedSlots({});
      setDraftLoans({});
      setSavedLoans({});
      setSelectedKeys({});
      setSelectionAnchor(null);
      Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('dailyShiftDuties.fetchFailed')
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      fetchBoard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, selectedStoreId, startStr, endStr]);

  const dirty = useMemo(() => (
    staff.some((row) => (row.shift_slots || []).some((minute) => (
      (draftSlots[row.schedule_id]?.[minute] || '') !== (savedSlots[row.schedule_id]?.[minute] || '')
      || (draftLoans[row.schedule_id]?.[minute] || '') !== (savedLoans[row.schedule_id]?.[minute] || '')
    )))
  ), [staff, draftSlots, savedSlots, draftLoans, savedLoans]);

  useEffect(() => {
    if (embedded) onDirtyChangeRef.current?.(dirty);
  }, [embedded, dirty]);

  const staffByDate = useMemo(() => {
    const map = {};
    staff.forEach((row) => {
      if (!map[row.schedule_date]) map[row.schedule_date] = [];
      map[row.schedule_date].push(row);
    });
    return map;
  }, [staff]);

  const focusStaff = useMemo(() => {
    if (viewMode === 'month') {
      return staff.filter((row) => String(row.schedule_date).startsWith(anchor.format('YYYY-MM')));
    }
    if (viewMode === 'day') return staffByDate[anchorStr] || [];
    return staff;
  }, [staff, staffByDate, viewMode, anchorStr, anchor]);

  const borrowedCount = focusStaff.filter((row) => row.is_borrowed).length;
  const assignedCount = focusStaff.reduce((total, row) => (
    total + (row.shift_slots || []).filter((minute) => draftSlots[row.schedule_id]?.[minute]).length
  ), 0);

  const guarded = async (action) => {
    if (!dirty) {
      action();
      return;
    }
    const result = await Swal.fire({
      icon: 'warning',
      title: t('dailyShiftDuties.unsavedTitle'),
      text: t('dailyShiftDuties.unsavedText'),
      showCancelButton: true,
      confirmButtonText: t('dailyShiftDuties.discard'),
      cancelButtonText: t('common.cancel')
    });
    if (result.isConfirmed) action();
  };

  const shiftPeriod = (direction) => {
    guarded(() => {
      if (viewMode === 'month') setScheduleDate(anchor.add(direction, 'month'));
      else if (viewMode === 'week') setScheduleDate(anchor.add(direction * 7, 'day'));
      else setScheduleDate(anchor.add(direction, 'day'));
    });
  };

  const handleSave = async () => {
    if (!loadedRange) return;
    setSaving(true);
    try {
      const response = await axios.put('/api/schedules/daily-duties', {
        department_group_id: selectedGroupId,
        store_id: loadedRange.storeId || undefined,
        start_date: loadedRange.start,
        end_date: loadedRange.end,
        assignments: staff.map((row) => ({
          schedule_id: row.schedule_id,
          slots: Object.fromEntries((row.shift_slots || []).map((minute) => [
            minute,
            {
              duty_role_id: draftSlots[row.schedule_id]?.[minute] ? Number(draftSlots[row.schedule_id][minute]) : null,
              loan_store_id: draftLoans[row.schedule_id]?.[minute] ? Number(draftLoans[row.schedule_id][minute]) : null
            }
          ]))
        }))
      });
      applyBoard(response.data);
      onSavedRef.current?.();
      Swal.fire({
        icon: 'success',
        title: t('dailyShiftDuties.saved'),
        timer: 1400,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: t('common.error'),
        text: error.response?.data?.message || t('dailyShiftDuties.saveFailed')
      });
    } finally {
      setSaving(false);
    }
  };

  const dayRows = useMemo(() => staffByDate[anchorStr] || [], [staffByDate, anchorStr]);
  const dayColumns = useMemo(() => {
    const minutes = [];
    dayRows.forEach((row) => (row.shift_slots || []).forEach((minute) => minutes.push(minute)));
    return groupSlots(minutes, slotStep);
  }, [dayRows, slotStep]);

  const selectedCount = Object.keys(selectedKeys).length;

  const workedMinutes = (row, column) => {
    const worked = new Set((row.shift_slots || []).map(Number));
    return (column?.minutes || []).filter((minute) => worked.has(Number(minute)));
  };

  const selectSlot = (row, column, event) => {
    if (!row.can_edit || saving) return;
    if (!workedMinutes(row, column).length) return;
    const key = slotKey(row.schedule_id, column.id);
    if (event.ctrlKey || event.metaKey) {
      setSelectedKeys((prev) => {
        const next = { ...prev };
        if (next[key]) delete next[key];
        else next[key] = true;
        return next;
      });
      setSelectionAnchor({ scheduleId: row.schedule_id, columnId: Number(column.id) });
      return;
    }
    if (event.shiftKey && selectionAnchor) {
      const rowStart = dayRows.findIndex((item) => item.schedule_id === selectionAnchor.scheduleId);
      const rowEnd = dayRows.findIndex((item) => item.schedule_id === row.schedule_id);
      const colStart = dayColumns.findIndex((item) => item.id === selectionAnchor.columnId);
      const colEnd = dayColumns.findIndex((item) => item.id === column.id);
      if (rowStart < 0 || rowEnd < 0 || colStart < 0 || colEnd < 0) return;
      const next = {};
      const fromRow = Math.min(rowStart, rowEnd);
      const toRow = Math.max(rowStart, rowEnd);
      const fromCol = Math.min(colStart, colEnd);
      const toCol = Math.max(colStart, colEnd);
      for (let rowIndex = fromRow; rowIndex <= toRow; rowIndex += 1) {
        const person = dayRows[rowIndex];
        if (!person.can_edit) continue;
        for (let colIndex = fromCol; colIndex <= toCol; colIndex += 1) {
          const target = dayColumns[colIndex];
          if (workedMinutes(person, target).length) next[slotKey(person.schedule_id, target.id)] = true;
        }
      }
      setSelectedKeys(next);
      return;
    }
    setSelectedKeys({ [key]: true });
    setSelectionAnchor({ scheduleId: row.schedule_id, columnId: Number(column.id) });
  };

  const paintSelection = (roleId) => {
    if (!selectedCount || saving) return;
    setDraftSlots((prev) => {
      const next = { ...prev };
      Object.keys(selectedKeys).forEach((key) => {
        const splitAt = key.indexOf(':');
        const scheduleId = key.slice(0, splitAt);
        const columnId = Number(key.slice(splitAt + 1));
        const row = dayRows.find((item) => String(item.schedule_id) === scheduleId);
        const column = dayColumns.find((item) => item.id === columnId);
        if (!row || !column) return;
        const slots = { ...(next[scheduleId] || {}) };
        workedMinutes(row, column).forEach((minute) => {
          const loaned = !!draftLoans[row.schedule_id]?.[minute];
          if (row.is_borrowed) {
            if (loaned) slots[minute] = roleId;
            return;
          }
          if (!loaned) slots[minute] = roleId;
        });
        next[scheduleId] = slots;
      });
      return next;
    });
  };

  const paintLoan = (storeValue) => {
    if (!selectedCount || saving) return;
    if (!storeValue) {
      Swal.fire({ icon: 'warning', title: t('dailyShiftDuties.lendStoreRequired') });
      return;
    }
    const storeKey = String(storeValue);
    setDraftLoans((prev) => {
      const next = { ...prev };
      Object.keys(selectedKeys).forEach((key) => {
        const splitAt = key.indexOf(':');
        const scheduleId = key.slice(0, splitAt);
        const columnId = Number(key.slice(splitAt + 1));
        const row = dayRows.find((item) => String(item.schedule_id) === scheduleId);
        const column = dayColumns.find((item) => item.id === columnId);
        if (!row || row.is_borrowed || !column) return;
        const loans = { ...(next[scheduleId] || {}) };
        workedMinutes(row, column).forEach((minute) => {
          loans[minute] = storeKey;
        });
        next[scheduleId] = loans;
      });
      return next;
    });
    setDraftSlots((prev) => {
      const next = { ...prev };
      Object.keys(selectedKeys).forEach((key) => {
        const splitAt = key.indexOf(':');
        const scheduleId = key.slice(0, splitAt);
        const columnId = Number(key.slice(splitAt + 1));
        const row = dayRows.find((item) => String(item.schedule_id) === scheduleId);
        const column = dayColumns.find((item) => item.id === columnId);
        if (!row || row.is_borrowed || !column) return;
        const slots = { ...(next[scheduleId] || {}) };
        workedMinutes(row, column).forEach((minute) => {
          slots[minute] = '';
        });
        next[scheduleId] = slots;
      });
      return next;
    });
  };

  const clearLoan = () => {
    if (!selectedCount || saving) return;
    setDraftLoans((prev) => {
      const next = { ...prev };
      Object.keys(selectedKeys).forEach((key) => {
        const splitAt = key.indexOf(':');
        const scheduleId = key.slice(0, splitAt);
        const columnId = Number(key.slice(splitAt + 1));
        const row = dayRows.find((item) => String(item.schedule_id) === scheduleId);
        const column = dayColumns.find((item) => item.id === columnId);
        if (!row || row.is_borrowed || !column) return;
        const loans = { ...(next[scheduleId] || {}) };
        workedMinutes(row, column).forEach((minute) => {
          loans[minute] = '';
        });
        next[scheduleId] = loans;
      });
      return next;
    });
    setDraftSlots((prev) => {
      const next = { ...prev };
      Object.keys(selectedKeys).forEach((key) => {
        const splitAt = key.indexOf(':');
        const scheduleId = key.slice(0, splitAt);
        const columnId = Number(key.slice(splitAt + 1));
        const row = dayRows.find((item) => String(item.schedule_id) === scheduleId);
        const column = dayColumns.find((item) => item.id === columnId);
        if (!row || row.is_borrowed || !column) return;
        const slots = { ...(next[scheduleId] || {}) };
        workedMinutes(row, column).forEach((minute) => {
          slots[minute] = '';
        });
        next[scheduleId] = slots;
      });
      return next;
    });
  };

  const columnRoleIds = (row, minutes) => {
    const ids = [];
    minutes.forEach((minute) => {
      const roleId = draftSlots[row.schedule_id]?.[minute];
      if (roleId && !ids.includes(roleId)) ids.push(roleId);
    });
    return ids;
  };

  const renderHourTicks = (row) => (
    <Box sx={{ display: 'flex', gap: '2px', flexWrap: 'wrap', mt: 0.25 }}>
      {groupSlots(row.shift_slots, slotStep).map((column) => {
        const minutes = workedMinutes(row, column);
        const roleIds = columnRoleIds(row, minutes);
        const loaned = minutes.some((minute) => draftLoans[row.schedule_id]?.[minute]);
        const style = roleIds.length === 1 ? roleStyle(roleIds[0]) : null;
        return (
          <Box
            key={column.id}
            title={`${column.label} ${roleIds.map((id) => roleMark(id, row, minutes[0])).filter(Boolean).join(' / ') || t('dailyShiftDuties.unassigned')}`}
            sx={{
              position: 'relative',
              width: slotStep === 60 ? 8 : 6,
              height: 8,
              borderRadius: '2px',
              bgcolor: style ? style.bg : '#eeeeee',
              boxShadow: style ? `inset 0 0 0 1px ${style.fg}33` : 'none'
            }}
          >
            {loaned && (
              <Box sx={{ position: 'absolute', top: -3, right: -3, width: 0, height: 0, borderLeft: '3px solid transparent', borderRight: '3px solid transparent', borderBottom: row.is_borrowed ? '5px solid #2e7d32' : 'none', borderTop: row.is_borrowed ? 'none' : '5px solid #d32f2f' }} />
            )}
          </Box>
        );
      })}
    </Box>
  );

  const renderDayTable = (rows) => {
    if (!rows.length) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">{t('dailyShiftDuties.noStaff')}</Typography>
        </Box>
      );
    }
    return (
      <Box>
        {canEdit && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('dailyShiftDuties.slotHint')}
              {selectedCount > 0 ? ` · ${t('dailyShiftDuties.selectedSlots', { count: selectedCount })}` : ''}
            </Typography>
            {roles.map((role) => (
              <DutyRoleTooltip key={role.id} roles={role}>
                <span>
                  <Button
                    size="small"
                    disabled={!selectedCount || saving}
                    onClick={() => paintSelection(String(role.id))}
                    sx={{
                      minWidth: 0,
                      px: 1,
                      py: 0.25,
                      color: roleStyle(role.id).fg,
                      bgcolor: roleStyle(role.id).bg,
                      border: `1px solid ${roleStyle(role.id).fg}33`,
                      '&:hover': { bgcolor: roleStyle(role.id).bg, filter: 'brightness(0.97)' }
                    }}
                  >
                    {roleMark(role.id) || roleLabel(role)}
                  </Button>
                </span>
              </DutyRoleTooltip>
            ))}
            <Button size="small" variant="outlined" disabled={!selectedCount || saving} onClick={() => paintSelection('')}>
              {t('dailyShiftDuties.clearSlots')}
            </Button>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>{t('dailyShiftDuties.lendTo')}</InputLabel>
              <Select
                value={lendStoreId}
                label={t('dailyShiftDuties.lendTo')}
                onChange={(event) => setLendStoreId(event.target.value)}
              >
                {stores.map((store) => (
                  <MenuItem key={store.id} value={String(store.id)}>
                    {store.store_short_name_ || store.store_code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" color="error" disabled={!selectedCount || saving} onClick={() => paintLoan(lendStoreId)} startIcon={<NorthIcon sx={{ fontSize: 14 }} />}>
              {t('dailyShiftDuties.lendOut')}
            </Button>
            <Button size="small" variant="text" disabled={!selectedCount || saving} onClick={clearLoan}>
              {t('dailyShiftDuties.cancelLend')}
            </Button>
          </Box>
        )}
        <Box sx={{ overflowX: 'auto', userSelect: 'none' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: `210px repeat(${dayColumns.length}, ${slotStep === 15 ? 64 : slotStep === 30 ? 56 : 52}px)`, columnGap: 0.5, rowGap: 0.75, alignItems: 'center', width: 'max-content' }}>
            <Box />
            {dayColumns.map((column) => (
              <Typography key={column.id} variant="caption" align="center" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {column.label}
              </Typography>
            ))}
            {rows.map((row) => (
              <Box key={row.schedule_id} sx={{ display: 'contents' }}>
                <Box sx={{ pr: 1 }}>
                  <Typography variant="body2" noWrap title={personLabel(row)} sx={{ fontWeight: 700, lineHeight: 1.2 }}>{personLabel(row)}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {row.start_time || '--:--'}–{row.end_time || '--:--'}
                      {row.is_borrowed ? ` · ${t('dailyShiftDuties.borrowed')}` : ''}
                      {(row.store_short_name || row.store_code) ? ` · ${row.store_short_name || row.store_code}` : ''}
                      {leaveLabel(row) ? ` · ${leaveLabel(row)}` : ''}
                  </Typography>
                </Box>
                {dayColumns.map((column) => {
                  const minutes = workedMinutes(row, column);
                  if (!minutes.length) return <Box key={column.id} />;
                  const roleIds = columnRoleIds(row, minutes);
                  const selected = !!selectedKeys[slotKey(row.schedule_id, column.id)];
                  const style = roleIds.length === 1 ? roleStyle(roleIds[0]) : null;
                  const minuteFor = (roleId) => minutes.find((minute) => String(draftSlots[row.schedule_id]?.[minute]) === String(roleId));
                  const mark = roleIds.length === 1 ? roleMark(roleIds[0], row, minuteFor(roleIds[0])) : '';
                  const slotRoles = roleIds.map((id) => roleMeta(id, row, minuteFor(id))).filter(Boolean);
                  const rangeEnd = minutes[minutes.length - 1] + 15;
                  const loaned = minutes.some((minute) => draftLoans[row.schedule_id]?.[minute]);
                  const loanNames = [];
                  minutes.forEach((minute) => {
                    const loanId = draftLoans[row.schedule_id]?.[minute];
                    if (!loanId) return;
                    const loanStore = stores.find((store) => String(store.id) === String(loanId));
                    const name = loanStore ? (loanStore.store_short_name_ || loanStore.store_code) : '';
                    if (name && !loanNames.includes(name)) loanNames.push(name);
                  });
                  const loanName = loanNames.join('/');
                  const slotExtra = `${formatMinute(minutes[0])}–${formatMinute(rangeEnd)}${slotRoles.length ? '' : ` ${t('dailyShiftDuties.unassigned')}`}${loaned ? ` · ${row.is_borrowed ? t('dailyShiftDuties.borrowIn') : t('dailyShiftDuties.lendOut')}${loanName ? ` ${loanName}` : ''}` : ''}`;
                  return (
                    <Box key={column.id} sx={{ minWidth: 0 }}>
                    <DutyRoleTooltip roles={slotRoles} extra={slotExtra}>
                    <Box
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSlot(row, column, event);
                      }}
                      sx={{
                        position: 'relative',
                        height: 34,
                        borderRadius: 0.75,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        pb: '2px',
                        fontSize: slotStep === 15 ? '0.62rem' : '0.68rem',
                        fontWeight: 700,
                        cursor: row.can_edit ? 'pointer' : 'default',
                        color: style ? style.fg : 'text.secondary',
                        bgcolor: style ? style.bg : (roleIds.length > 1 ? undefined : '#f7f7f8'),
                        background: roleIds.length > 1
                          ? `linear-gradient(90deg, ${roleStyle(roleIds[0]).bg} 50%, ${roleStyle(roleIds[1]).bg} 50%)`
                          : undefined,
                        outline: selected ? '2px solid #5c6bc0' : '1px solid #e6e6e6',
                        outlineOffset: selected ? -2 : 0,
                        width: '100%'
                      }}
                    >
                      {mark}
                      <LoanArrow direction={loaned ? (row.is_borrowed ? 'in' : 'out') : null} label={loanName} />
                    </Box>
                    </DutyRoleTooltip>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderWeek = () => (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 1, minWidth: 900 }}>
        {gridDates.map((date) => {
          const dateStr = date.format('YYYY-MM-DD');
          const rows = staffByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          return (
            <Paper
              key={dateStr}
              variant="outlined"
              sx={{
                p: 1,
                minHeight: 180,
                borderColor: isToday ? 'primary.main' : 'divider',
                borderWidth: isToday ? 2 : 1,
                bgcolor: isToday ? '#e3f2fd' : 'background.paper'
              }}
            >
              <Typography
                variant="subtitle2"
                onClick={() => guarded(() => {
                  setViewMode('day');
                  setScheduleDate(date);
                })}
                sx={{ fontWeight: 700, mb: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
              >
                {weekdays[date.day() === 0 ? 6 : date.day() - 1]} {date.format('D/M')}
              </Typography>
              {rows.length === 0 ? (
                <Typography variant="caption" color="text.secondary">{t('dailyShiftDuties.noStaff')}</Typography>
              ) : rows.map((row) => (
                <Box key={row.schedule_id} sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                    {personLabel(row)}{row.is_borrowed ? ` · ${t('dailyShiftDuties.borrowed')}` : ''}{(row.store_short_name || row.store_code) ? ` · ${row.store_short_name || row.store_code}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                    {row.start_time || '--:--'}–{row.end_time || '--:--'}
                  </Typography>
                  {renderHourTicks(row)}
                </Box>
              ))}
            </Paper>
          );
        })}
      </Box>
    </Box>
  );

  const renderMonth = () => {
    const weeks = [];
    for (let i = 0; i < gridDates.length; i += 7) weeks.push(gridDates.slice(i, i + 7));
    return (
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: 840 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
            {weekdays.map((label) => (
              <Typography key={label} variant="caption" align="center" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                {label}
              </Typography>
            ))}
          </Box>
          {weeks.map((week) => (
            <Box key={week[0].format('YYYY-MM-DD')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((date) => {
                const dateStr = date.format('YYYY-MM-DD');
                const rows = staffByDate[dateStr] || [];
                const inMonth = date.format('YYYY-MM') === anchor.format('YYYY-MM');
                const isToday = dateStr === todayStr;
                const visible = rows.slice(0, 3);
                return (
                  <Box
                    key={dateStr}
                    onClick={() => guarded(() => {
                      setViewMode('day');
                      setScheduleDate(date);
                    })}
                    sx={{
                      minHeight: 118,
                      p: 0.75,
                      border: '1px solid',
                      borderColor: isToday ? 'primary.main' : 'divider',
                      bgcolor: isToday ? '#e3f2fd' : 'background.paper',
                      opacity: inMonth ? 1 : 0.45,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: isToday ? 'primary.main' : 'text.primary' }}>
                      {date.format('D')}
                      {rows.length > 0 ? ` · ${rows.length}` : ''}
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {visible.map((row) => (
                        <Box key={row.schedule_id} sx={{ mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.15 }}>
                            {personLabel(row)}{row.is_borrowed ? ' · ' : ''}{row.is_borrowed ? t('dailyShiftDuties.borrowed') : ''}
                          </Typography>
                          {renderHourTicks(row)}
                        </Box>
                      ))}
                      {rows.length > visible.length && (
                        <Typography variant="caption" color="text.secondary">
                          {t('dailyShiftDuties.morePeople', { count: rows.length - visible.length })}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const ready = Boolean(selectedGroupId);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Container maxWidth="xl" sx={{ mt: embedded ? 0 : 4, mb: embedded ? 0 : 4, px: embedded ? 0 : undefined }}>
        <Paper elevation={embedded ? 0 : 3} sx={{ p: embedded ? 1 : { xs: 2, sm: 4 }, borderRadius: embedded ? 0 : 3 }}>
          {!embedded && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <BadgeIcon />
              {t('dailyShiftDuties.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('dailyShiftDuties.subtitle')}
            </Typography>
            <Divider sx={{ mt: 2 }} />
          </Box>
          )}

          {!embedded && (
          <Card elevation={0} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('dailyShiftDuties.selectGroup')}</InputLabel>
                  <Select
                    value={selectedGroupId}
                    label={t('dailyShiftDuties.selectGroup')}
                    onChange={(e) => guarded(() => setSelectedGroupId(e.target.value))}
                  >
                    {departmentGroups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {isChinese ? (group.name_zh || group.name) : (group.name || group.name_zh)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('dailyShiftDuties.helperStore')}</InputLabel>
                  <Select
                    value={selectedStoreId}
                    label={t('dailyShiftDuties.helperStore')}
                    onChange={(e) => guarded(() => setSelectedStoreId(e.target.value))}
                  >
                    <MenuItem value="">{t('dailyShiftDuties.noHelperStore')}</MenuItem>
                    {stores.map((store) => (
                      <MenuItem key={store.id} value={store.id}>
                        {store.store_code}{store.store_short_name_ ? ` · ${store.store_short_name_}` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <DatePicker
                  label={t('dailyShiftDuties.date')}
                  value={scheduleDate}
                  onChange={(value) => {
                    if (value?.isValid()) guarded(() => setScheduleDate(value.startOf('day')));
                  }}
                  format="DD/MM/YYYY"
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </Card>
          )}

          {!ready ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary">{t('dailyShiftDuties.selectFirst')}</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {!fixedView && (
                    <>
                      <IconButton onClick={() => shiftPeriod(-1)} aria-label="previous">
                        <ChevronLeftIcon />
                      </IconButton>
                      <Button variant="outlined" onClick={() => guarded(() => setScheduleDate(dayjs().tz('Asia/Hong_Kong').startOf('day')))}>
                        {t('dailyShiftDuties.today')}
                      </Button>
                      <IconButton onClick={() => shiftPeriod(1)} aria-label="next">
                        <ChevronRightIcon />
                      </IconButton>
                    </>
                  )}
                  <Typography variant="h6" sx={{ fontWeight: 700, ml: fixedView ? 0 : 1 }}>{periodLabel}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={slotStep}
                    onChange={(_, value) => {
                      if (!value) return;
                      setSlotStep(value);
                      setSelectedKeys({});
                      setSelectionAnchor(null);
                    }}
                  >
                    <ToggleButton value={60}>{t('dailyShiftDuties.everyHour')}</ToggleButton>
                    <ToggleButton value={30}>{t('dailyShiftDuties.everyHalfHour')}</ToggleButton>
                    <ToggleButton value={15}>{t('dailyShiftDuties.everyQuarterHour')}</ToggleButton>
                  </ToggleButtonGroup>
                  {!fixedView && (
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={viewMode}
                    onChange={(_, value) => {
                      if (value) guarded(() => setViewMode(value));
                    }}
                  >
                    <ToggleButton value="day">{t('dailyShiftDuties.viewDay')}</ToggleButton>
                    <ToggleButton value="week">{t('dailyShiftDuties.viewWeek')}</ToggleButton>
                    <ToggleButton value="month">{t('dailyShiftDuties.viewMonth')}</ToggleButton>
                  </ToggleButtonGroup>
                  )}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
                <Chip label={t('dailyShiftDuties.scheduledCount', { count: focusStaff.length })} />
                <Chip color="error" variant="outlined" label={t('dailyShiftDuties.borrowedCount', { count: borrowedCount })} />
                <Chip color="primary" variant="outlined" label={t('dailyShiftDuties.assignedHours', { count: assignedCount })} />
                {!canEdit && <Chip label={t('dailyShiftDuties.readOnly')} />}
              </Box>

              {roles.length === 0 && (
                <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                  {t('dailyShiftDuties.noRoles')}
                </Typography>
              )}

              {loading ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography color="text.secondary">{t('common.loading')}</Typography>
                </Box>
              ) : (
                <>
                  {viewMode === 'day' && renderDayTable(staffByDate[anchorStr] || [])}
                  {viewMode === 'week' && renderWeek()}
                  {viewMode === 'month' && renderMonth()}
                </>
              )}

              {canEdit && staff.length > 0 && viewMode !== 'month' && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button variant="contained" onClick={handleSave} disabled={!dirty || saving}>
                    {saving ? t('common.loading') : t('common.save')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>
      </Container>
    </LocalizationProvider>
  );
};

export default DailyShiftDuties;
