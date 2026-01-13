import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  Grid,
  InputAdornment,
  Badge,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  Description as DescriptionIcon,
  InsertDriveFile as InsertDriveFileIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import UserSearchDialog from '../components/UserSearchDialog';
import Swal from 'sweetalert2';

const ChatRoom = () => {
  const { t } = useTranslation();
  const { user, isSystemAdmin } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileInputRef, setFileInputRef] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // 對話框狀態
  const [createRoomOpen, setCreateRoomOpen] = useState(false);
  const [editRoomOpen, setEditRoomOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState(null);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [sendToIndividualOpen, setSendToIndividualOpen] = useState(false);
  const [isHRMember, setIsHRMember] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    member_ids: []
  });

  useEffect(() => {
    console.log(`🔄 [前端] ChatRoom 組件掛載 - 時間: ${new Date().toISOString()}`);
    fetchRooms();
    checkHRMembership();
  }, []);

  useEffect(() => {
    console.log(`🔄 [前端] selectedRoom 變化 - ID: ${selectedRoom?.id || 'null'}, 時間: ${new Date().toISOString()}`);
    if (selectedRoom) {
      // 切換訊息傳遞時自動載入訊息歷史
      console.log(`📋 [前端] 準備載入訊息傳遞詳情和訊息 - ID: ${selectedRoom.id}`);
      setMessages([]); // 先清空舊訊息
      fetchRoomDetail();
      fetchMessages(); // 自動載入訊息
    } else {
      setMessages([]); // 沒有選中訊息傳遞時清空訊息
    }
  }, [selectedRoom?.id]); // 只監聽訊息傳遞 ID 的變化，而不是整個對象

  useEffect(() => {
    // 只在有新訊息時才滾動到底部，避免頻繁滾動
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100); // 延遲100ms，避免與狀態更新衝突
      return () => clearTimeout(timer);
    }
  }, [messages.length]); // 只監聽訊息數量變化，而不是整個 messages 數組

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchRooms = async (silent = false) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    console.log(`📨 [前端] fetchRooms 開始 - silent: ${silent}, 時間: ${timestamp}`);
    
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await axios.get('/api/chat/my-rooms');
      const duration = Date.now() - startTime;
      const newRooms = response.data.rooms || [];
      console.log(`✅ [前端] fetchRooms 成功 - 訊息傳遞數量: ${newRooms.length}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      // 只在訊息傳遞列表真正變化時才更新狀態
      setRooms(prevRooms => {
        // 比較未讀數量是否有變化
        const hasUnreadChange = prevRooms.some((prevRoom, index) => {
          const newRoom = newRooms.find(r => r.id === prevRoom.id);
          return newRoom && newRoom.unread_count !== prevRoom.unread_count;
        });
        
        // 比較訊息傳遞數量
        if (prevRooms.length !== newRooms.length) {
          return newRooms;
        }
        
        // 如果有未讀數量變化，更新
        if (hasUnreadChange) {
          return newRooms;
        }
        
        // 沒有變化，返回舊的狀態（避免重新渲染）
        return prevRooms;
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      
      console.log(`${statusIcon} [前端] fetchRooms 失敗 - 狀態: ${status}, 錯誤: ${error.response?.data?.message || error.message}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      if (!silent) {
        console.error('Fetch rooms error:', error);
        Swal.fire({
          icon: 'error',
          title: '錯誤',
          text: error.response?.data?.message || '獲取訊息傳遞列表時發生錯誤',
          confirmButtonText: '確定'
        });
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchRoomDetail = async () => {
    if (!selectedRoom) return;
    const startTime = Date.now();
    const roomId = selectedRoom.id;
    console.log(`📨 [前端] fetchRoomDetail 開始 - 訊息傳遞 ID: ${roomId}, 時間: ${new Date().toISOString()}`);
    
    try {
      const response = await axios.get(`/api/chat/${roomId}`);
      const duration = Date.now() - startTime;
      setSelectedRoom(response.data.room);
      console.log(`✅ [前端] fetchRoomDetail 成功 - 訊息傳遞 ID: ${roomId}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      console.log(`${statusIcon} [前端] fetchRoomDetail 失敗 - 訊息傳遞 ID: ${roomId}, 狀態: ${status}, 錯誤: ${error.response?.data?.message || error.message}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      console.error('Fetch room detail error:', error);
    }
  };

  const fetchMessages = async (silent = false) => {
    if (!selectedRoom) return;
    const startTime = Date.now();
    const roomId = selectedRoom.id;
    console.log(`📨 [前端] fetchMessages 開始 - 訊息傳遞 ID: ${roomId}, silent: ${silent}, 時間: ${new Date().toISOString()}`);
    
    try {
      const response = await axios.get(`/api/chat/${roomId}/messages`, {
        params: { limit: 100, offset: 0 }
      });
      const duration = Date.now() - startTime;
      const newMessages = response.data.messages || [];
      console.log(`✅ [前端] fetchMessages 成功 - 訊息傳遞 ID: ${roomId}, 訊息數量: ${newMessages.length}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      // 直接設置訊息，不進行複雜的比較
      setMessages(newMessages);
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      console.log(`${statusIcon} [前端] fetchMessages 失敗 - 訊息傳遞 ID: ${roomId}, 狀態: ${status}, 錯誤: ${error.response?.data?.message || error.message}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      if (!silent) {
        console.error('Fetch messages error:', error);
        Swal.fire({
          icon: 'error',
          title: '錯誤',
          text: error.response?.data?.message || '獲取訊息時發生錯誤',
          confirmButtonText: '確定'
        });
      }
      // 發生錯誤時不清空訊息，保持現有訊息顯示
    }
  };

  const handleCreateRoom = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/chat', {
        name: formData.name,
        description: formData.description,
        member_ids: formData.member_ids
      });
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: '訊息傳遞創建成功',
        confirmButtonText: '確定'
      });
      setCreateRoomOpen(false);
      setFormData({ name: '', description: '', member_ids: [] });
      fetchRooms();
      setSelectedRoom(response.data.room);
    } catch (error) {
      console.error('Create room error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '創建訊息傳遞時發生錯誤',
        confirmButtonText: '確定'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedRoom) return;
    if ((!messageText.trim() && !selectedFile) || sending) return;

    const startTime = Date.now();
    const roomId = selectedRoom.id;
    const hasMessage = !!messageText.trim();
    const hasFile = !!selectedFile;
    console.log(`📨 [前端] handleSendMessage 開始 - 訊息傳遞 ID: ${roomId}, 有訊息: ${hasMessage}, 有檔案: ${hasFile}, 時間: ${new Date().toISOString()}`);

    try {
      setSending(true);
      const formData = new FormData();
      if (messageText.trim()) {
        formData.append('message', messageText);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await axios.post(`/api/chat/${roomId}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ [前端] handleSendMessage 成功 - 訊息傳遞 ID: ${roomId}, 訊息 ID: ${response.data.chatMessage?.id}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);

      setMessageText('');
      setSelectedFile(null);
      if (fileInputRef) {
        fileInputRef.value = '';
      }
      
      // 發送成功後自動刷新一次，讓用戶立即看到新訊息
      setTimeout(() => {
        console.log(`🔄 [前端] 自動刷新訊息和列表 - 訊息傳遞 ID: ${roomId}, 時間: ${new Date().toISOString()}`);
        fetchMessages(true);
        fetchRooms(true);
      }, 500);
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      console.log(`${statusIcon} [前端] handleSendMessage 失敗 - 訊息傳遞 ID: ${roomId}, 狀態: ${status}, 錯誤: ${error.response?.data?.message || error.message}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      console.error('Send message error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '發送訊息時發生錯誤',
        confirmButtonText: '確定'
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // 檢查文件大小（10MB）
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'warning',
          title: '檔案過大',
          text: '檔案大小不能超過10MB',
          confirmButtonText: '確定'
        });
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef) {
      fileInputRef.value = '';
    }
  };

  const handleDownloadFile = async (message) => {
    if (!message.file_name || !selectedRoom) return;
    try {
      const response = await axios.get(`/api/chat/${selectedRoom.id}/messages/${message.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', message.original_file_name || message.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download file error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '下載檔案時發生錯誤',
        confirmButtonText: '確定'
      });
    }
  };

  const handleAddMember = async (selectedUser) => {
    if (!selectedRoom) return;
    try {
      await axios.post(`/api/chat/${selectedRoom.id}/members`, {
        user_id: selectedUser.id
      });
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: '成員添加成功',
        confirmButtonText: '確定'
      });
      setUserSearchOpen(false);
      fetchRoomDetail();
    } catch (error) {
      console.error('Add member error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '添加成員時發生錯誤',
        confirmButtonText: '確定'
      });
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!selectedRoom) return;
    try {
      const result = await Swal.fire({
        title: '確認移除',
        text: '確定要移除這個成員嗎？',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '確定',
        cancelButtonText: '取消'
      });

      if (result.isConfirmed) {
        await axios.delete(`/api/chat/${selectedRoom.id}/members/${userId}`);
        await Swal.fire({
          icon: 'success',
          title: '成功',
          text: '成員移除成功',
          confirmButtonText: '確定'
        });
        fetchRoomDetail();
      }
    } catch (error) {
      console.error('Remove member error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '移除成員時發生錯誤',
        confirmButtonText: '確定'
      });
    }
  };

  const checkHRMembership = async () => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    console.log(`📨 [前端] checkHRMembership 開始 - 時間: ${timestamp}`);
    
    try {
      // 通過嘗試獲取所有訊息傳遞來檢查是否為 HR Group 成員
      const response = await axios.get('/api/chat/all');
      const duration = Date.now() - startTime;
      setIsHRMember(true);
      console.log(`✅ [前端] checkHRMembership 成功 - 是 HR 成員, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const isRateLimit = status === 429;
      const statusIcon = isRateLimit ? '🚫' : '❌';
      const isHR = status !== 403; // 403 表示不是 HR，其他錯誤可能是其他問題
      
      console.log(`${statusIcon} [前端] checkHRMembership 完成 - 狀態: ${status}, 是 HR 成員: ${status === 200}, 耗時: ${duration}ms, 時間: ${new Date().toISOString()}`);
      
      if (error.response?.status === 403) {
        setIsHRMember(false);
      } else {
        setIsHRMember(false);
      }
    }
  };

  const handleSendToIndividual = async (selectedUser) => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      // 創建一個只有兩個人的訊息傳遞
      const roomName = `${user.display_name || user.name_zh || user.employee_number} - ${selectedUser.display_name || selectedUser.name_zh || selectedUser.employee_number}`;
      const response = await axios.post('/api/chat', {
        name: roomName,
        description: '個人訊息傳遞',
        member_ids: [selectedUser.id]
      });
      
      setSendToIndividualOpen(false);
      setSelectedRoom(response.data.room);
      fetchRooms();
      
      await Swal.fire({
        icon: 'success',
        title: '成功',
        text: '訊息傳遞已創建',
        confirmButtonText: '確定'
      });
    } catch (error) {
      console.error('Create individual room error:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: error.response?.data?.message || '創建訊息傳遞時發生錯誤',
        confirmButtonText: '確定'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) {
      return <ImageIcon />;
    } else if (fileType === 'application/pdf') {
      return <DescriptionIcon />;
    } else {
      return <InsertDriveFileIcon />;
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes}分鐘前`;
    if (hours < 24) return `${hours}小時前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  };

  const isRoomAdmin = selectedRoom?.members?.some(
    m => m.user_id === user.id && m.is_admin
  );

  return (
    <Layout>
      <Box 
        sx={{ 
          display: 'flex', 
          height: { 
            xs: 'calc(100vh - 56px - 40px)', // 移動端：減去 AppBar 高度和 padding
            sm: 'calc(100vh - 64px - 40px)', // 桌面端：減去 AppBar 高度和 padding
            md: 'calc(100vh - 64px - 32px)' // 桌面端：減去 AppBar 高度和 padding（增加頂部空間）
          },
          maxHeight: { 
            xs: 'calc(100vh - 56px - 40px)',
            sm: 'calc(100vh - 64px - 40px)',
            md: 'calc(100vh - 64px - 32px)'
          },
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          position: 'relative',
          width: '100%'
        }}
      >
        {/* 訊息傳遞列表 */}
        <Paper
          sx={{
            width: isMobile ? '100%' : isTablet ? '250px' : '300px',
            height: isMobile ? '200px' : '100%',
            maxHeight: isMobile ? '200px' : '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: isMobile ? 'none' : `1px solid ${theme.palette.divider}`,
            borderBottom: isMobile ? `1px solid ${theme.palette.divider}` : 'none',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          <Box 
            sx={{ 
              p: { xs: 1.5, sm: 2 }, 
              borderBottom: `1px solid ${theme.palette.divider}`, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0,
              minHeight: { xs: '48px', sm: '56px' }
            }}
          >
            <Typography 
              variant="h6"
              sx={{ 
                fontSize: { xs: '1rem', sm: '1.25rem' },
                fontWeight: 600
              }}
            >
              訊息傳遞
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {isHRMember && (
                <Tooltip title="發送給個人">
                  <IconButton 
                    size={isMobile ? 'small' : 'medium'}
                    onClick={() => setSendToIndividualOpen(true)}
                  >
                    <PersonAddIcon fontSize={isMobile ? 'small' : 'medium'} />
                  </IconButton>
                </Tooltip>
              )}
              {isSystemAdmin && (
                <Tooltip title="創建訊息傳遞">
                  <IconButton 
                    size={isMobile ? 'small' : 'medium'}
                    onClick={() => setCreateRoomOpen(true)}
                  >
                    <AddIcon fontSize={isMobile ? 'small' : 'medium'} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : rooms.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  沒有訊息傳遞
                </Typography>
              </Box>
            ) : (
              <List>
                {rooms.map((room) => (
                  <ListItem
                    key={room.id}
                    button
                    selected={selectedRoom?.id === room.id}
                    onClick={() => setSelectedRoom(room)}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              fontWeight: (room.unread_count || 0) > 0 ? 600 : 400,
                              flex: 1
                            }}
                          >
                            {room.name}
                          </Typography>
                          {(room.unread_count || 0) > 0 && (
                            <Badge 
                              badgeContent={room.unread_count} 
                              color="error" 
                              max={99}
                              sx={{ '& .MuiBadge-badge': { fontSize: '0.7rem', minWidth: '18px', height: '18px' } }}
                            />
                          )}
                        </Box>
                      }
                      secondary={`${room.member_count || 0} 位成員`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Paper>

        {/* 聊天內容區域 */}
        {selectedRoom ? (
          <Box 
            sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              minWidth: 0, // 防止 flex item 溢出
              height: '100%',
              maxHeight: '100%'
            }}
          >
            {/* 訊息傳遞標題欄 */}
            <Paper
              sx={{
                p: { xs: 1.5, sm: 2 },
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
                minHeight: { xs: '56px', sm: '64px' }
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {selectedRoom.name}
                </Typography>
                {selectedRoom.description && (
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {selectedRoom.description}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexShrink: 0, gap: 0.5 }}>
                <Tooltip title="刷新訊息和未讀數量">
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (selectedRoom) {
                        fetchMessages();
                      }
                      fetchRooms(true);
                    }}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                {isRoomAdmin && (
                  <>
                    <Tooltip title="成員管理">
                      <IconButton 
                        size={isMobile ? 'small' : 'medium'}
                        onClick={() => setMembersOpen(true)}
                      >
                        <PersonAddIcon fontSize={isMobile ? 'small' : 'medium'} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="設定">
                      <IconButton 
                        size={isMobile ? 'small' : 'medium'}
                        onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}
                      >
                        <SettingsIcon fontSize={isMobile ? 'small' : 'medium'} />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Paper>

            {/* 訊息列表 */}
            <Box
              ref={messagesContainerRef}
              sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                p: { xs: 1, sm: 2 },
                backgroundColor: theme.palette.background.default,
                minHeight: 0 // 允許 flex item 縮小
              }}
            >
              {messages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.user_id === user.id ? 'flex-end' : 'flex-start',
                    mb: 2
                  }}
                >
                  <Paper
                    sx={{
                      p: { xs: 1, sm: 1.5 },
                      maxWidth: { xs: '85%', sm: '70%' },
                      backgroundColor: message.user_id === user.id
                        ? theme.palette.primary.main
                        : theme.palette.background.paper,
                      color: message.user_id === user.id ? 'white' : 'inherit'
                    }}
                  >
                    {message.user_id !== user.id && (
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}>
                        {message.display_name || message.employee_number}
                      </Typography>
                    )}
                    {message.message && (
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {message.message}
                      </Typography>
                    )}
                    {message.file_name && (
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getFileIcon(message.file_type)}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {message.original_file_name || message.file_name}
                          </Typography>
                          <Typography variant="caption">
                            {formatFileSize(message.file_size)}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadFile(message)}
                          sx={{ color: 'inherit' }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                      {formatTime(message.created_at)}
                    </Typography>
                  </Paper>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Box>

            {/* 輸入區域 */}
            <Paper 
              sx={{ 
                p: { xs: 1.5, sm: 2 }, 
                borderTop: `1px solid ${theme.palette.divider}`,
                flexShrink: 0
              }}
            >
              {selectedFile && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`${selectedFile.name} (${formatFileSize(selectedFile.size)})`}
                    onDelete={handleRemoveFile}
                    deleteIcon={<CloseIcon />}
                  />
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: { xs: 0.5, sm: 1 }, alignItems: 'flex-end' }}>
                <input
                  type="file"
                  ref={(ref) => setFileInputRef(ref)}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                />
                <IconButton 
                  size={isMobile ? 'small' : 'medium'}
                  onClick={() => fileInputRef?.click()}
                  sx={{ flexShrink: 0 }}
                >
                  <AttachFileIcon fontSize={isMobile ? 'small' : 'medium'} />
                </IconButton>
                <TextField
                  fullWidth
                  multiline
                  maxRows={isMobile ? 3 : 4}
                  placeholder="輸入訊息..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={sending}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{ minWidth: 0 }} // 允許 TextField 縮小
                />
                <IconButton
                  color="primary"
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                  size={isMobile ? 'small' : 'medium'}
                  sx={{ flexShrink: 0 }}
                >
                  {sending ? (
                    <CircularProgress size={isMobile ? 20 : 24} />
                  ) : (
                    <SendIcon fontSize={isMobile ? 'small' : 'medium'} />
                  )}
                </IconButton>
              </Box>
            </Paper>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.palette.background.default
            }}
          >
            <Typography variant="h6" color="text.secondary">
              請選擇一個訊息傳遞
            </Typography>
          </Box>
        )}
      </Box>

      {/* 創建訊息傳遞對話框 */}
      <Dialog open={createRoomOpen} onClose={() => setCreateRoomOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>創建訊息傳遞</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="訊息傳遞名稱"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="描述（選填）"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateRoomOpen(false)}>取消</Button>
          <Button
            onClick={handleCreateRoom}
            variant="contained"
            disabled={!formData.name.trim() || loading}
          >
            創建
          </Button>
        </DialogActions>
      </Dialog>

      {/* 成員管理對話框 */}
      <Dialog open={membersOpen} onClose={() => setMembersOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>成員管理</DialogTitle>
        <DialogContent>
          <List>
            {selectedRoom?.members?.map((member) => (
              <ListItem key={member.user_id}>
                <ListItemAvatar>
                  <Avatar>{member.display_name?.[0] || member.employee_number?.[0] || 'U'}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={member.display_name || `${member.surname} ${member.given_name}`}
                  secondary={member.employee_number}
                />
                {member.is_admin && (
                  <Chip label="管理員" size="small" color="primary" sx={{ mr: 1 }} />
                )}
                {isRoomAdmin && member.user_id !== user.id && (
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveMember(member.user_id)}
                    >
                      <PersonRemoveIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          {isRoomAdmin && (
            <Button
              startIcon={<PersonAddIcon />}
              onClick={() => {
                setMembersOpen(false);
                setUserSearchOpen(true);
              }}
            >
              添加成員
            </Button>
          )}
          <Button onClick={() => setMembersOpen(false)}>關閉</Button>
        </DialogActions>
      </Dialog>

      {/* 設定選單 */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={() => setSettingsMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          setSettingsMenuAnchor(null);
          setEditRoomOpen(true);
        }}>
          <EditIcon sx={{ mr: 1 }} />
          編輯訊息傳遞
        </MenuItem>
        <MenuItem onClick={async () => {
          setSettingsMenuAnchor(null);
          const result = await Swal.fire({
            title: '確認刪除',
            text: '確定要刪除這個訊息傳遞嗎？此操作無法復原。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '確定',
            cancelButtonText: '取消'
          });
          if (result.isConfirmed) {
            try {
              await axios.delete(`/api/chat/${selectedRoom.id}`);
              await Swal.fire({
                icon: 'success',
                title: '成功',
                text: '訊息傳遞已刪除',
                confirmButtonText: '確定'
              });
              setSelectedRoom(null);
              fetchRooms();
            } catch (error) {
              Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: error.response?.data?.message || '刪除訊息傳遞時發生錯誤',
                confirmButtonText: '確定'
              });
            }
          }
        }}>
          <DeleteIcon sx={{ mr: 1 }} />
          刪除訊息傳遞
        </MenuItem>
      </Menu>

      {/* 編輯訊息傳遞對話框 */}
      <Dialog open={editRoomOpen} onClose={() => setEditRoomOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>編輯訊息傳遞</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="訊息傳遞名稱"
            value={selectedRoom?.name || ''}
            onChange={(e) => setSelectedRoom({ ...selectedRoom, name: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="描述（選填）"
            value={selectedRoom?.description || ''}
            onChange={(e) => setSelectedRoom({ ...selectedRoom, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRoomOpen(false)}>取消</Button>
          <Button
            onClick={async () => {
              try {
                await axios.put(`/api/chat/${selectedRoom.id}`, {
                  name: selectedRoom.name,
                  description: selectedRoom.description
                });
                await Swal.fire({
                  icon: 'success',
                  title: '成功',
                  text: '訊息傳遞已更新',
                  confirmButtonText: '確定'
                });
                setEditRoomOpen(false);
                fetchRoomDetail();
              } catch (error) {
                Swal.fire({
                  icon: 'error',
                  title: '錯誤',
                  text: error.response?.data?.message || '更新訊息傳遞時發生錯誤',
                  confirmButtonText: '確定'
                });
              }
            }}
            variant="contained"
          >
            儲存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 用戶搜尋對話框 */}
      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onSelect={handleAddMember}
      />

      {/* 發送給個人對話框 */}
      <UserSearchDialog
        open={sendToIndividualOpen}
        onClose={() => setSendToIndividualOpen(false)}
        onSelect={handleSendToIndividual}
      />
    </Layout>
  );
};

export default ChatRoom;

