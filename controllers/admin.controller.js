const User = require('../database/models/User');
const LeaveType = require('../database/models/LeaveType');
const LeaveBalance = require('../database/models/LeaveBalance');
const Department = require('../database/models/Department');
const Position = require('../database/models/Position');
const Group = require('../database/models/Group');
const { hashPassword } = require('../utils/password');
const knex = require('../config/database');

class AdminController {
  async createUser(req, res) {
    try {
      const {
        employee_number,
        surname,
        given_name,
        alias,
        name_zh,
        email,
        password,
        department_id,
        position_id,
        group_id,
        is_system_admin,
        is_dept_head,
        checker_id,
        approver_1_id,
        approver_2_id,
        approver_3_id
      } = req.body;

      if (!employee_number || !surname || !given_name || !name_zh || !email || !password) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: '電子郵件已被使用' });
      }

      const existingEmployeeNumber = await User.findByEmployeeNumber(employee_number);
      if (existingEmployeeNumber) {
        return res.status(400).json({ message: '員工編號已被使用' });
      }

      const passwordHash = await hashPassword(password);

      const userData = {
        employee_number,
        surname,
        given_name,
        alias,
        name_zh,
        email,
        password_hash: passwordHash,
        department_id: department_id || null,
        position_id: position_id || null,
        group_id: group_id || null,
        is_system_admin: is_system_admin || false,
        is_dept_head: is_dept_head || false,
        checker_id: checker_id || null,
        approver_1_id: approver_1_id || null,
        approver_2_id: approver_2_id || null,
        approver_3_id: approver_3_id || null
      };

      const user = await User.create(userData);

      res.status(201).json({
        message: '用戶已建立',
        user
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: '建立用戶時發生錯誤', error: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (updateData.password) {
        updateData.password_hash = await hashPassword(updateData.password);
        delete updateData.password;
      }

      const user = await User.update(id, updateData);

      res.json({
        message: '用戶已更新',
        user
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: '更新用戶時發生錯誤', error: error.message });
    }
  }

  async getUsers(req, res) {
    try {
      const { department_id, search, is_active } = req.query;
      const options = {};

      if (department_id) options.department_id = department_id;
      if (search) options.search = search;
      if (is_active !== undefined) options.is_active = is_active === 'true';

      const users = await User.findAll(options);

      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: '獲取用戶列表時發生錯誤' });
    }
  }

  async createLeaveType(req, res) {
    try {
      const { code, name, name_zh, requires_balance } = req.body;

      if (!code || !name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const existingType = await LeaveType.findByCode(code);
      if (existingType) {
        return res.status(400).json({ message: '假期類型代碼已被使用' });
      }

      const leaveType = await LeaveType.create({
        code,
        name,
        name_zh,
        requires_balance: requires_balance !== undefined ? requires_balance : true
      });

      res.status(201).json({
        message: '假期類型已建立',
        leaveType
      });
    } catch (error) {
      console.error('Create leave type error:', error);
      res.status(500).json({ message: '建立假期類型時發生錯誤', error: error.message });
    }
  }

  async updateLeaveType(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const leaveType = await LeaveType.update(id, updateData);

      res.json({
        message: '假期類型已更新',
        leaveType
      });
    } catch (error) {
      console.error('Update leave type error:', error);
      res.status(500).json({ message: '更新假期類型時發生錯誤', error: error.message });
    }
  }

  async getLeaveTypes(req, res) {
    try {
      const leaveTypes = await LeaveType.findAll();

      res.json({ leaveTypes });
    } catch (error) {
      console.error('Get leave types error:', error);
      res.status(500).json({ message: '獲取假期類型列表時發生錯誤' });
    }
  }

  async updateBalance(req, res) {
    try {
      const { user_id, leave_type_id, balance, year } = req.body;
      const currentYear = year || new Date().getFullYear();

      if (!user_id || !leave_type_id || balance === undefined) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const balanceRecord = await LeaveBalance.updateOrCreate(user_id, leave_type_id, currentYear, {
        balance: parseFloat(balance)
      });

      res.json({
        message: '假期餘額已更新',
        balance: balanceRecord
      });
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({ message: '更新假期餘額時發生錯誤', error: error.message });
    }
  }

  async createDepartment(req, res) {
    try {
      const { name, name_zh, description } = req.body;

      if (!name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const department = await Department.create({ name, name_zh, description });

      res.status(201).json({
        message: '部門已建立',
        department
      });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(500).json({ message: '建立部門時發生錯誤', error: error.message });
    }
  }

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const department = await Department.update(id, updateData);

      res.json({
        message: '部門已更新',
        department
      });
    } catch (error) {
      console.error('Update department error:', error);
      res.status(500).json({ message: '更新部門時發生錯誤', error: error.message });
    }
  }

  async getDepartments(req, res) {
    try {
      const departments = await Department.findAll();

      res.json({ departments });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({ message: '獲取部門列表時發生錯誤' });
    }
  }

  async createPosition(req, res) {
    try {
      const { name, name_zh, description } = req.body;

      if (!name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const position = await Position.create({ name, name_zh, description });

      res.status(201).json({
        message: '職位已建立',
        position
      });
    } catch (error) {
      console.error('Create position error:', error);
      res.status(500).json({ message: '建立職位時發生錯誤', error: error.message });
    }
  }

  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const position = await Position.update(id, updateData);

      res.json({
        message: '職位已更新',
        position
      });
    } catch (error) {
      console.error('Update position error:', error);
      res.status(500).json({ message: '更新職位時發生錯誤', error: error.message });
    }
  }

  async getPositions(req, res) {
    try {
      const positions = await Position.findAll();

      res.json({ positions });
    } catch (error) {
      console.error('Get positions error:', error);
      res.status(500).json({ message: '獲取職位列表時發生錯誤' });
    }
  }

  async createGroup(req, res) {
    try {
      const { name, name_zh, description } = req.body;

      if (!name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const group = await Group.create({ name, name_zh, description });

      res.status(201).json({
        message: '群組已建立',
        group
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ message: '建立群組時發生錯誤', error: error.message });
    }
  }

  async updateGroup(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const group = await Group.update(id, updateData);

      res.json({
        message: '群組已更新',
        group
      });
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ message: '更新群組時發生錯誤', error: error.message });
    }
  }

  async getGroups(req, res) {
    try {
      const groups = await Group.findAll();

      res.json({ groups });
    } catch (error) {
      console.error('Get groups error:', error);
      res.status(500).json({ message: '獲取群組列表時發生錯誤' });
    }
  }
}

module.exports = new AdminController();

