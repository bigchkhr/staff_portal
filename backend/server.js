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

// CORS Configuration - 允許所有來源
const corsOptions = {
  origin: true, // 允許所有來源
  credentials: true, // 允許發送 cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Content-Type', 'Content-Disposition']
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
const publicHolidayRoutes = require('./routes/publicHoliday.routes');
const externalLinkRoutes = require('./routes/externalLink.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const newsRoutes = require('./routes/news.routes');
const newsGroupRoutes = require('./routes/newsGroup.routes');
const contactRoutes = require('./routes/contact.routes');

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
app.use('/api/public-holidays', publicHolidayRoutes);
app.use('/api/external-links', externalLinkRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/news-groups', newsGroupRoutes);
app.use('/api/contacts', contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Leave Administration System API' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('=== CORS Configuration ===');
  console.log('允許的來源: 所有來源 (無限制)');
  console.log('環境:', process.env.NODE_ENV || 'development');
  console.log('==========================');
});

