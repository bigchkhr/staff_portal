const jwt = require('jsonwebtoken');
const User = require('../database/models/User');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '未提供認證令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: '用戶不存在或已被停用' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: '無效的認證令牌' });
  }
};

const isSystemAdmin = (req, res, next) => {
  req.user?.is_system_admin ? next() : res.status(403).json({ message: '需要系統管理員權限' });
};

const isDeptHead = (req, res, next) => {
  req.user?.is_dept_head ? next() : res.status(403).json({ message: '需要部門主管權限' });
};

const isSystemAdminOrDeptHead = (req, res, next) => {
  (req.user?.is_system_admin || req.user?.is_dept_head) ? next() : res.status(403).json({ message: '需要管理權限' });
};

module.exports = {
  authenticate,
  isSystemAdmin,
  isDeptHead,
  isSystemAdminOrDeptHead
};

