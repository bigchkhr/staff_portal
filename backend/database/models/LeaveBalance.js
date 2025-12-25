const knex = require('../../config/database');
const LeaveBalanceTransaction = require('./LeaveBalanceTransaction');

class LeaveBalance {
  static async findByUserAndType(userId, leaveTypeId, year) {
    // 從交易記錄計算總餘額（只有 HR Group 成員輸入的額度）
    const totalBalance = await LeaveBalanceTransaction.getTotalBalance(userId, leaveTypeId, year);
    
    // 計算已使用的天數
    // 已使用 = 從 leave_applications 表計算已批准的申請天數 - 銷假的天數
    let taken = 0;
    try {
      // 計算所有已批准的申請（不包括銷假交易）
      // 使用 whereNull 或 where 來確保正確匹配 false 和 null 值
      const approvedResult = await knex('leave_applications')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .where('status', 'approved')
        .where(function() {
          // 匹配 is_reversal_transaction 為 false 或 null（正常申請）
          this.where('is_reversal_transaction', false)
              .orWhereNull('is_reversal_transaction');
        })
        .sum('total_days as total')
        .first();
      
      let approved = 0;
      if (approvedResult?.total !== null && approvedResult?.total !== undefined) {
        approved = parseFloat(approvedResult.total);
      }

      // 計算所有銷假的天數（退回餘額）
      // 銷假申請的 is_reversal_transaction 為 true
      const reversalResult = await knex('leave_applications')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .where('status', 'approved')
        .where('is_reversal_transaction', true)
        .select(knex.raw('SUM(ABS(total_days)) as total'))
        .first();
      
      let reversed = 0;
      if (reversalResult?.total !== null && reversalResult?.total !== undefined) {
        reversed = parseFloat(reversalResult.total);
      }

      // 已使用 = 已批准的總額 - 銷假的總額
      taken = Math.max(0, approved - reversed);
    } catch (error) {
      console.error('Error calculating taken days:', error);
      // 如果出錯，taken 保持為 0
    }
    
    // 可用餘額 = 總餘額（HR 輸入的額度）- 已使用的天數（允許負數）
    const balance = totalBalance - taken;
    
    return {
      user_id: userId,
      leave_type_id: leaveTypeId,
      year,
      balance,
      taken,
      total: totalBalance
    };
  }

