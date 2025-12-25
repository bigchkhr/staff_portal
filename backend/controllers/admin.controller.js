const User = require('../database/models/User');
const LeaveType = require('../database/models/LeaveType');
const LeaveBalance = require('../database/models/LeaveBalance');
const LeaveBalanceTransaction = require('../database/models/LeaveBalanceTransaction');
const Department = require('../database/models/Department');
const Position = require('../database/models/Position');
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
        hire_date,
        deactivated
      } = req.body;

      if (!employee_number || !surname || !given_name || !name_zh || !password) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      // 只有在提供 email 時才檢查是否重複
      if (email) {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: '電子郵件已被使用' });
        }
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
        // 如果提供了 display_name（非空字串）就使用它，否則使用 name_zh 作為 fallback
        display_name: (req.body.display_name && req.body.display_name.trim()) || name_zh,
        email: email || null, // email 為可選，如果沒有提供則設為 null
        password_hash: passwordHash,
        department_id: department_id || null,
        position_id: position_id || null,
        hire_date: hire_date || null,
        // 帳戶是否停用（預設為未停用，可由 HR/System Admin 指定）
        deactivated: deactivated !== undefined ? !!deactivated : false
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

      // display_name 和 name_zh 是獨立的欄位，不自動同步
      // 只有在新增用戶時（createUser），如果沒有提供 display_name，才使用 name_zh 作為 fallback

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
      const { department_id, search } = req.query;
      const options = {};

      if (department_id) options.department_id = department_id;
      if (search) options.search = search;

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
      // 管理頁面需要顯示所有假期類型，包括未啟用的
      const leaveTypes = await knex('leave_types')
        .orderBy('name');

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

      // 獲取當前總餘額
      const currentTotal = await LeaveBalanceTransaction.getTotalBalance(
        user_id,
        leave_type_id,
        currentYear
      );
      
      // 計算需要添加的數量
      const amount = parseFloat(balance) - currentTotal;
      
      if (amount !== 0) {
        // 創建交易記錄
        await LeaveBalanceTransaction.create({
          user_id,
          leave_type_id,
          year: currentYear,
          amount,
          remarks: `管理員設定餘額`,
          created_by_id: req.user.id
        });
      }

      // 獲取更新後的餘額信息
      const balanceInfo = await LeaveBalance.findByUserAndType(
        user_id,
        leave_type_id,
        currentYear
      );

      res.json({
        message: '假期餘額已更新',
        balance: balanceInfo
      });
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({ message: '更新假期餘額時發生錯誤', error: error.message });
    }
  }

  async addBalanceTransaction(req, res) {
    try {
      const { user_id, leave_type_id, amount, year, remarks, start_date, end_date } = req.body;
      const currentYear = year || new Date().getFullYear();

      // console.log('addBalanceTransaction request:', { user_id, leave_type_id, amount, year: currentYear, start_date, end_date });

      if (!user_id || !leave_type_id || amount === undefined || parseFloat(amount) === 0) {
        return res.status(400).json({ message: '請填寫所有必填欄位，且數量不能為0' });
      }

      // 驗證日期範圍
      if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
        return res.status(400).json({ message: '有效開始日期不能晚於結束日期' });
      }

      // 創建交易記錄
      const transaction = await LeaveBalanceTransaction.create({
        user_id,
        leave_type_id,
        year: currentYear,
        amount: parseFloat(amount),
        start_date: start_date || null,
        end_date: end_date || null,
        remarks: remarks || null,
        created_by_id: req.user.id
      });

      console.log('Transaction created:', transaction);

      // 獲取更新後的餘額信息
      const balanceInfo = await LeaveBalance.findByUserAndType(
        user_id,
        leave_type_id,
        currentYear
      );

      console.log('Balance info:', balanceInfo);

      res.json({
        message: '假期餘額交易已添加',
        transaction,
        balance: balanceInfo
      });
    } catch (error) {
      console.error('Add balance transaction error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '添加假期餘額交易時發生錯誤', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async getBalanceTransactions(req, res) {
    try {
      const { user_id, leave_type_id, year } = req.query;
      const currentYear = year || new Date().getFullYear();

      console.log('getBalanceTransactions request:', { user_id, leave_type_id, year: currentYear });

      if (!user_id) {
        return res.status(400).json({ message: '請提供用戶ID' });
      }

      let transactions;
      if (leave_type_id) {
        transactions = await LeaveBalanceTransaction.findByUserAndType(
          user_id,
          leave_type_id,
          currentYear
        );
      } else {
        transactions = await LeaveBalanceTransaction.findByUser(user_id, currentYear);
      }

      console.log('Transactions found:', transactions?.length || 0);

      res.json({ transactions: transactions || [], year: currentYear });
    } catch (error) {
      console.error('Get balance transactions error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '獲取假期餘額交易記錄時發生錯誤', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  async updateBalanceTransaction(req, res) {
    try {
      const { id } = req.params;
      const { amount, year, remarks, start_date, end_date } = req.body;

      console.log('updateBalanceTransaction request:', { id, amount, year, start_date, end_date });

      // 檢查交易是否存在
      const existingTransaction = await LeaveBalanceTransaction.findById(id);
      if (!existingTransaction) {
        return res.status(404).json({ message: '交易記錄不存在' });
      }

      // 驗證必填欄位
      if (amount === undefined || parseFloat(amount) === 0) {
        return res.status(400).json({ message: '數量不能為0' });
      }

      // 驗證日期範圍
      const finalStartDate = start_date || existingTransaction.start_date;
      const finalEndDate = end_date || existingTransaction.end_date;
      
      if (finalStartDate && finalEndDate && new Date(finalStartDate) > new Date(finalEndDate)) {
        return res.status(400).json({ message: '有效開始日期不能晚於結束日期' });
      }

      // 構建更新數據
      const updateData = {};
      if (amount !== undefined) updateData.amount = parseFloat(amount);
      if (year !== undefined) updateData.year = year;
      if (remarks !== undefined) updateData.remarks = remarks;
      if (start_date !== undefined) updateData.start_date = start_date;
      if (end_date !== undefined) updateData.end_date = end_date;

      // 更新交易記錄
      const updatedTransaction = await LeaveBalanceTransaction.update(id, updateData);

      console.log('Transaction updated:', updatedTransaction);

      // 獲取更新後的餘額信息
      const balanceInfo = await LeaveBalance.findByUserAndType(
        existingTransaction.user_id,
        existingTransaction.leave_type_id,
        updatedTransaction.year || existingTransaction.year
      );

      console.log('Balance info:', balanceInfo);

      res.json({
        message: '假期餘額交易已更新',
        transaction: updatedTransaction,
        balance: balanceInfo
      });
    } catch (error) {
      console.error('Update balance transaction error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        message: '更新假期餘額交易時發生錯誤', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
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
}

module.exports = new AdminController();
