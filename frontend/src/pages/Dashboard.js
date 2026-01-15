import React, { useEffect, useState } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  useMediaQuery,
  Stack,
  Pagination,
  Switch,
  FormControlLabel,
  Checkbox,
  FormGroup,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  List as ListIcon,
  Article as ArticleIcon,
  Visibility as VisibilityIcon,
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDate } from '../utils/dateFormat';
import Swal from 'sweetalert2';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const { user, isSystemAdmin, isDeptHead } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  // HR 待處理清單狀態
  const [hrTodos, setHrTodos] = useState([]);
  const [loadingHrTodos, setLoadingHrTodos] = useState(false);
  const [savingHrTodo, setSavingHrTodo] = useState(false);
  const [hrTodoDialogOpen, setHrTodoDialogOpen] = useState(false);
  const [editingHrTodo, setEditingHrTodo] = useState(null);
  const [hrTodoForm, setHrTodoForm] = useState({
    created_date: new Date().toISOString().split('T')[0],
    employee_number: '',
    employee_name: '',
    start_date: '',
    end_date: '',
    details: '',
    progress: 'pending'
  });

  // Payroll Alert Items 狀態
  const [payrollAlertItems, setPayrollAlertItems] = useState([]);
  const [loadingPayrollAlertItems, setLoadingPayrollAlertItems] = useState(false);
  const [savingPayrollAlertItem, setSavingPayrollAlertItem] = useState(false);
  const [payrollAlertItemDialogOpen, setPayrollAlertItemDialogOpen] = useState(false);
  const [editingPayrollAlertItem, setEditingPayrollAlertItem] = useState(null);
  const [payrollAlertItemForm, setPayrollAlertItemForm] = useState({
    created_date: new Date().toISOString().split('T')[0],
    employee_number: '',
    employee_name: '',
    start_date: '',
    end_date: '',
    details: '',
    progress: 'pending'
  });

  // 個人待辦事項狀態
  const [myTodos, setMyTodos] = useState([]);
  const [loadingMyTodos, setLoadingMyTodos] = useState(false);
  const [savingMyTodo, setSavingMyTodo] = useState(false);
  const [myTodoDialogOpen, setMyTodoDialogOpen] = useState(false);
  const [editingMyTodo, setEditingMyTodo] = useState(null);
  const [myTodoForm, setMyTodoForm] = useState({
    title: '',
    description: '',
    status: 'pending',
    due_date: '',
    priority: 1
  });

  // 最新消息狀態
  const [newsList, setNewsList] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsPage, setNewsPage] = useState(1);
  const [viewingNews, setViewingNews] = useState(null);
  const [newsDetailOpen, setNewsDetailOpen] = useState(false);
  const [newsDialogOpen, setNewsDialogOpen] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [savingNews, setSavingNews] = useState(false);
  const [newsForm, setNewsForm] = useState({
    title: '',
    content: '',
    is_pinned: false,
    is_all_employees: false,
    group_ids: []
  });
  const [newsAttachments, setNewsAttachments] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [departmentGroups, setDepartmentGroups] = useState([]);
  const [loadingDepartmentGroups, setLoadingDepartmentGroups] = useState(false);
  const [isNewsGroupManager, setIsNewsGroupManager] = useState(false);
  const itemsPerPage = 15;

  const isHRMember = user?.is_hr_member || user?.is_system_admin;

  useEffect(() => {
    if (isHRMember) {
      fetchHRTodos();
      fetchPayrollAlertItems();
    }
    checkNewsGroupManager();
    fetchMyTodos();
    fetchNews();
  }, [isHRMember]);

  useEffect(() => {
    // 所有用戶都可以獲取他們有權限發布消息的部門群組列表
    fetchDepartmentGroups();
  }, []);

  // 獲取 HR 待處理清單
  const fetchHRTodos = async () => {
    try {
      setLoadingHrTodos(true);
      const response = await axios.get('/api/todos/hr');
      setHrTodos(response.data.todos || []);
    } catch (error) {
      console.error('Fetch HR todos error:', error);
      if (error.response?.status === 403) {
        await Swal.fire({
          icon: 'error',
          title: '權限不足',
          text: '只有HR Group成員可以查看HR待處理清單',
          confirmButtonText: '確定',
          confirmButtonColor: '#d33'
        });
      }
    } finally {
      setLoadingHrTodos(false);
    }
  };

  // 獲取 Payroll Alert Items
  const fetchPayrollAlertItems = async () => {
    try {
      setLoadingPayrollAlertItems(true);
      const response = await axios.get('/api/todos/payroll-alert');
      setPayrollAlertItems(response.data.items || []);
    } catch (error) {
      console.error('Fetch payroll alert items error:', error);
      if (error.response?.status === 403) {
        await Swal.fire({
          icon: 'error',
          title: '權限不足',
          text: '只有HR Group成員可以查看Payroll Alert Items',
          confirmButtonText: '確定',
          confirmButtonColor: '#d33'
        });
      }
    } finally {
      setLoadingPayrollAlertItems(false);
    }
  };

  // 獲取個人待辦事項
  const fetchMyTodos = async () => {
    try {
      setLoadingMyTodos(true);
      const response = await axios.get('/api/todos/my');
      setMyTodos(response.data.todos || []);
    } catch (error) {
      console.error('Fetch my todos error:', error);
    } finally {
      setLoadingMyTodos(false);
    }
  };

  // 獲取最新消息
  const fetchNews = async () => {
    try {
      setLoadingNews(true);
      const response = await axios.get('/api/news');
      setNewsList(response.data.news || []);
    } catch (error) {
      console.error('Fetch news error:', error);
    } finally {
      setLoadingNews(false);
    }
  };

  // 檢查是否為消息群組管理員
  const checkNewsGroupManager = async () => {
    try {
      const response = await axios.get('/api/news-groups/check-manager');
      setIsNewsGroupManager(response.data.isManager || false);
    } catch (error) {
      console.error('Check news group manager error:', error);
      setIsNewsGroupManager(false);
    }
  };

  // 獲取部門群組列表（只獲取用戶有權限發布消息的群組）
  const fetchDepartmentGroups = async () => {
    try {
      setLoadingDepartmentGroups(true);
      // 使用 forNews=true 參數，只獲取用戶有權限發布消息的部門群組
      const response = await axios.get('/api/groups/department?closed=false&forNews=true');
      setDepartmentGroups(response.data.groups || []);
    } catch (error) {
      console.error('Fetch department groups error:', error);
    } finally {
      setLoadingDepartmentGroups(false);
    }
  };

  // 查看消息詳情
  const handleViewNewsDetail = async (newsId) => {
    try {
      const response = await axios.get(`/api/news/${newsId}`);
      setViewingNews(response.data.news);
      setNewsDetailOpen(true);
    } catch (error) {
      console.error('Fetch news detail error:', error);
      await Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: '獲取消息詳情時發生錯誤',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  // 關閉消息詳情對話框
  const handleCloseNewsDetail = () => {
    setNewsDetailOpen(false);
    setViewingNews(null);
  };

  // 刪除消息
  const handleDeleteNews = async (newsId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '確認刪除',
      text: '確定要刪除此消息嗎？',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/news/${newsId}`);
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: '消息已刪除',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      await fetchNews();
    } catch (error) {
      console.error('Delete news error:', error);
      await Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: error.response?.data?.message || '刪除消息時發生錯誤',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  // 檢查用戶是否可以編輯/刪除消息
  // 注意：前端的檢查只是初步判斷，真正的權限檢查在後端
  const canEditNews = (news) => {
    // 消息群組管理員、HR Group 成員可以編輯所有消息，或者創建者可以編輯自己的消息
    // 或者如果用戶有權限的部門群組列表中有消息的群組，也可以編輯
    if (isNewsGroupManager || isHRMember || news.created_by_id === user?.id) {
      return true;
    }
    
    // 檢查消息的群組是否在用戶有權限的部門群組中
    if (news.group_ids && news.group_ids.length > 0 && departmentGroups.length > 0) {
      const accessibleGroupIds = departmentGroups.map(g => Number(g.id));
      const hasAccessToAllGroups = news.group_ids.every(id => accessibleGroupIds.includes(Number(id)));
      return hasAccessToAllGroups;
    }
    
    return false;
  };

  // 打開發布消息對話框
  const handleOpenNewsDialog = async (news = null) => {
    if (news) {
      setEditingNews(news);
      // 如果 is_all_employees 為 true，則選擇所有群組
      const selectedGroupIds = news.is_all_employees 
        ? departmentGroups.map(g => g.id)
        : (news.group_ids || []);
      setNewsForm({
        title: news.title || '',
        content: news.content || '',
        is_pinned: news.is_pinned || false,
        is_all_employees: false, // 不再使用這個欄位，改為通過群組選擇判斷
        group_ids: selectedGroupIds
      });
      // 獲取現有附件
      try {
        const response = await axios.get(`/api/news/${news.id}`);
        setNewsAttachments(response.data.news?.attachments || []);
      } catch (error) {
        console.error('Fetch attachments error:', error);
        setNewsAttachments([]);
      }
    } else {
      setEditingNews(null);
      setNewsForm({
        title: '',
        content: '',
        is_pinned: false,
        is_all_employees: false,
        group_ids: []
      });
      setNewsAttachments([]);
    }
    setNewsDialogOpen(true);
  };

  // 關閉發布消息對話框
  const handleCloseNewsDialog = () => {
    setNewsDialogOpen(false);
    setEditingNews(null);
    setNewsForm({
      title: '',
      content: '',
      is_pinned: false,
      is_all_employees: false,
      group_ids: []
    });
    setNewsAttachments([]);
  };

  // 處理群組選擇變化
  const handleGroupSelectionChange = (groupId) => {
    const currentGroupIds = newsForm.group_ids || [];
    const isSelected = currentGroupIds.includes(groupId);
    
    let newGroupIds;
    if (isSelected) {
      // 取消選擇
      newGroupIds = currentGroupIds.filter(id => id !== groupId);
    } else {
      // 選擇
      newGroupIds = [...currentGroupIds, groupId];
    }
    
    setNewsForm({
      ...newsForm,
      group_ids: newGroupIds
    });
  };

  // 處理全選/取消全選
  const handleSelectAllGroups = () => {
    const allGroupIds = departmentGroups.map(g => g.id);
    const currentGroupIds = newsForm.group_ids || [];
    const isAllSelected = allGroupIds.length > 0 && 
      allGroupIds.every(id => currentGroupIds.includes(id));
    
    if (isAllSelected) {
      // 取消全選
      setNewsForm({
        ...newsForm,
        group_ids: []
      });
    } else {
      // 全選
      setNewsForm({
        ...newsForm,
        group_ids: allGroupIds
      });
    }
  };

  // 處理附件上傳（暫存到 modal，等待保存時才上傳）
  const handleAttachmentUpload = (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // 統一處理：無論是創建還是編輯模式，都先暫存到本地狀態
    const newAttachments = Array.from(files).map((file, index) => ({
      id: `temp-${Date.now()}-${index}-${Math.random()}`,
      file_name: file.name,
      file: file,
      file_size: file.size,
      file_type: file.type,
      is_temp: true
    }));
    setNewsAttachments([...newsAttachments, ...newAttachments]);
    event.target.value = ''; // 重置文件輸入
  };

  // 刪除附件（從暫存列表或從服務器）
  const handleDeleteAttachment = async (attachment) => {
    if (attachment.is_temp) {
      // 刪除暫存附件
      setNewsAttachments(newsAttachments.filter(a => a.id !== attachment.id));
    } else if (editingNews && editingNews.id) {
      // 刪除服務器上的附件
      const result = await Swal.fire({
        icon: 'warning',
        title: '確認刪除',
        text: '確定要刪除此附件嗎？',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6'
      });

      if (!result.isConfirmed) return;

      try {
        await axios.delete(`/api/news/${editingNews.id}/attachments/${attachment.id}`);
        setNewsAttachments(newsAttachments.filter(a => a.id !== attachment.id));
        await Swal.fire({
          icon: 'success',
          title: '成功',
          text: '附件已刪除',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
      } catch (error) {
        console.error('Delete attachment error:', error);
        await Swal.fire({
          icon: 'error',
          title: '刪除失敗',
          text: error.response?.data?.message || '刪除附件時發生錯誤',
          confirmButtonText: '確定',
          confirmButtonColor: '#d33'
        });
      }
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 發布消息
  const handleCreateNews = async () => {
    if (savingNews) return;

    try {
      setSavingNews(true);

      if (!newsForm.title || newsForm.title.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入消息標題',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingNews(false);
        return;
      }

      if (!newsForm.content || newsForm.content.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請輸入消息內容',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingNews(false);
        return;
      }

      // 檢查是否選擇了群組
      const selectedGroupIds = (newsForm.group_ids || [])
        .map(id => Number(id))
        .filter(id => !isNaN(id) && id > 0);
      
      if (selectedGroupIds.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請至少選擇一個群組',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingNews(false);
        return;
      }

      // 如果選擇了所有群組，則設置 is_all_employees = true
      const allGroupIds = departmentGroups.map(g => Number(g.id)).filter(id => !isNaN(id) && id > 0);
      const isAllSelected = allGroupIds.length > 0 && 
        selectedGroupIds.length === allGroupIds.length &&
        allGroupIds.every(id => selectedGroupIds.includes(id));
      
      const newsData = {
        title: newsForm.title.trim(),
        content: newsForm.content.trim(),
        is_pinned: newsForm.is_pinned || false,
        is_all_employees: isAllSelected,
        group_ids: isAllSelected ? [] : selectedGroupIds
      };

      // 準備附件（只處理暫存的新附件）
      const tempAttachments = newsAttachments.filter(a => a.is_temp);
      const hasNewAttachments = tempAttachments.length > 0;

      if (hasNewAttachments) {
        // 如果有新附件，使用 FormData
        const formData = new FormData();
        
        // 添加消息數據
        formData.append('title', newsData.title);
        formData.append('content', newsData.content);
        formData.append('is_pinned', newsData.is_pinned);
        formData.append('is_all_employees', newsData.is_all_employees);
        
        // 添加群組 ID 數組
        if (Array.isArray(newsData.group_ids)) {
          newsData.group_ids.forEach(id => {
            formData.append('group_ids[]', id);
          });
        }

        // 添加新附件
        tempAttachments.forEach(attachment => {
          formData.append('files', attachment.file);
        });

        if (editingNews && editingNews.id) {
          // 編輯現有消息（同時上傳新附件）
          await axios.put(`/api/news/${editingNews.id}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        } else {
          // 創建新消息（同時上傳附件）
          await axios.post('/api/news', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
      } else {
        // 如果沒有新附件，使用普通 JSON
        if (editingNews && editingNews.id) {
          await axios.put(`/api/news/${editingNews.id}`, newsData);
        } else {
          await axios.post('/api/news', newsData);
        }
      }
      
      handleCloseNewsDialog();
      setSavingNews(false);
      await fetchNews();
      
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: editingNews ? '消息更新成功' : '消息發布成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Create news error:', error);
      await Swal.fire({
        icon: 'error',
        title: '發布失敗',
        text: error.response?.data?.message || '發布消息時發生錯誤',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      setSavingNews(false);
    }
  };

  // ========== HR 待處理清單處理函數 ==========
  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return '';
    }
  };

  const handleOpenHRTodoDialog = (todo = null) => {
    if (todo) {
      setEditingHrTodo(todo);
      setHrTodoForm({
        created_date: formatDateForInput(todo.created_date) || new Date().toISOString().split('T')[0],
        employee_number: todo.employee_number || '',
        employee_name: todo.employee_name || '',
        start_date: formatDateForInput(todo.start_date) || '',
        end_date: formatDateForInput(todo.end_date) || '',
        details: todo.details || '',
        progress: todo.progress || 'pending'
      });
    } else {
      setEditingHrTodo(null);
      setHrTodoForm({
        created_date: new Date().toISOString().split('T')[0],
        employee_number: '',
        employee_name: '',
        start_date: '',
        end_date: '',
        details: '',
        progress: 'pending'
      });
    }
    setHrTodoDialogOpen(true);
  };

  const handleCloseHRTodoDialog = () => {
    setHrTodoDialogOpen(false);
    setEditingHrTodo(null);
  };

  const handleSaveHRTodo = async () => {
    if (savingHrTodo) return;

    try {
      setSavingHrTodo(true);

      if (!hrTodoForm.created_date) {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請填寫建立日期',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingHrTodo(false);
        return;
      }

      if (editingHrTodo) {
        await axios.put(`/api/todos/hr/${editingHrTodo.id}`, hrTodoForm);
      } else {
        await axios.post('/api/todos/hr', hrTodoForm);
      }

      handleCloseHRTodoDialog();
      setSavingHrTodo(false);
      await fetchHRTodos();
      
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: editingHrTodo ? 'HR待處理項目更新成功' : 'HR待處理項目建立成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Save HR todo error:', error);
      await Swal.fire({
        icon: 'error',
        title: '操作失敗',
        text: error.response?.data?.message || '操作失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      setSavingHrTodo(false);
    }
  };

  const handleDeleteHRTodo = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '確認刪除',
      text: '確定要刪除此HR待處理項目嗎？',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/todos/hr/${id}`);
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: 'HR待處理項目刪除成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      await fetchHRTodos();
    } catch (error) {
      console.error('Delete HR todo error:', error);
      await Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: error.response?.data?.message || '刪除失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  // ========== Payroll Alert Items 處理函數 ==========
  const handleOpenPayrollAlertItemDialog = (item = null) => {
    if (item) {
      setEditingPayrollAlertItem(item);
      setPayrollAlertItemForm({
        created_date: formatDateForInput(item.created_date) || new Date().toISOString().split('T')[0],
        employee_number: item.employee_number || '',
        employee_name: item.employee_name || '',
        start_date: formatDateForInput(item.start_date) || '',
        end_date: formatDateForInput(item.end_date) || '',
        details: item.details || '',
        progress: item.progress || 'pending'
      });
    } else {
      setEditingPayrollAlertItem(null);
      setPayrollAlertItemForm({
        created_date: new Date().toISOString().split('T')[0],
        employee_number: '',
        employee_name: '',
        start_date: '',
        end_date: '',
        details: '',
        progress: 'pending'
      });
    }
    setPayrollAlertItemDialogOpen(true);
  };

  const handleClosePayrollAlertItemDialog = () => {
    setPayrollAlertItemDialogOpen(false);
    setEditingPayrollAlertItem(null);
  };

  const handleSavePayrollAlertItem = async () => {
    if (savingPayrollAlertItem) return;

    try {
      setSavingPayrollAlertItem(true);

      if (!payrollAlertItemForm.created_date) {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請填寫建立日期',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingPayrollAlertItem(false);
        return;
      }

      if (editingPayrollAlertItem) {
        await axios.put(`/api/todos/payroll-alert/${editingPayrollAlertItem.id}`, payrollAlertItemForm);
      } else {
        await axios.post('/api/todos/payroll-alert', payrollAlertItemForm);
      }

      handleClosePayrollAlertItemDialog();
      setSavingPayrollAlertItem(false);
      await fetchPayrollAlertItems();
      
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: editingPayrollAlertItem ? 'Payroll Alert Item更新成功' : 'Payroll Alert Item建立成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Save payroll alert item error:', error);
      await Swal.fire({
        icon: 'error',
        title: '操作失敗',
        text: error.response?.data?.message || '操作失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      setSavingPayrollAlertItem(false);
    }
  };

  const handleDeletePayrollAlertItem = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '確認刪除',
      text: '確定要刪除此Payroll Alert Item嗎？',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/todos/payroll-alert/${id}`);
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: 'Payroll Alert Item刪除成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      await fetchPayrollAlertItems();
    } catch (error) {
      console.error('Delete payroll alert item error:', error);
      await Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: error.response?.data?.message || '刪除失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  // ========== 個人待辦事項處理函數 ==========
  const handleOpenMyTodoDialog = (todo = null) => {
    if (todo) {
      setEditingMyTodo(todo);
      setMyTodoForm({
        title: todo.title || '',
        description: todo.description || '',
        status: todo.status || 'pending',
        due_date: formatDateForInput(todo.due_date) || '',
        priority: todo.priority || 1
      });
    } else {
      setEditingMyTodo(null);
      setMyTodoForm({
        title: '',
        description: '',
        status: 'pending',
        due_date: '',
        priority: 1
      });
    }
    setMyTodoDialogOpen(true);
  };

  const handleCloseMyTodoDialog = () => {
    setMyTodoDialogOpen(false);
    setEditingMyTodo(null);
  };

  const handleSaveMyTodo = async () => {
    if (savingMyTodo) return;

    try {
      setSavingMyTodo(true);

      if (!myTodoForm.title || myTodoForm.title.trim() === '') {
        await Swal.fire({
          icon: 'warning',
          title: '提示',
          text: '請填寫標題',
          confirmButtonText: '確定',
          confirmButtonColor: '#3085d6'
        });
        setSavingMyTodo(false);
        return;
      }

      if (editingMyTodo) {
        await axios.put(`/api/todos/my/${editingMyTodo.id}`, myTodoForm);
      } else {
        await axios.post('/api/todos/my', myTodoForm);
      }

      handleCloseMyTodoDialog();
      setSavingMyTodo(false);
      await fetchMyTodos();
      
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: editingMyTodo ? '個人待辦事項更新成功' : '個人待辦事項建立成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
    } catch (error) {
      console.error('Save my todo error:', error);
      await Swal.fire({
        icon: 'error',
        title: '操作失敗',
        text: error.response?.data?.message || '操作失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
      setSavingMyTodo(false);
    }
  };

  const handleDeleteMyTodo = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: '確認刪除',
      text: '確定要刪除此個人待辦事項嗎？',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/todos/my/${id}`);
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: '個人待辦事項刪除成功',
        confirmButtonText: '確定',
        confirmButtonColor: '#3085d6'
      });
      await fetchMyTodos();
    } catch (error) {
      console.error('Delete my todo error:', error);
      await Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: error.response?.data?.message || '刪除失敗',
        confirmButtonText: '確定',
        confirmButtonColor: '#d33'
      });
    }
  };

  const getProgressColor = (progress) => {
    switch (progress) {
      case 'pending':
        return 'default';
      case 'in_progress':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getProgressLabel = (progress) => {
    switch (progress) {
      case 'pending':
        return t('dashboard.hrTodo.progress.pending');
      case 'in_progress':
        return t('dashboard.hrTodo.progress.in_progress');
      case 'completed':
        return t('dashboard.hrTodo.progress.completed');
      case 'cancelled':
        return t('dashboard.hrTodo.progress.cancelled');
      default:
        return progress;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.alias || `${user?.surname} ${user?.given_name}`;
    
    let greetingKey;
    if (hour >= 0 && hour < 12) {
      greetingKey = 'dashboard.greeting.morning';
    } else if (hour >= 12 && hour < 18) {
      greetingKey = 'dashboard.greeting.afternoon';
    } else {
      greetingKey = 'dashboard.greeting.evening';
    }
    
    return t(greetingKey, { name });
  };

  return (
    <Box>
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        gutterBottom
        sx={{ wordBreak: 'break-word' }}
      >
        {getGreeting()}
      </Typography>
      <Typography 
        variant="body1" 
        color="text.secondary" 
        sx={{ mb: 3, wordBreak: 'break-word' }}
      >
        {i18n.language === 'en' 
          ? `${user?.department_name || user?.department_name_zh || ''} - ${user?.position_name || user?.position_name_zh || ''}`
          : `${user?.department_name_zh || user?.department_name || ''} - ${user?.position_name_zh || user?.position_name || ''}`
        }
      </Typography>

      {/* 個人待辦事項清單（所有用戶可見） */}
      <Box sx={{ mt: 3 }}>
        <Divider sx={{ mb: 3 }} />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 2 : 0,
            mb: 2 
          }}
        >
          <Typography variant="h5" gutterBottom={isMobile}>
            <ListIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {t('dashboard.myTodo.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenMyTodoDialog()}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'medium'}
          >
            {t('dashboard.myTodo.add')}
          </Button>
        </Box>

        {loadingMyTodos ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : myTodos.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.myTodo.noTodos')}
            </Typography>
          </Paper>
        ) : isMobile ? (
          <Stack spacing={2}>
            {myTodos.map((todo) => (
              <Card key={todo.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={t(`dashboard.myTodo.status.${todo.status}`)}
                        color={todo.status === 'completed' ? 'success' : todo.status === 'in_progress' ? 'primary' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={t(`dashboard.myTodo.priority.${todo.priority}`)}
                        color={todo.priority === 3 ? 'error' : todo.priority === 2 ? 'warning' : 'default'}
                        size="small"
                      />
                    </Box>
                    <Box>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenMyTodoDialog(todo)}
                        color="primary"
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMyTodo(todo.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {todo.title}
                      </Typography>
                    </Box>
                    {todo.description && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {todo.description}
                        </Typography>
                      </Box>
                    )}
                    {todo.due_date && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {t('dashboard.myTodo.dueDate')}: {formatDate(todo.due_date)}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer 
            component={Paper}
            sx={{ 
              maxHeight: isTablet ? '600px' : 'none',
              overflowX: 'auto'
            }}
          >
            <Table stickyHeader={isTablet}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 200 }}>{t('dashboard.myTodo.title')}</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>{t('dashboard.myTodo.description')}</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>{t('dashboard.myTodo.status.label')}</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>{t('dashboard.myTodo.priority.label')}</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>{t('dashboard.myTodo.dueDate')}</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>{t('dashboard.myTodo.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myTodos.map((todo) => (
                  <TableRow key={todo.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {todo.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {todo.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`dashboard.myTodo.status.${todo.status}`)}
                        color={todo.status === 'completed' ? 'success' : todo.status === 'in_progress' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`dashboard.myTodo.priority.${todo.priority}`)}
                        color={todo.priority === 3 ? 'error' : todo.priority === 2 ? 'warning' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(todo.due_date) || '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenMyTodoDialog(todo)}
                        color="primary"
                        sx={{ mr: 0.5 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteMyTodo(todo.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* HR 待處理清單（僅 HR Group 成員可見） */}
      {isHRMember && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 2 : 0,
              mb: 2 
            }}
          >
            <Typography variant="h5" gutterBottom={isMobile}>
              <ListIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              {t('dashboard.hrTodo.title')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenHRTodoDialog()}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'medium'}
            >
              {t('dashboard.hrTodo.add')}
            </Button>
          </Box>

          {loadingHrTodos ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : hrTodos.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {t('dashboard.hrTodo.noTodos')}
              </Typography>
            </Paper>
          ) : isMobile ? (
            <Stack spacing={2}>
              {hrTodos.map((todo) => (
                <Card key={todo.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Chip
                        label={getProgressLabel(todo.progress)}
                        color={getProgressColor(todo.progress)}
                        size="small"
                      />
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenHRTodoDialog(todo)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteHRTodo(todo.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Stack spacing={1}>
                      {todo.created_date && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.hrTodo.createdDate')}:
                          </Typography>
                          <Typography variant="body2">{formatDate(todo.created_date)}</Typography>
                        </Box>
                      )}
                      {todo.employee_number && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.hrTodo.employeeNumber')}:
                          </Typography>
                          <Typography variant="body2">{todo.employee_number}</Typography>
                        </Box>
                      )}
                      {todo.employee_name && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.hrTodo.employeeName')}:
                          </Typography>
                          <Typography variant="body2">{todo.employee_name}</Typography>
                        </Box>
                      )}
                      {(todo.start_date || todo.end_date) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.hrTodo.startDate')} - {t('dashboard.hrTodo.endDate')}:
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(todo.start_date) || '-'} ~ {formatDate(todo.end_date) || '-'}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer 
              component={Paper}
              sx={{ 
                maxHeight: isTablet ? '600px' : 'none',
                overflowX: 'auto'
              }}
            >
              <Table stickyHeader={isTablet}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 100 }}>{t('dashboard.hrTodo.createdDate')}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{t('dashboard.hrTodo.employeeNumber')}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{t('dashboard.hrTodo.employeeName')}</TableCell>
                    {!isTablet && (
                      <>
                        <TableCell sx={{ minWidth: 100 }}>{t('dashboard.hrTodo.startDate')}</TableCell>
                        <TableCell sx={{ minWidth: 100 }}>{t('dashboard.hrTodo.endDate')}</TableCell>
                      </>
                    )}
                    <TableCell sx={{ minWidth: 100 }}>{t('dashboard.hrTodo.progress.label')}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>{t('dashboard.hrTodo.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {hrTodos.map((todo) => (
                    <TableRow key={todo.id} hover>
                      <TableCell>{formatDate(todo.created_date) || '-'}</TableCell>
                      <TableCell>{todo.employee_number || '-'}</TableCell>
                      <TableCell>{todo.employee_name || '-'}</TableCell>
                      {!isTablet && (
                        <>
                          <TableCell>{formatDate(todo.start_date) || '-'}</TableCell>
                          <TableCell>{formatDate(todo.end_date) || '-'}</TableCell>
                        </>
                      )}
                      <TableCell>
                        <Chip
                          label={getProgressLabel(todo.progress)}
                          color={getProgressColor(todo.progress)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenHRTodoDialog(todo)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteHRTodo(todo.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Payroll Alert Items 清單（僅限 HR Group 成員可見） */}
      {isHRMember && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ mb: 3 }} />
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 2 : 0,
              mb: 2 
            }}
          >
            <Typography variant="h5" gutterBottom={isMobile}>
              <ListIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              {t('dashboard.payrollAlert.title')}
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenPayrollAlertItemDialog()}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'medium'}
            >
              {t('dashboard.payrollAlert.add')}
            </Button>
          </Box>

          {loadingPayrollAlertItems ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : payrollAlertItems.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                {t('dashboard.payrollAlert.noItems')}
              </Typography>
            </Paper>
          ) : isMobile ? (
            <Stack spacing={2}>
              {payrollAlertItems.map((item) => (
                <Card key={item.id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Chip
                        label={getProgressLabel(item.progress)}
                        color={getProgressColor(item.progress)}
                        size="small"
                      />
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenPayrollAlertItemDialog(item)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePayrollAlertItem(item.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Stack spacing={1}>
                      {item.created_date && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.payrollAlert.createdDate')}:
                          </Typography>
                          <Typography variant="body2">{formatDate(item.created_date)}</Typography>
                        </Box>
                      )}
                      {item.employee_number && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.payrollAlert.employeeNumber')}:
                          </Typography>
                          <Typography variant="body2">{item.employee_number}</Typography>
                        </Box>
                      )}
                      {item.employee_name && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.payrollAlert.employeeName')}:
                          </Typography>
                          <Typography variant="body2">{item.employee_name}</Typography>
                        </Box>
                      )}
                      {(item.start_date || item.end_date) && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.payrollAlert.startDate')} - {t('dashboard.payrollAlert.endDate')}:
                          </Typography>
                          <Typography variant="body2">
                            {formatDate(item.start_date) || '-'} ~ {formatDate(item.end_date) || '-'}
                          </Typography>
                        </Box>
                      )}
                      {item.details && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {t('dashboard.payrollAlert.details')}:
                          </Typography>
                          <Typography variant="body2">{item.details}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            <TableContainer 
              component={Paper}
              sx={{ 
                maxHeight: isTablet ? '600px' : 'none',
                overflowX: 'auto'
              }}
            >
              <Table stickyHeader={isTablet}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 100 }}>{t('dashboard.payrollAlert.createdDate')}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{t('dashboard.payrollAlert.employeeNumber')}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}>{t('dashboard.payrollAlert.employeeName')}</TableCell>
                    {!isTablet && (
                      <>
                        <TableCell sx={{ minWidth: 100 }}>{t('dashboard.payrollAlert.startDate')}</TableCell>
                        <TableCell sx={{ minWidth: 100 }}>{t('dashboard.payrollAlert.endDate')}</TableCell>
                      </>
                    )}
                    <TableCell sx={{ minWidth: 200 }}>{t('dashboard.payrollAlert.details')}</TableCell>
                    <TableCell sx={{ minWidth: 100 }}>{t('dashboard.payrollAlert.progress.label')}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 100 }}>{t('dashboard.payrollAlert.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payrollAlertItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{formatDate(item.created_date) || '-'}</TableCell>
                      <TableCell>{item.employee_number || '-'}</TableCell>
                      <TableCell>{item.employee_name || '-'}</TableCell>
                      {!isTablet && (
                        <>
                          <TableCell>{formatDate(item.start_date) || '-'}</TableCell>
                          <TableCell>{formatDate(item.end_date) || '-'}</TableCell>
                        </>
                      )}
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.details || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getProgressLabel(item.progress)}
                          color={getProgressColor(item.progress)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenPayrollAlertItemDialog(item)}
                          color="primary"
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletePayrollAlertItem(item.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* HR 待處理清單對話框 */}
      {isHRMember && (
        <Dialog 
          open={hrTodoDialogOpen} 
          onClose={handleCloseHRTodoDialog} 
          maxWidth="md" 
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingHrTodo ? t('dashboard.hrTodo.edit') : t('dashboard.hrTodo.add')}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.createdDate')}
                  type="date"
                  value={hrTodoForm.created_date}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, created_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.employeeNumber')}
                  value={hrTodoForm.employee_number}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, employee_number: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.employeeName')}
                  value={hrTodoForm.employee_name}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, employee_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.startDate')}
                  type="date"
                  value={hrTodoForm.start_date}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, start_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.endDate')}
                  type="date"
                  value={hrTodoForm.end_date}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, end_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('dashboard.hrTodo.progress.label')}</InputLabel>
                  <Select
                    value={hrTodoForm.progress}
                    onChange={(e) => setHrTodoForm({ ...hrTodoForm, progress: e.target.value })}
                    label={t('dashboard.hrTodo.progress.label')}
                  >
                    <MenuItem value="pending">{t('dashboard.hrTodo.progress.pending')}</MenuItem>
                    <MenuItem value="in_progress">{t('dashboard.hrTodo.progress.in_progress')}</MenuItem>
                    <MenuItem value="completed">{t('dashboard.hrTodo.progress.completed')}</MenuItem>
                    <MenuItem value="cancelled">{t('dashboard.hrTodo.progress.cancelled')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('dashboard.hrTodo.details')}
                  multiline
                  rows={4}
                  value={hrTodoForm.details}
                  onChange={(e) => setHrTodoForm({ ...hrTodoForm, details: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button 
              onClick={handleCloseHRTodoDialog}
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              {t('dashboard.hrTodo.cancel')}
            </Button>
            <Button 
              onClick={handleSaveHRTodo} 
              variant="contained"
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
              disabled={savingHrTodo}
            >
              {savingHrTodo ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  {t('dashboard.hrTodo.saving') || '儲存中...'}
                </>
              ) : (
                t('dashboard.hrTodo.save')
              )}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Payroll Alert Items 對話框 */}
      {isHRMember && (
        <Dialog 
          open={payrollAlertItemDialogOpen} 
          onClose={handleClosePayrollAlertItemDialog} 
          maxWidth="md" 
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingPayrollAlertItem ? t('dashboard.payrollAlert.edit') : t('dashboard.payrollAlert.add')}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.createdDate')}
                  type="date"
                  value={payrollAlertItemForm.created_date}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, created_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.employeeNumber')}
                  value={payrollAlertItemForm.employee_number}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, employee_number: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.employeeName')}
                  value={payrollAlertItemForm.employee_name}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, employee_name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.startDate')}
                  type="date"
                  value={payrollAlertItemForm.start_date}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, start_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.endDate')}
                  type="date"
                  value={payrollAlertItemForm.end_date}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, end_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t('dashboard.payrollAlert.progress.label')}</InputLabel>
                  <Select
                    value={payrollAlertItemForm.progress}
                    onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, progress: e.target.value })}
                    label={t('dashboard.payrollAlert.progress.label')}
                  >
                    <MenuItem value="pending">{t('dashboard.payrollAlert.progress.pending')}</MenuItem>
                    <MenuItem value="in_progress">{t('dashboard.payrollAlert.progress.in_progress')}</MenuItem>
                    <MenuItem value="completed">{t('dashboard.payrollAlert.progress.completed')}</MenuItem>
                    <MenuItem value="cancelled">{t('dashboard.payrollAlert.progress.cancelled')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('dashboard.payrollAlert.details')}
                  multiline
                  rows={4}
                  value={payrollAlertItemForm.details}
                  onChange={(e) => setPayrollAlertItemForm({ ...payrollAlertItemForm, details: e.target.value })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button 
              onClick={handleClosePayrollAlertItemDialog}
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              {t('dashboard.payrollAlert.cancel')}
            </Button>
            <Button 
              onClick={handleSavePayrollAlertItem} 
              variant="contained"
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
              disabled={savingPayrollAlertItem}
            >
              {savingPayrollAlertItem ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  {t('dashboard.payrollAlert.saving') || '儲存中...'}
                </>
              ) : (
                t('dashboard.payrollAlert.save')
              )}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 個人待辦事項對話框 */}
      <Dialog 
        open={myTodoDialogOpen} 
        onClose={handleCloseMyTodoDialog} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingMyTodo ? t('dashboard.myTodo.edit') : t('dashboard.myTodo.add')}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('dashboard.myTodo.title')}
                value={myTodoForm.title}
                onChange={(e) => setMyTodoForm({ ...myTodoForm, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('dashboard.myTodo.description')}
                multiline
                rows={3}
                value={myTodoForm.description}
                onChange={(e) => setMyTodoForm({ ...myTodoForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('dashboard.myTodo.status.label')}</InputLabel>
                <Select
                  value={myTodoForm.status}
                  onChange={(e) => setMyTodoForm({ ...myTodoForm, status: e.target.value })}
                  label={t('dashboard.myTodo.status.label')}
                >
                  <MenuItem value="pending">{t('dashboard.myTodo.status.pending')}</MenuItem>
                  <MenuItem value="in_progress">{t('dashboard.myTodo.status.in_progress')}</MenuItem>
                  <MenuItem value="completed">{t('dashboard.myTodo.status.completed')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>{t('dashboard.myTodo.priority.label')}</InputLabel>
                <Select
                  value={myTodoForm.priority}
                  onChange={(e) => setMyTodoForm({ ...myTodoForm, priority: Number(e.target.value) })}
                  label={t('dashboard.myTodo.priority.label')}
                >
                  <MenuItem value={1}>{t('dashboard.myTodo.priority.1')}</MenuItem>
                  <MenuItem value={2}>{t('dashboard.myTodo.priority.2')}</MenuItem>
                  <MenuItem value={3}>{t('dashboard.myTodo.priority.3')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t('dashboard.myTodo.dueDate')}
                type="date"
                value={myTodoForm.due_date}
                onChange={(e) => setMyTodoForm({ ...myTodoForm, due_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
          <Button 
            onClick={handleCloseMyTodoDialog}
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
          >
            {t('dashboard.myTodo.cancel')}
          </Button>
          <Button 
            onClick={handleSaveMyTodo} 
            variant="contained"
            fullWidth={isMobile}
            size={isMobile ? 'large' : 'medium'}
            disabled={savingMyTodo}
          >
            {savingMyTodo ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                {t('dashboard.myTodo.saving') || '儲存中...'}
              </>
            ) : (
              t('dashboard.myTodo.save')
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 最新消息列表 */}
      <Box sx={{ mt: 4 }}>
        <Divider sx={{ mb: 3 }} />
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 2 : 0,
            mb: 2 
          }}
        >
          <Typography variant="h5" gutterBottom={isMobile}>
            <ArticleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            最新消息
          </Typography>
          {/* 如果用戶有權限的部門群組列表不為空，或者是用戶是消息群組管理員/HR成員，則顯示發布按鈕 */}
          {(departmentGroups.length > 0 || isNewsGroupManager || isHRMember) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenNewsDialog}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'medium'}
            >
              發布消息
            </Button>
          )}
        </Box>

        {loadingNews ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : newsList.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              暫無最新消息
            </Typography>
          </Paper>
        ) : (
          <>
            <Stack spacing={2}>
              {newsList
                .slice((newsPage - 1) * itemsPerPage, newsPage * itemsPerPage)
                .map((news) => (
                  <Card key={news.id} variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                        {news.is_pinned && (
                          <Chip
                            label="置頂"
                            color="warning"
                            size="small"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" gutterBottom>
                            {news.title}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              mb: 1,
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {news.content}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography variant="caption" color="text.secondary">
                              發布者: {news.creator_display_name || news.creator_email || '未知'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              發布時間: {formatDate(news.created_at)}
                            </Typography>
                            {news.attachment_count > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                附件: {news.attachment_count} 個
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<VisibilityIcon />}
                                onClick={() => handleViewNewsDetail(news.id)}
                              >
                                查看詳情
                              </Button>
                              {canEditNews(news) && (
                                <>
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleOpenNewsDialog(news)}
                                    title="編輯"
                                  >
                                    <EditIcon />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => handleDeleteNews(news.id)}
                                    title="刪除"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </>
                              )}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
            </Stack>
            
            {newsList.length > itemsPerPage && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                <Pagination
                  count={Math.ceil(newsList.length / itemsPerPage)}
                  page={newsPage}
                  onChange={(event, value) => setNewsPage(value)}
                  color="primary"
                  size={isMobile ? 'small' : 'medium'}
                />
              </Box>
            )}
          </>
        )}
      </Box>

      {/* 消息詳情對話框 */}
      <Dialog
        open={newsDetailOpen}
        onClose={handleCloseNewsDetail}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {viewingNews?.is_pinned && (
              <Chip label="置頂" color="warning" size="small" />
            )}
            <Typography variant="h6" component="span">
              {viewingNews?.title}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {viewingNews && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  發布者: {viewingNews.creator_display_name || viewingNews.creator_email || '未知'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  發布時間: {formatDate(viewingNews.created_at)}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                {viewingNews.content}
              </Typography>
              {viewingNews.attachments && viewingNews.attachments.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    附件 ({viewingNews.attachments.length} 個)
                  </Typography>
                  <List dense>
                    {viewingNews.attachments.map((attachment) => (
                      <ListItem
                        key={attachment.id}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            onClick={() => {
                              window.open(`/api/news/${viewingNews.id}/attachments/${attachment.id}/download`, '_blank');
                            }}
                          >
                            <DownloadIcon />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={attachment.file_name}
                          secondary={`${formatFileSize(attachment.file_size || 0)}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewsDetail} variant="outlined">
            關閉
          </Button>
          </DialogActions>
        </Dialog>

      {/* 發布消息對話框 */}
      {/* 如果用戶有權限的部門群組列表不為空，或者是用戶是消息群組管理員/HR成員，則顯示對話框 */}
      {(departmentGroups.length > 0 || isNewsGroupManager || isHRMember) && (
        <Dialog
          open={newsDialogOpen}
          onClose={handleCloseNewsDialog}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
        >
          <DialogTitle>
            {editingNews ? '編輯消息' : '發布新消息'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="消息標題"
                  value={newsForm.title}
                  onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="消息內容"
                  multiline
                  rows={6}
                  value={newsForm.content}
                  onChange={(e) => setNewsForm({ ...newsForm, content: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newsForm.is_pinned}
                      onChange={(e) => setNewsForm({ ...newsForm, is_pinned: e.target.checked })}
                    />
                  }
                  label="置頂消息"
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  選擇接收群組（部門群組）
                </Typography>
                {loadingDepartmentGroups ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
                    <List dense>
                      <ListItem disablePadding>
                        <ListItemButton onClick={handleSelectAllGroups}>
                          <ListItemIcon>
                            <Checkbox
                              edge="start"
                              checked={
                                departmentGroups.length > 0 &&
                                departmentGroups.every(g => (newsForm.group_ids || []).includes(g.id))
                              }
                              indeterminate={
                                (newsForm.group_ids || []).length > 0 &&
                                (newsForm.group_ids || []).length < departmentGroups.length
                              }
                              tabIndex={-1}
                              disableRipple
                            />
                          </ListItemIcon>
                          <ListItemText 
                            primary="全選所有群組（發送給所有員工）"
                            primaryTypographyProps={{ fontWeight: 'bold' }}
                          />
                        </ListItemButton>
                      </ListItem>
                      <Divider />
                      {departmentGroups.map((group) => {
                        const isSelected = (newsForm.group_ids || []).includes(group.id);
                        return (
                          <ListItem key={group.id} disablePadding>
                            <ListItemButton onClick={() => handleGroupSelectionChange(group.id)}>
                              <ListItemIcon>
                                <Checkbox
                                  edge="start"
                                  checked={isSelected}
                                  tabIndex={-1}
                                  disableRipple
                                />
                              </ListItemIcon>
                              <ListItemText 
                                primary={group.name_zh || group.name}
                                secondary={group.description || ''}
                              />
                            </ListItemButton>
                          </ListItem>
                        );
                      })}
                    </List>
                  </Paper>
                )}
                {newsForm.group_ids && newsForm.group_ids.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    已選擇 {newsForm.group_ids.length} 個群組
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  附件
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <input
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.doc,.docx"
                    style={{ display: 'none' }}
                    id="news-attachment-upload"
                    multiple
                    type="file"
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAttachments || savingNews}
                  />
                  <label htmlFor="news-attachment-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<AttachFileIcon />}
                      disabled={uploadingAttachments || savingNews}
                      fullWidth
                    >
                      {uploadingAttachments ? '上傳中...' : '選擇附件'}
                    </Button>
                  </label>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    支援格式：PDF、JPG、JPEG、PNG、GIF、BMP、WEBP、TIFF、DOC、DOCX（每個檔案最大 10MB）
                  </Typography>
                </Box>
                {newsAttachments.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 1 }}>
                    <List dense>
                      {newsAttachments.map((attachment) => (
                        <ListItem
                          key={attachment.id}
                          secondaryAction={
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleDeleteAttachment(attachment)}
                              disabled={savingNews}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          }
                        >
                          <ListItemIcon>
                            <AttachFileIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={attachment.file_name}
                            secondary={attachment.is_temp ? `暫存 - ${formatFileSize(attachment.file_size || 0)}` : formatFileSize(attachment.file_size || 0)}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ flexDirection: isMobile ? 'column-reverse' : 'row', gap: isMobile ? 1 : 0 }}>
            <Button
              onClick={handleCloseNewsDialog}
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateNews}
              variant="contained"
              fullWidth={isMobile}
              size={isMobile ? 'large' : 'medium'}
              disabled={savingNews}
            >
              {savingNews ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  {editingNews ? '更新中...' : '發布中...'}
                </>
              ) : (
                editingNews ? '更新' : '發布'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default Dashboard;

