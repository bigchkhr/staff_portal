const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/chatUpload');

// 聊天 API 請求日誌中間件
const chatRequestLogger = (req, res, next) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const userId = req.user?.id || 'unknown';
  const method = req.method;
  const path = req.path;
  const fullPath = req.originalUrl || req.url;
  
  console.log(`📨 [CHAT REQUEST] 開始 - 用戶 ID: ${userId}, 方法: ${method}, 路徑: ${fullPath}, 時間: ${timestamp}`);
  
  // 記錄響應完成
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    const statusIcon = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
    
    // 記錄 rate limit 信息（從響應頭獲取）
    const rateLimitRemaining = res.getHeader('X-RateLimit-Remaining');
    const rateLimitLimit = res.getHeader('X-RateLimit-Limit');
    const rateLimitReset = res.getHeader('X-RateLimit-Reset');
    
    let rateLimitInfo = '';
    if (rateLimitRemaining !== undefined && rateLimitLimit !== undefined) {
      const remaining = parseInt(rateLimitRemaining);
      const limit = parseInt(rateLimitLimit);
      const used = limit - remaining;
      rateLimitInfo = `, Rate Limit: ${used}/${limit} (剩餘: ${remaining})`;
      
      // 如果剩餘配額少於 3，發出警告
      if (remaining <= 3 && remaining > 0) {
        console.log(`⚠️ [CHAT RATE LIMIT] 警告 - 用戶 ID: ${userId}, 剩餘配額: ${remaining}/${limit}, 路徑: ${fullPath}`);
      }
    }
    
    console.log(`${statusIcon} [CHAT REQUEST] 完成 - 用戶 ID: ${userId}, 方法: ${method}, 路徑: ${fullPath}, 狀態: ${status}, 耗時: ${duration}ms${rateLimitInfo}, 時間: ${new Date().toISOString()}`);
  });
  
  next();
};

// 所有路由都需要認證
router.use(authenticate);

// 在所有聊天路由上應用請求日誌
router.use(chatRequestLogger);

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

