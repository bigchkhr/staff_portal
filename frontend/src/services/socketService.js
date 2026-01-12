import { io } from 'socket.io-client';
import axios from 'axios';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token) {
    // 如果已經連接，直接返回
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    // 如果已有 socket 但未連接，先斷開
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    const baseURL = axios.defaults.baseURL || 'http://localhost:1689';
    // 解析 baseURL
    const urlMatch = baseURL.match(/^(https?):\/\/([^:]+)(?::(\d+))?/);
    const protocol = urlMatch ? urlMatch[1] : 'http';
    const hostname = urlMatch ? urlMatch[2] : 'localhost';
    const port = urlMatch && urlMatch[3] ? urlMatch[3] : (protocol === 'https' ? '443' : '1689');

    const socketURL = `${protocol}://${hostname}:${port}`;

    this.socket = io(socketURL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      this.isConnected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  joinRoom(roomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join_room', roomId);
      console.log(`[Socket] Joined room ${roomId}`);
    }
  }

  leaveRoom(roomId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave_room', roomId);
      console.log(`[Socket] Left room ${roomId}`);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      
      // 記錄監聽器以便清理
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
        // 從記錄中移除
        const callbacks = this.listeners.get(event) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        // 移除該事件的所有監聽器
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => {
          this.socket.off(event, cb);
        });
        this.listeners.delete(event);
      }
    }
  }
}

// 導出單例實例
const socketService = new SocketService();
export default socketService;

