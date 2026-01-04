require('dotenv').config();

// 驗證環境變數
console.log('=== Environment Variables Check ===');
console.log('PORT:', process.env.PORT || '8080 (default)');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development (default)');
console.log('====================================\n');

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set!');
  console.error('Please create backend/.env file with JWT_SECRET');
  console.error('The server will continue but login will fail.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
  helmetConfig,
  apiLimiter,
  requestSizeLimit,
  securityLogger
} = require('./middleware/security');

const app = express();

// 安全頭設置
app.use(helmetConfig);

// 安全日誌記錄
if (process.env.NODE_ENV === 'production') {
  app.use(securityLogger);
}

// 信任代理（如果使用 nginx 或 load balancer）
app.set('trust proxy', 1);

// CORS Configuration
// 支持多個允許的來源（用逗號分隔）
let allowedOrigins = [];

if (process.env.ALLOWED_ORIGINS) {
  // 如果設置了 ALLOWED_ORIGINS，使用設置的值
  allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
} else {
  // 如果沒有設置，根據環境決定
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
    // 生產環境：使用默認的本地來源（應該在生產環境明確設置 ALLOWED_ORIGINS）
    allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    console.warn('⚠️  警告: 生產環境未設置 ALLOWED_ORIGINS，建議在 .env 中明確設置');
  } else {
    // 開發環境：使用默認的本地來源
    allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
  }
}

// 如果有 CloudFront URL，也加入允許列表
if (process.env.CLOUDFRONT_URL) {
  allowedOrigins.push(process.env.CLOUDFRONT_URL);
}

// 如果有前端 URL，也加入允許列表
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

const corsOptions = {
  origin: function (origin, callback) {
    // 允許沒有 origin 的請求（例如：Postman、移動應用、服務器端請求）
    if (!origin) return callback(null, true);
    
    // 開發環境且未設置 ALLOWED_ORIGINS 時，允許所有來源（方便開發）
    if (process.env.NODE_ENV !== 'production' && !process.env.ALLOWED_ORIGINS) {
      return callback(null, true);
    }
    
    // 檢查 origin 是否在允許列表中
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 開發環境下顯示警告，生產環境下拒絕
      if (process.env.NODE_ENV === 'development') {
        console.warn(`⚠️  CORS: 未允許的來源: ${origin}`);
        console.log('允許的來源:', allowedOrigins);
        // 開發環境下仍然允許（方便調試）
        callback(null, true);
      } else {
        // 生產環境下拒絕
        callback(new Error('不允許的 CORS 來源'));
      }
    }
  },
  credentials: true, // 允許發送 cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Middleware
app.use(cors(corsOptions));

// 請求大小限制（防止記憶體耗盡攻擊）
app.use(express.json(requestSizeLimit.json));
app.use(express.urlencoded(requestSizeLimit.urlencoded));

// API Rate Limiting
app.use('/api', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leaveRoutes = require('./routes/leave.routes');
const extraWorkingHoursRoutes = require('./routes/extraWorkingHours.routes');
const outdoorWorkRoutes = require('./routes/outdoorWork.routes');
const departmentRoutes = require('./routes/department.routes');
const positionRoutes = require('./routes/position.routes');
const groupRoutes = require('./routes/group.routes');
const leaveTypeRoutes = require('./routes/leaveType.routes');
const approvalRoutes = require('./routes/approval.routes');
const adminRoutes = require('./routes/admin.routes');
const documentRoutes = require('./routes/document.routes');
const todoRoutes = require('./routes/todo.routes');
const formLibraryRoutes = require('./routes/formLibrary.routes');
const announcementRoutes = require('./routes/announcement.routes');
const publicHolidayRoutes = require('./routes/publicHoliday.routes');
const externalLinkRoutes = require('./routes/externalLink.routes');
const scheduleRoutes = require('./routes/schedule.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/extra-working-hours', extraWorkingHoursRoutes);
app.use('/api/outdoor-work', outdoorWorkRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/form-library', formLibraryRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/public-holidays', publicHolidayRoutes);
app.use('/api/external-links', externalLinkRoutes);
app.use('/api/schedules', scheduleRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Leave Administration System API' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('=== CORS Configuration ===');
  console.log('允許的來源:', allowedOrigins);
  if (process.env.CLOUDFRONT_URL) {
    console.log('CloudFront URL:', process.env.CLOUDFRONT_URL);
  }
  console.log('==========================');
});

