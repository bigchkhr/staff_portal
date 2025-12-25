const jwt = require('jsonwebtoken');
const User = require('../database/models/User');
const DepartmentGroup = require('../database/models/DepartmentGroup');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '未提供認證令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: '用戶不存在' });
    }

    // 如果帳戶已停用，拒絕所有後續請求
    if (user.deactivated) {
      return res.status(403).json({ message: '此帳戶已被停用' });
    }

    // 根據群組資料設定權限
    const [delegationGroups, departmentGroups] = await Promise.all([
      User.getDelegationGroups(user.id),
      DepartmentGroup.findByUserId(user.id)
    ]);
    const delegationGroupIds = delegationGroups.map(group => Number(group.id));

    const isHRMember = await User.isHRMember(user.id);
    const isDeptHead = departmentGroups.some(group =>
      (group.approver_1_id && delegationGroupIds.includes(Number(group.approver_1_id))) ||
      (group.approver_2_id && delegationGroupIds.includes(Number(group.approver_2_id))) ||
      (group.approver_3_id && delegationGroupIds.includes(Number(group.approver_3_id)))
    );

    req.user = {
      ...user,
      is_system_admin: isHRMember,
      is_dept_head: isDeptHead,
      department_groups: departmentGroups,
      delegation_groups: delegationGroups
    };

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