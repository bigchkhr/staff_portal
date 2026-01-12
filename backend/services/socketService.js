const jwt = require('jsonwebtoken');
const User = require('../database/models/User');

class SocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.roomSockets = new Map(); // roomId -> Set of socketIds
  }

  initialize(server) {
    const { Server } = require('socket.io');
    this.io = new Server(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('未提供認證令牌'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.deactivated) {
          return next(new Error('用戶不存在或已被停用'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('認證失敗'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] User ${socket.userId} connected: ${socket.id}`);

      // 將 socket 添加到用戶的 socket 集合
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // 處理加入聊天室
      socket.on('join_room', (roomId) => {
        socket.join(`room_${roomId}`);
        console.log(`[Socket] User ${socket.userId} joined room ${roomId}`);
        
        // 記錄房間的 socket
        if (!this.roomSockets.has(roomId)) {
          this.roomSockets.set(roomId, new Set());
        }
        this.roomSockets.get(roomId).add(socket.id);
      });

      // 處理離開聊天室
      socket.on('leave_room', (roomId) => {
        socket.leave(`room_${roomId}`);
        console.log(`[Socket] User ${socket.userId} left room ${roomId}`);
        
        if (this.roomSockets.has(roomId)) {
          this.roomSockets.get(roomId).delete(socket.id);
        }
      });

      // 處理斷開連接
      socket.on('disconnect', () => {
        console.log(`[Socket] User ${socket.userId} disconnected: ${socket.id}`);
        
        // 從用戶的 socket 集合中移除
        if (this.userSockets.has(socket.userId)) {
          this.userSockets.get(socket.userId).delete(socket.id);
          if (this.userSockets.get(socket.userId).size === 0) {
            this.userSockets.delete(socket.userId);
          }
        }

        // 從所有房間中移除
        this.roomSockets.forEach((socketSet, roomId) => {
          socketSet.delete(socket.id);
        });
      });
    });

    return this.io;
  }

  // 發送新訊息到聊天室的所有成員
  emitNewMessage(roomId, message) {
    if (this.io) {
      this.io.to(`room_${roomId}`).emit('new_message', message);
      console.log(`[Socket] Emitted new message to room ${roomId}`);
    }
  }

  // 更新聊天室的未讀數量
  emitUnreadUpdate(userId, unreadCounts) {
    if (this.io && this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId);
      sockets.forEach(socketId => {
        this.io.to(socketId).emit('unread_update', unreadCounts);
      });
      console.log(`[Socket] Emitted unread update to user ${userId}`);
    }
  }

  // 通知聊天室成員有新訊息（用於更新未讀數量）
  notifyRoomMembers(roomId, excludeUserId = null) {
    if (this.io) {
      this.io.to(`room_${roomId}`).emit('room_update', { roomId, excludeUserId });
      console.log(`[Socket] Notified room ${roomId} members (excluding ${excludeUserId})`);
    }
  }
}

module.exports = new SocketService();

