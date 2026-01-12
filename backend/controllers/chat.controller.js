const ChatRoom = require('../database/models/ChatRoom');
const ChatMessage = require('../database/models/ChatMessage');
const User = require('../database/models/User');
const fs = require('fs');

class ChatController {
  // 獲取所有訊息傳遞（用戶加入的）
  async getMyChatRooms(req, res) {
    try {
      const rooms = await ChatRoom.findAll(req.user.id);
      const unreadCounts = await ChatRoom.getUnreadCountsByRoom(req.user.id);
      
      // 為每個訊息傳遞添加未讀數量
      const roomsWithUnread = rooms.map(room => ({
        ...room,
        unread_count: unreadCounts[room.id] || 0
      }));
      
      res.json({ rooms: roomsWithUnread });
    } catch (error) {
      console.error('Get my chat rooms error:', error);
      res.status(500).json({ message: '獲取訊息傳遞列表時發生錯誤', error: error.message });
    }
  }

  // 獲取所有訊息傳遞（僅 HR Group 成員）
  async getAllChatRooms(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以查看所有訊息傳遞' });
      }

      const rooms = await ChatRoom.findAll();
      res.json({ rooms });
    } catch (error) {
      console.error('Get all chat rooms error:', error);
      res.status(500).json({ message: '獲取訊息傳遞列表時發生錯誤', error: error.message });
    }
  }

  // 獲取單個訊息傳遞詳情
  async getChatRoomById(req, res) {
    try {
      const { id } = req.params;
      const room = await ChatRoom.findById(id);
      
      if (!room) {
        return res.status(404).json({ message: '訊息傳遞不存在' });
      }

      // 檢查用戶是否為訊息傳遞成員
      const isMember = await ChatRoom.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: '您不是此訊息傳遞的成員' });
      }

      // 獲取成員列表
      const members = await ChatRoom.getMembers(id);
      room.members = members;

      res.json({ room });
    } catch (error) {
      console.error('Get chat room by id error:', error);
      res.status(500).json({ message: '獲取訊息傳遞詳情時發生錯誤', error: error.message });
    }
  }

  // 創建訊息傳遞（僅 HR Group 成員）
  async createChatRoom(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以創建訊息傳遞' });
      }

      const { name, description, member_ids } = req.body;

      if (!name || (typeof name === 'string' && name.trim() === '')) {
        return res.status(400).json({ message: '請輸入訊息傳遞名稱' });
      }

      const roomData = {
        name: typeof name === 'string' ? name.trim() : name,
        description: description ? (typeof description === 'string' ? description.trim() : description) : null,
        created_by_id: req.user.id
      };

      const room = await ChatRoom.create(roomData);

      // 將創建者添加為管理員
      await ChatRoom.addMember(room.id, req.user.id, true);

      // 如果有指定成員，添加他們
      if (member_ids && Array.isArray(member_ids)) {
        const addMemberPromises = member_ids
          .filter(id => id !== req.user.id) // 避免重複添加創建者
          .map(userId => ChatRoom.addMember(room.id, userId, false));
        await Promise.all(addMemberPromises);
      }

      // 返回完整的訊息傳遞信息
      const fullRoom = await ChatRoom.findById(room.id);
      const members = await ChatRoom.getMembers(room.id);
      fullRoom.members = members;

      res.status(201).json({
        message: '訊息傳遞創建成功',
        room: fullRoom
      });
    } catch (error) {
      console.error('Create chat room error:', error);
      res.status(500).json({ message: '創建訊息傳遞時發生錯誤', error: error.message });
    }
  }

  // 更新訊息傳遞（僅 HR Group 成員且為管理員）
  async updateChatRoom(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以更新訊息傳遞' });
      }

      // 檢查是否為訊息傳遞管理員
      const isAdmin = await ChatRoom.isAdmin(id, req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ message: '只有訊息傳遞管理員可以更新訊息傳遞' });
      }

      const room = await ChatRoom.findById(id);
      if (!room) {
        return res.status(404).json({ message: '訊息傳遞不存在' });
      }

      const updateData = {};
      if (name !== undefined) {
        updateData.name = typeof name === 'string' ? name.trim() : name;
      }
      if (description !== undefined) {
        updateData.description = description ? (typeof description === 'string' ? description.trim() : description) : null;
      }

      const updatedRoom = await ChatRoom.update(id, updateData);
      res.json({ message: '訊息傳遞更新成功', room: updatedRoom });
    } catch (error) {
      console.error('Update chat room error:', error);
      res.status(500).json({ message: '更新訊息傳遞時發生錯誤', error: error.message });
    }
  }

  // 刪除訊息傳遞（僅 HR Group 成員且為管理員）
  async deleteChatRoom(req, res) {
    try {
      const { id } = req.params;

      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除訊息傳遞' });
      }

      // 檢查是否為訊息傳遞管理員
      const isAdmin = await ChatRoom.isAdmin(id, req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ message: '只有訊息傳遞管理員可以刪除訊息傳遞' });
      }

      const room = await ChatRoom.findById(id);
      if (!room) {
        return res.status(404).json({ message: '訊息傳遞不存在' });
      }

      await ChatRoom.delete(id);
      res.json({ message: '訊息傳遞刪除成功' });
    } catch (error) {
      console.error('Delete chat room error:', error);
      res.status(500).json({ message: '刪除訊息傳遞時發生錯誤', error: error.message });
    }
  }

  // 添加成員到訊息傳遞（僅 HR Group 成員且為管理員）
  async addMember(req, res) {
    try {
      const { id } = req.params;
      const { user_id } = req.body;

      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以添加成員' });
      }

      // 檢查是否為訊息傳遞管理員
      const isAdmin = await ChatRoom.isAdmin(id, req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ message: '只有訊息傳遞管理員可以添加成員' });
      }

      if (!user_id) {
        return res.status(400).json({ message: '請提供用戶ID' });
      }

      const room = await ChatRoom.findById(id);
      if (!room) {
        return res.status(404).json({ message: '訊息傳遞不存在' });
      }

      // 檢查用戶是否已經是成員
      const isMember = await ChatRoom.isMember(id, user_id);
      if (isMember) {
        return res.status(400).json({ message: '該用戶已經是訊息傳遞成員' });
      }

      await ChatRoom.addMember(id, user_id, false);
      res.json({ message: '成員添加成功' });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({ message: '添加成員時發生錯誤', error: error.message });
    }
  }

  // 移除成員（僅 HR Group 成員且為管理員）
  async removeMember(req, res) {
    try {
      const { id, userId } = req.params;

      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以移除成員' });
      }

      // 檢查是否為訊息傳遞管理員
      const isAdmin = await ChatRoom.isAdmin(id, req.user.id);
      if (!isAdmin) {
        return res.status(403).json({ message: '只有訊息傳遞管理員可以移除成員' });
      }

      const room = await ChatRoom.findById(id);
      if (!room) {
        return res.status(404).json({ message: '訊息傳遞不存在' });
      }

      // 不能移除自己
      if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ message: '不能移除自己' });
      }

      await ChatRoom.removeMember(id, userId);
      res.json({ message: '成員移除成功' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ message: '移除成員時發生錯誤', error: error.message });
    }
  }

  // 獲取訊息傳遞訊息
  async getMessages(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // 檢查用戶是否為訊息傳遞成員
      const isMember = await ChatRoom.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: '您不是此訊息傳遞的成員' });
      }

      const messages = await ChatMessage.findByRoomId(id, {
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      // 反轉順序，讓最新的訊息在最後
      messages.reverse();

      // 更新用戶最後讀取時間
      await ChatRoom.updateLastReadAt(id, req.user.id);

      res.json({ messages });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({ message: '獲取訊息時發生錯誤', error: error.message });
    }
  }

  // 獲取未讀訊息數量（所有訊息傳遞）
  async getUnreadCount(req, res) {
    try {
      const count = await ChatRoom.getUnreadCount(req.user.id);
      res.json({ unreadCount: count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ message: '獲取未讀訊息數量時發生錯誤', error: error.message });
    }
  }

  // 獲取每個訊息傳遞的未讀訊息數量
  async getUnreadCountsByRoom(req, res) {
    try {
      const counts = await ChatRoom.getUnreadCountsByRoom(req.user.id);
      res.json({ unreadCounts: counts });
    } catch (error) {
      console.error('Get unread counts by room error:', error);
      res.status(500).json({ message: '獲取未讀訊息數量時發生錯誤', error: error.message });
    }
  }

  // 發送訊息
  async sendMessage(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      console.log('[sendMessage] Request params:', { id, message: message ? 'has message' : 'no message' });
      console.log('[sendMessage] User ID:', req.user.id);
      console.log('[sendMessage] Has file:', !!req.file);

      // 檢查用戶是否為訊息傳遞成員
      const isMember = await ChatRoom.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: '您不是此訊息傳遞的成員' });
      }

      // 必須有訊息內容或附件
      if ((!message || (typeof message === 'string' && message.trim() === '')) && !req.file) {
        return res.status(400).json({ message: '請輸入訊息內容或上傳附件' });
      }

      const messageData = {
        chat_room_id: parseInt(id),
        user_id: req.user.id,
        message: message ? (typeof message === 'string' ? message.trim() : message) : null
      };

      // 如果有附件
      if (req.file) {
        messageData.file_name = req.file.filename;
        messageData.file_path = req.file.path;
        messageData.file_type = req.file.mimetype;
        messageData.file_size = req.file.size;
        messageData.original_file_name = req.file.originalname;
        console.log('[sendMessage] File info:', {
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size
        });
      }

      console.log('[sendMessage] Message data:', { ...messageData, message: messageData.message ? 'has message' : 'no message' });

      const newMessage = await ChatMessage.create(messageData);
      console.log('[sendMessage] Message created successfully:', newMessage.id);
      
      res.status(201).json({
        message: '訊息發送成功',
        chatMessage: newMessage
      });
    } catch (error) {
      console.error('Send message error:', error);
      console.error('Error stack:', error.stack);
      
      // 如果文件已上傳但處理失敗，刪除文件
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('[sendMessage] Deleted uploaded file after error');
        } catch (unlinkError) {
          console.error('Error deleting uploaded file:', unlinkError);
        }
      }

      res.status(500).json({ 
        message: '發送訊息時發生錯誤', 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  // 刪除訊息（僅發送者或 HR Group 成員且為管理員）
  async deleteMessage(req, res) {
    try {
      const { id, messageId } = req.params;

      // 檢查用戶是否為訊息傳遞成員
      const isMember = await ChatRoom.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: '您不是此訊息傳遞的成員' });
      }

      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        return res.status(404).json({ message: '訊息不存在' });
      }

      // 檢查是否為訊息發送者或管理員
      const isHRMember = await User.isHRMember(req.user.id);
      const isAdmin = await ChatRoom.isAdmin(id, req.user.id);
      const isSender = chatMessage.user_id === req.user.id;

      if (!isSender && !(isHRMember && isAdmin)) {
        return res.status(403).json({ message: '只有訊息發送者或管理員可以刪除訊息' });
      }

      // 如果有附件，刪除文件
      if (chatMessage.file_path && fs.existsSync(chatMessage.file_path)) {
        try {
          fs.unlinkSync(chatMessage.file_path);
        } catch (unlinkError) {
          console.error('Error deleting message file:', unlinkError);
        }
      }

      await ChatMessage.delete(messageId);
      res.json({ message: '訊息刪除成功' });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({ message: '刪除訊息時發生錯誤', error: error.message });
    }
  }

  // 下載訊息附件
  async downloadFile(req, res) {
    try {
      const { id, messageId } = req.params;

      // 檢查用戶是否為訊息傳遞成員
      const isMember = await ChatRoom.isMember(id, req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: '您不是此訊息傳遞的成員' });
      }

      const chatMessage = await ChatMessage.findById(messageId);
      if (!chatMessage) {
        return res.status(404).json({ message: '訊息不存在' });
      }

      if (!chatMessage.file_path || !fs.existsSync(chatMessage.file_path)) {
        return res.status(404).json({ message: '檔案不存在' });
      }

      // 設置響應頭
      const fileName = chatMessage.original_file_name || chatMessage.file_name;
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Content-Type', chatMessage.file_type || 'application/octet-stream');

      // 發送文件
      res.sendFile(chatMessage.file_path, { root: '.' });
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ message: '下載檔案時發生錯誤', error: error.message });
    }
  }
}

module.exports = new ChatController();