  static async findByUser(userId, year) {
    // 獲取所有假期類型
    const leaveTypes = await knex('leave_types')
      .where('requires_balance', true)
      .orderBy('name');
    
    // 為每個假期類型計算總餘額
    const balances = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const totalBalance = await LeaveBalanceTransaction.getTotalBalance(
          userId,
          leaveType.id,
          year
        );
        
        // 計算已使用的天數
        // 已使用 = 從 leave_applications 表計算已批准的申請天數 - 銷假的天數
        let taken = 0;
        try {
          // 計算所有已批准的申請（不包括銷假交易）
          // 使用 whereNull 或 where 來確保正確匹配 false 和 null 值
          const approvedResult = await knex('leave_applications')
            .where({
              user_id: userId,
              leave_type_id: leaveType.id,
              year
            })
            .where('status', 'approved')
            .where(function() {
              // 匹配 is_reversal_transaction 為 false 或 null（正常申請）
              this.where('is_reversal_transaction', false)
                  .orWhereNull('is_reversal_transaction');
            })
            .sum('total_days as total')
            .first();
          
          let approved = 0;
          if (approvedResult?.total !== null && approvedResult?.total !== undefined) {
            approved = parseFloat(approvedResult.total);
          }

          // 計算所有銷假的天數（退回餘額）
          // 銷假申請的 is_reversal_transaction 為 true
          const reversalResult = await knex('leave_applications')
            .where({
              user_id: userId,
              leave_type_id: leaveType.id,
              year
            })
            .where('status', 'approved')
            .where('is_reversal_transaction', true)
            .select(knex.raw('SUM(ABS(total_days)) as total'))
            .first();
          
          let reversed = 0;
          if (reversalResult?.total !== null && reversalResult?.total !== undefined) {
            reversed = parseFloat(reversalResult.total);
          }

          // 已使用 = 已批准的總額 - 銷假的總額
          taken = Math.max(0, approved - reversed);
        } catch (error) {
          console.error('Error calculating taken days:', error);
          // 如果出錯，taken 保持為 0
        }
        
        // 可用餘額 = 總餘額（HR 輸入的額度）- 已使用的天數（允許負數）
        const balance = totalBalance - taken;
        
        // 獲取有效期信息（從所有正數交易中獲取最早開始日期和最晚結束日期，只考慮 HR 成員創建的記錄）
        let start_date = null;
        let end_date = null;
        try {
          const positiveTransactions = await knex('leave_balance_transactions')
            .where({
              user_id: userId,
              leave_type_id: leaveType.id,
              year
            })
            .where('amount', '>', 0)
            .whereNotNull('created_by_id') // 只考慮 HR 成員創建的記錄
            .select('start_date', 'end_date');
          
          if (positiveTransactions && positiveTransactions.length > 0) {
            // 找出最早的開始日期和最晚的結束日期
            // 直接比較日期字符串（YYYY-MM-DD 格式），避免時區轉換問題
            const startDates = positiveTransactions.map(t => t.start_date).filter(d => d);
            const endDates = positiveTransactions.map(t => t.end_date).filter(d => d);
            
            if (startDates.length > 0) {
              // 排序並取最早的日期
              startDates.sort();
              start_date = startDates[0];
            }
            
            if (endDates.length > 0) {
              // 排序並取最晚的日期
              endDates.sort();
              end_date = endDates[endDates.length - 1];
            }
          }
        } catch (error) {
          console.error('Error getting validity period:', error);
          // 如果出錯，有效期保持為 null
        }
        
        return {
          user_id: userId,
          leave_type_id: leaveType.id,
          year,
          balance,
          taken,
          total: totalBalance,
          leave_type_code: leaveType.code,
          leave_type_name: leaveType.name,
          leave_type_name_zh: leaveType.name_zh,
          requires_balance: leaveType.requires_balance,
          start_date,
          end_date
        };
      })
    );
    
    // 過濾掉沒有交易記錄的假期類型
    return balances.filter(b => b.total !== 0 || b.taken > 0);
  }

  // 以下方法保留以保持向後兼容，但不再使用
  static async create(balanceData) {
    // 不再使用，改為使用交易記錄
    throw new Error('此方法已廢棄，請使用 LeaveBalanceTransaction.create');
  }

  static async update(id, balanceData) {
    // 不再使用，改為使用交易記錄
    throw new Error('此方法已廢棄，請使用 LeaveBalanceTransaction.create');
  }

  static async updateOrCreate(userId, leaveTypeId, year, balanceData) {
    // 不再使用，改為使用交易記錄
    throw new Error('此方法已廢棄，請使用 LeaveBalanceTransaction.create');
  }

  // 扣除餘額：檢查餘額是否足夠（不創建交易記錄，因為申請獲批不應錄入 leave_balance_transactions）
  static async decrementBalance(userId, leaveTypeId, year, days, remarks = '假期申請已批准，扣除餘額', applicationStartDate = null, applicationEndDate = null) {
    // 檢查當前餘額是否足夠
    const balanceInfo = await this.findByUserAndType(userId, leaveTypeId, year);
    const daysToDeduct = parseFloat(days);
    
    if (balanceInfo.balance < daysToDeduct) {
      throw new Error('假期餘額不足');
    }

    // 如果提供了申請日期，檢查是否在有效期內
    // 使用 year 參數確保檢查的是該年份的餘額有效期
    if (applicationStartDate && applicationEndDate) {
      const validBalance = await LeaveBalanceTransaction.getValidBalanceForPeriod(
        userId, 
        leaveTypeId, 
        applicationStartDate, 
        applicationEndDate,
        year  // 傳入年份參數，確保檢查的是該年份的餘額有效期
      );
      
      // 計算該期間已使用的天數
      const usedInPeriod = await this.getUsedDaysInPeriod(userId, leaveTypeId, applicationStartDate, applicationEndDate);
      const availableInPeriod = validBalance - usedInPeriod;
      
      if (availableInPeriod < daysToDeduct) {
        throw new Error(`申請日期不在${year}年假期餘額有效期範圍內，或可用餘額不足`);
      }
    }

    // 不創建交易記錄，因為申請獲批不應錄入 leave_balance_transactions
    // 餘額會從 leave_applications 表自動計算

    // 返回更新後的餘額信息
    return await this.findByUserAndType(userId, leaveTypeId, year);
  }

  // 增加餘額：不創建交易記錄（因為銷假是通過 leave_applications 表記錄的）
  static async incrementBalance(userId, leaveTypeId, year, days, remarks = '假期申請被拒絕或取消，退回餘額', startDate = null, endDate = null) {
    // 不創建交易記錄，因為銷假是通過 leave_applications 表記錄的
    // 餘額會從 leave_applications 表自動計算

    // 返回更新後的餘額信息
    return await this.findByUserAndType(userId, leaveTypeId, year);
  }

  // 輔助方法：計算指定期間內已使用的天數
  static async getUsedDaysInPeriod(userId, leaveTypeId, startDate, endDate) {
    try {
      const year = new Date(startDate).getFullYear();
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // 計算所有在該期間內已批准的申請（不包括銷假交易）
      // 使用 whereNull 或 where 來確保正確匹配 false 和 null 值
      const approvedResult = await knex('leave_applications')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .where('status', 'approved')
        .where(function() {
          // 匹配 is_reversal_transaction 為 false 或 null（正常申請）
          this.where('is_reversal_transaction', false)
              .orWhereNull('is_reversal_transaction');
        })
        .where(function() {
          // 申請期間與指定期間有重疊
          this.where(function() {
            this.where('start_date', '<=', end)
              .andWhere('end_date', '>=', start);
          });
        })
        .sum('total_days as total')
        .first();
      
      let approved = 0;
      if (approvedResult?.total !== null && approvedResult?.total !== undefined) {
        approved = parseFloat(approvedResult.total);
      }

      // 計算所有在該期間內銷假的天數
      const reversalResult = await knex('leave_applications')
        .where({
          user_id: userId,
          leave_type_id: leaveTypeId,
          year
        })
        .where('status', 'approved')
        .where('is_reversal_transaction', true)
        .where(function() {
          // 銷假期間與指定期間有重疊
          this.where(function() {
            this.where('start_date', '<=', end)
              .andWhere('end_date', '>=', start);
          });
        })
        .select(knex.raw('SUM(ABS(total_days)) as total'))
        .first();
      
      let reversed = 0;
      if (reversalResult?.total !== null && reversalResult?.total !== undefined) {
        reversed = parseFloat(reversalResult.total);
      }

      // 已使用 = 已批准的總額 - 銷假的總額
      return Math.max(0, approved - reversed);
    } catch (error) {
      console.error('Error calculating used days in period:', error);
      return 0;
    }
  }
}

module.exports = LeaveBalance;
