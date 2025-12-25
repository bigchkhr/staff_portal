require('dotenv').config();

// 驗證環境變數
console.log('=== Environment Variables Check ===');
console.log('PORT:', process.env.PORT || '8080 (default)');
// console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ SET (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET');
// console.log('DB_HOST:', process.env.DB_HOST || 'localhost (default)');
// console.log('NODE_ENV:', process.env.NODE_ENV || 'development (default)');
// console.log('====================================\n');

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set!');
  console.error('Please create backend/.env file with JWT_SECRET');
  console.error('The server will continue but login will fail.');
}

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const leaveRoutes = require('./routes/leave.routes');
const departmentRoutes = require('./routes/department.routes');
const positionRoutes = require('./routes/position.routes');
const groupRoutes = require('./routes/group.routes');
const leaveTypeRoutes = require('./routes/leaveType.routes');
const approvalRoutes = require('./routes/approval.routes');
const adminRoutes = require('./routes/admin.routes');
const documentRoutes = require('./routes/document.routes');
const todoRoutes = require('./routes/todo.routes');
const formLibraryRoutes = require('./routes/formLibrary.routes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/leave-types', leaveTypeRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/form-library', formLibraryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Leave Administration System API' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

