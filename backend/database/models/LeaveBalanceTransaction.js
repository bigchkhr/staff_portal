const knex = require('../../config/database');

class LeaveBalanceTransaction {
  static async create(transactionData) {
    try {
      // 驗證必填欄位
      if (!transactionData.start_date || !transactionData.end_date) {
        throw new Error('有效開始日期和結束日期為必填項目');
      }

      // 驗證日期格式和邏輯
      const startDate = new Date(transactionData.start_date);
      const endDate = new Date(transactionData.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('有效日期格式不正確');
      }
      
      if (endDate < startDate) {
        throw new Error('有效結束日期不能早於開始日期');
      }

      const [transaction] = await knex('leave_balance_transactions')
        .insert(transactionData)
        .returning('*');
      return transaction;
    } catch (error) {
      console.error('LeaveBalanceTransaction.create error:', error);
      throw error;
    }
  }

  static async findByUserAndType(userId, leaveTypeId, year) {
    try {
      return await knex('leave_balance_transactions')
        .leftJoin('users as creator', 'leave_balance_transactions.created_by_id', 'creator.id')
        .select(
          'leave_balance_transactions.*',
          'creator.name_zh as created_by_name',
          'creator.employee_number as created_by_employee_number'
        )
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .whereNotNull('leave_balance_transactions.created_by_id') // 只返回 HR 成員創建的記錄
        .orderBy('leave_balance_transactions.created_at', 'desc');
    } catch (error) {
      console.error('findByUserAndType error:', error);
      // 如果表不存在，返回空數組
      if (error.message && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  static async findByUser(userId, year) {
    try {
      return await knex('leave_balance_transactions')
        .leftJoin('leave_types', 'leave_balance_transactions.leave_type_id', 'leave_types.id')
        .leftJoin('users as creator', 'leave_balance_transactions.created_by_id', 'creator.id')
        .select(
          'leave_balance_transactions.*',
          'leave_types.code as leave_type_code',
          'leave_types.name_zh as leave_type_name_zh',
          'creator.name_zh as created_by_name',
          'creator.employee_number as created_by_employee_number'
        )
        .where({
          user_id: userId,
          year
        })
        .whereNotNull('leave_balance_transactions.created_by_id') // 只返回 HR 成員創建的記錄
        .orderBy('leave_balance_transactions.created_at', 'desc');
    } catch (error) {
      console.error('findByUser error:', error);
      // 如果表不存在，返回空數組
      if (error.message && error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }
  }

  static async getTotalBalance(userId, leaveTypeId, year) {
    try {
      const result = await knex('leave_balance_transactions')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .whereNotNull('created_by_id') // 只計算 HR 成員創建的記錄
        .sum('amount as total')
        .first();
      
      // PostgreSQL 的 sum 在沒有記錄時返回 null
      const total = result?.total;
      if (total === null || total === undefined) {
        return 0;
      }
      return parseFloat(total);
    } catch (error) {
      console.error('getTotalBalance error:', error);
      // 如果表不存在，返回 0
      if (error.message && error.message.includes('does not exist')) {
        return 0;
      }
      throw error;
    }
  }

  // 檢查指定日期是否在有效假期餘額範圍內
  static async isDateWithinValidPeriod(userId, leaveTypeId, applicationDate) {
    try {
      const date = new Date(applicationDate);
      const year = date.getFullYear();
      
      const validTransactions = await knex('leave_balance_transactions')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .where('amount', '>', 0) // 只檢查正數交易（餘額分配）
        .whereNotNull('created_by_id') // 只檢查 HR 成員創建的記錄
        .where('start_date', '<=', date)
        .where('end_date', '>=', date);
      
      return validTransactions.length > 0;
    } catch (error) {
      console.error('isDateWithinValidPeriod error:', error);
      return false;
    }
  }

  // 取得適用於指定申請期間的有效餘額總額
  // year 參數：如果提供，則使用該年份的餘額；否則使用申請日期的年份
  static async getValidBalanceForPeriod(userId, leaveTypeId, startDate, endDate, year = null) {
    try {
      // 如果提供了年份參數，使用該年份；否則從開始日期取得年份
      const targetYear = year !== null ? year : new Date(startDate).getFullYear();
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 找出所有與申請期間重疊的有效餘額交易（只考慮 HR 成員創建的記錄）
      const validTransactions = await knex('leave_balance_transactions')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year: targetYear
        })
        .where('amount', '>', 0) // 只計算正數交易（分配的餘額）
        .whereNotNull('created_by_id') // 只考慮 HR 成員創建的記錄
        .where(function() {
          // 交易有效期與申請期間有重疊
          this.where(function() {
            this.where('start_date', '<=', end)
              .andWhere('end_date', '>=', start);
          });
        });
      
      const totalValidBalance = validTransactions.reduce((sum, transaction) => {
        return sum + parseFloat(transaction.amount);
      }, 0);
      
      return totalValidBalance;
    } catch (error) {
      console.error('getValidBalanceForPeriod error:', error);
      return 0;
    }
  }

  static async findById(id) {
    try {
      const transaction = await knex('leave_balance_transactions')
        .leftJoin('leave_types', 'leave_balance_transactions.leave_type_id', 'leave_types.id')
        .leftJoin('users as creator', 'leave_balance_transactions.created_by_id', 'creator.id')
        .select(
          'leave_balance_transactions.*',
          'leave_types.code as leave_type_code',
          'leave_types.name_zh as leave_type_name_zh',
          'creator.name_zh as created_by_name',
          'creator.employee_number as created_by_employee_number'
        )
        .where('leave_balance_transactions.id', id)
        .first();
      return transaction;
    } catch (error) {
      console.error('findById error:', error);
      throw error;
    }
  }

  static async update(id, updateData) {
    try {
      // 如果更新了日期，驗證日期格式和邏輯
      if (updateData.start_date || updateData.end_date) {
        const transaction = await knex('leave_balance_transactions')
          .where('id', id)
          .first();
        
        const startDate = new Date(updateData.start_date || transaction.start_date);
        const endDate = new Date(updateData.end_date || transaction.end_date);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('有效日期格式不正確');
        }
        
        if (endDate < startDate) {
          throw new Error('有效結束日期不能早於開始日期');
        }
      }

      const [updated] = await knex('leave_balance_transactions')
        .where('id', id)
        .update(updateData)
        .returning('*');
      
      return updated;
    } catch (error) {
      console.error('LeaveBalanceTransaction.update error:', error);
      throw error;
    }
  }
}

module.exports = LeaveBalanceTransaction;

