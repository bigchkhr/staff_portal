const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/chatUpload');

// 所有路由都需要認證
router.use(authenticate);

// 獲取用戶加入的聊天室列表
router.get('/my-rooms', chatController.getMyChatRooms);

// 獲取未讀訊息數量（所有聊天室）
router.get('/unread-count', chatController.getUnreadCount);

// 獲取每個聊天室的未讀訊息數量
router.get('/unread-counts', chatController.getUnreadCountsByRoom);

// 獲取所有聊天室（僅 HR Group 成員）
router.get('/all', isSystemAdmin, chatController.getAllChatRooms);

// 創建聊天室（僅 HR Group 成員）
router.post('/', isSystemAdmin, chatController.createChatRoom);

// 獲取單個聊天室詳情
router.get('/:id', chatController.getChatRoomById);

// 更新聊天室（僅 HR Group 成員且為管理員）
router.put('/:id', isSystemAdmin, chatController.updateChatRoom);

// 刪除聊天室（僅 HR Group 成員且為管理員）
router.delete('/:id', isSystemAdmin, chatController.deleteChatRoom);

// 添加成員到聊天室（僅 HR Group 成員且為管理員）
router.post('/:id/members', isSystemAdmin, chatController.addMember);

// 移除成員（僅 HR Group 成員且為管理員）
router.delete('/:id/members/:userId', isSystemAdmin, chatController.removeMember);

// 獲取聊天室訊息
router.get('/:id/messages', chatController.getMessages);

// 發送訊息（可包含附件）
router.post('/:id/messages', uploadSingle.single('file'), chatController.sendMessage);

// 刪除訊息（僅發送者或 HR Group 成員且為管理員）
router.delete('/:id/messages/:messageId', chatController.deleteMessage);

// 下載訊息附件（必須在 /:id/messages/:messageId 之前，避免路由衝突）
router.get('/:id/messages/:messageId/download', chatController.downloadFile);

module.exports = router;

