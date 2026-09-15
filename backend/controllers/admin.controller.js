const User = require('../database/models/User');
const LeaveType = require('../database/models/LeaveType');
const LeaveBalance = require('../database/models/LeaveBalance');
const LeaveBalanceTransaction = require('../database/models/LeaveBalanceTransaction');
const Department = require('../database/models/Department');
const Position = require('../database/models/Position');
const { hashPassword } = require('../utils/password');
const knex = require('../config/database');
const { toHKCalendarDate } = require('../utils/hkDate');
const { normalizeTokenExpires } = require('../utils/jwt');
const { calculateAnnualLeaveForYear } = require('../utils/annualLeave');

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
        termination_date,
        deactivated,
        force_password_change,
        token_expires_value,
        token_expires_unit,
        al_base_days,
        al_cap_days
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
      const tokenExpires = normalizeTokenExpires(token_expires_value, token_expires_unit);

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
        hire_date: hire_date ? toHKCalendarDate(hire_date) : null,
        termination_date:
          termination_date && String(termination_date).trim()
            ? toHKCalendarDate(String(termination_date).trim())
            : null,
        // 帳戶是否停用（預設為未停用，可由 HR/System Admin 指定）
        deactivated: deactivated !== undefined ? !!deactivated : false,
        // 是否強制首次登入更改密碼（預設為 false，可由 HR/System Admin 指定）
        force_password_change: force_password_change !== undefined ? !!force_password_change : false,
        token_expires_value: tokenExpires.token_expires_value,
        token_expires_unit: tokenExpires.token_expires_unit,
        al_base_days:
          al_base_days === '' || al_base_days === null || al_base_days === undefined
            ? null
            : parseFloat(al_base_days),
        al_cap_days:
          al_cap_days === '' || al_cap_days === null || al_cap_days === undefined
            ? null
            : parseFloat(al_cap_days)
      };

      const user = await User.create(userData);

      res.status(201).json({
        message: '用戶已建立',
        user
      });
    } catch (error) {
      console.error('Create user error:', error);
      if (error.statusCode === 400) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: '建立用戶時發生錯誤', error: error.message });
    }
  }

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (Object.prototype.hasOwnProperty.call(updateData, 'termination_date')) {
        const td = updateData.termination_date;
        updateData.termination_date =
          td && String(td).trim() ? toHKCalendarDate(String(td).trim()) : null;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'hire_date')) {
        const hd = updateData.hire_date;
        updateData.hire_date =
          hd && String(hd).trim() ? toHKCalendarDate(String(hd).trim()) : null;
      }

      if (
        Object.prototype.hasOwnProperty.call(updateData, 'token_expires_unit') ||
        Object.prototype.hasOwnProperty.call(updateData, 'token_expires_value')
      ) {
        const tokenExpires = normalizeTokenExpires(
          updateData.token_expires_value,
          updateData.token_expires_unit
        );
        updateData.token_expires_value = tokenExpires.token_expires_value;
        updateData.token_expires_unit = tokenExpires.token_expires_unit;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'al_base_days')) {
        const v = updateData.al_base_days;
        updateData.al_base_days =
          v === '' || v === null || v === undefined ? null : parseFloat(v);
      }
      if (Object.prototype.hasOwnProperty.call(updateData, 'al_cap_days')) {
        const v = updateData.al_cap_days;
        updateData.al_cap_days =
          v === '' || v === null || v === undefined ? null : parseFloat(v);
      }

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
      if (error.statusCode === 400) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: '更新用戶時發生錯誤', error: error.message });
    }
  }

  async getUsers(req, res) {
    try {
      const { department_id, search, page, limit } = req.query;
      const options = {};

      if (department_id) options.department_id = department_id;
      if (search) options.search = search;
      
      // 分頁參數
      if (page) options.page = parseInt(page);
      if (limit) options.limit = parseInt(limit);

      const result = await User.findAll(options);

      res.json({
        users: result.users,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: '獲取用戶列表時發生錯誤' });
    }
  }

  async createLeaveType(req, res) {
    try {
      const { code, name, name_zh, requires_balance, allow_schedule_input, is_active } = req.body;

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
        requires_balance: requires_balance !== undefined ? requires_balance : true,
        allow_schedule_input: allow_schedule_input !== undefined ? allow_schedule_input : false,
        is_active: is_active !== undefined ? is_active : true
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

      if (!user_id || !leave_type_id || amount === undefined || amount === null || amount === '') {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
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
      if (amount !== undefined && (amount === null || amount === '')) {
        return res.status(400).json({ message: '數量不能為空' });
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
      const { name, name_zh, description, display_order } = req.body;

      if (!name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      const positionData = { name, name_zh, description };
      if (display_order !== undefined) {
        positionData.display_order = parseInt(display_order) || 0;
      }

      const position = await Position.create(positionData);

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
      const updateData = { ...req.body };

      // 處理 display_order 轉換為整數
      if (updateData.display_order !== undefined) {
        updateData.display_order = parseInt(updateData.display_order) || 0;
      }

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

  // ===== Stores 管理 =====
  async getStores(req, res) {
    try {
      const stores = await knex('stores').orderBy('store_code');
      res.json({ stores });
    } catch (error) {
      console.error('Get stores error:', error);
      res.status(500).json({ message: '獲取店舖列表時發生錯誤', error: error.message });
    }
  }

  async createStore(req, res) {
    try {
      const {
        store_code,
        store_short_name_,
        address_en,
        address_chi,
        tel,
        email,
        open_date,
        close_date,
        district,
        is_closed
      } = req.body;

      if (!store_code) {
        return res.status(400).json({ message: '請填寫店舖編號（store_code）' });
      }

      const existing = await knex('stores').where('store_code', store_code).first('id');
      if (existing) {
        return res.status(400).json({ message: '店舖編號已被使用' });
      }

      const insertData = {
        store_code: String(store_code).trim(),
        store_short_name_: store_short_name_ ? String(store_short_name_).trim() : null,
        address_en: address_en || null,
        address_chi: address_chi || null,
        tel: tel || null,
        email: email || null,
        open_date: open_date || null,
        close_date: close_date || null,
        district: district || null,
        is_closed: is_closed !== undefined ? !!is_closed : false
      };

      const [store] = await knex('stores').insert(insertData).returning('*');

      res.status(201).json({
        message: '店舖已建立',
        store
      });
    } catch (error) {
      console.error('Create store error:', error);
      res.status(500).json({ message: '建立店舖時發生錯誤', error: error.message });
    }
  }

  async updateStore(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (updateData.store_code) {
        updateData.store_code = String(updateData.store_code).trim();
        const existing = await knex('stores')
          .where('store_code', updateData.store_code)
          .andWhereNot('id', id)
          .first('id');
        if (existing) {
          return res.status(400).json({ message: '店舖編號已被使用' });
        }
      }

      if (updateData.store_short_name_ !== undefined && updateData.store_short_name_ !== null) {
        updateData.store_short_name_ = String(updateData.store_short_name_).trim();
      }

      if (updateData.is_closed !== undefined) {
        updateData.is_closed = !!updateData.is_closed;
      }

      await knex('stores').where('id', id).update(updateData);
      const store = await knex('stores').where('id', id).first();

      res.json({
        message: '店舖已更新',
        store
      });
    } catch (error) {
      console.error('Update store error:', error);
      res.status(500).json({ message: '更新店舖時發生錯誤', error: error.message });
    }
  }

  async deleteStore(req, res) {
    try {
      const { id } = req.params;
      const deleted = await knex('stores').where('id', id).del();
      if (!deleted) {
        return res.status(404).json({ message: '店舖不存在' });
      }
      res.json({ message: '店舖已刪除' });
    } catch (error) {
      console.error('Delete store error:', error);
      res.status(500).json({ message: '刪除店舖時發生錯誤', error: error.message });
    }
  }

  /**
   * 年假批量試算（不寫入資料庫）
   * GET /api/admin/annual-leave/preview?year=2026&leave_type_id=
   */
  async previewAnnualLeaveBulk(req, res) {
    try {
      const year = parseInt(req.query.year, 10) || new Date().getFullYear();
      let leaveTypeId = req.query.leave_type_id ? parseInt(req.query.leave_type_id, 10) : null;

      let leaveType = null;
      if (leaveTypeId) {
        leaveType = await LeaveType.findById(leaveTypeId);
      } else {
        leaveType =
          (await LeaveType.findByCode('AL')) ||
          (await knex('leave_types').where('name_zh', 'like', '%年假%').first());
        leaveTypeId = leaveType ? leaveType.id : null;
      }

      if (!leaveType) {
        return res.status(400).json({ message: '找不到年假假期類型，請先設定 leave type（如 AL）' });
      }

      const users = await knex('users')
        .leftJoin('positions', 'users.position_id', 'positions.id')
        .select(
          'users.id',
          'users.employee_number',
          'users.display_name',
          'users.name_zh',
          'users.hire_date',
          'users.termination_date',
          'users.deactivated',
          'users.al_base_days',
          'users.al_cap_days',
          'positions.name as position_name',
          'positions.name_zh as position_name_zh'
        )
        .where('users.deactivated', false)
        .orderBy('users.employee_number', 'asc');

      const existingRows = await knex('leave_balance_transactions')
        .select('user_id')
        .sum('amount as total')
        .where({ leave_type_id: leaveType.id, year })
        .groupBy('user_id');

      const existingMap = {};
      existingRows.forEach((row) => {
        existingMap[row.user_id] = parseFloat(row.total) || 0;
      });

      const items = users.map((user) => {
        const calc = calculateAnnualLeaveForYear(user, year);
        const existingTotal = existingMap[user.id] || 0;
        if (existingTotal !== 0) {
          calc.warnings.push('has_existing_balance');
        }
        return {
          ...calc,
          position_name: user.position_name || null,
          position_name_zh: user.position_name_zh || null,
          existing_balance: existingTotal,
          selected_default:
            calc.selectable && existingTotal === 0 && !user.deactivated
        };
      });

      res.json({
        year,
        leave_type: leaveType,
        start_date: `${year}-01-01`,
        end_date: `${year}-12-31`,
        items
      });
    } catch (error) {
      console.error('Preview annual leave bulk error:', error);
      res.status(500).json({ message: '年假試算時發生錯誤', error: error.message });
    }
  }

  /**
   * 確認後批量寫入年假額度
   * POST /api/admin/annual-leave/bulk
   * body: { year, leave_type_id, start_date, end_date, items: [{ user_id, amount }] }
   */
  async confirmAnnualLeaveBulk(req, res) {
    try {
      const { year, leave_type_id, start_date, end_date, items, remarks } = req.body;
      const targetYear = parseInt(year, 10) || new Date().getFullYear();

      if (!leave_type_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: '請提供假期類型及至少一筆員工資料' });
      }

      const leaveType = await LeaveType.findById(leave_type_id);
      if (!leaveType) {
        return res.status(400).json({ message: '假期類型不存在' });
      }

      const validStart = start_date || `${targetYear}-01-01`;
      const validEnd = end_date || `${targetYear}-12-31`;
      if (new Date(validStart) > new Date(validEnd)) {
        return res.status(400).json({ message: '有效開始日期不能晚於結束日期' });
      }

      const created = [];
      const skipped = [];

      for (const item of items) {
        const userId = item.user_id;
        const amount = parseFloat(item.amount);
        if (!userId || !Number.isFinite(amount) || amount <= 0) {
          skipped.push({ user_id: userId, reason: 'invalid_amount' });
          continue;
        }

        const transaction = await LeaveBalanceTransaction.create({
          user_id: userId,
          leave_type_id: leaveType.id,
          year: targetYear,
          amount,
          start_date: validStart,
          end_date: validEnd,
          remarks:
            item.remarks ||
            remarks ||
            `${targetYear}年度年假批量發放`,
          created_by_id: req.user.id
        });
        created.push(transaction);
      }

      res.json({
        message: `已成功發放 ${created.length} 筆年假額度`,
        created_count: created.length,
        skipped_count: skipped.length,
        created,
        skipped
      });
    } catch (error) {
      console.error('Confirm annual leave bulk error:', error);
      res.status(500).json({ message: '批量發放年假時發生錯誤', error: error.message });
    }
  }
}

module.exports = new AdminController();
