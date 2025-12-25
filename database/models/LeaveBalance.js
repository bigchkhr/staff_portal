const knex = require('../../config/database');

class LeaveBalance {
  static async findByUserAndType(userId, leaveTypeId, year) {
    return await knex('leave_balances')
      .where({ user_id: userId, leave_type_id: leaveTypeId, year })
      .first();
  }

  static async findByUser(userId, year) {
    return await knex('leave_balances')
      .leftJoin('leave_types', 'leave_balances.leave_type_id', 'leave_types.id')
      .select(
        'leave_balances.*',
        'leave_types.code as leave_type_code',
        'leave_types.name as leave_type_name',
        'leave_types.name_zh as leave_type_name_zh',
        'leave_types.requires_balance'
      )
      .where({ user_id: userId, year })
      .orderBy('leave_types.name');
  }

  static async create(balanceData) {
    const [balance] = await knex('leave_balances').insert(balanceData).returning('*');
    return balance;
  }

  static async update(id, balanceData) {
    await knex('leave_balances').where('id', id).update(balanceData);
    return await knex('leave_balances').where('id', id).first();
  }

  static async updateOrCreate(userId, leaveTypeId, year, balanceData) {
    const existing = await this.findByUserAndType(userId, leaveTypeId, year);
    
    if (existing) {
      return await this.update(existing.id, balanceData);
    } else {
      return await this.create({
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
        ...balanceData
      });
    }
  }

  static async decrementBalance(userId, leaveTypeId, year, days) {
    const balance = await this.findByUserAndType(userId, leaveTypeId, year);
    
    if (!balance) {
      throw new Error('Leave balance not found');
    }

    const newBalance = parseFloat(balance.balance) - parseFloat(days);
    const newTaken = parseFloat(balance.taken) + parseFloat(days);

    if (newBalance < 0) {
      throw new Error('Insufficient leave balance');
    }

    return await this.update(balance.id, {
      balance: newBalance,
      taken: newTaken
    });
  }

  static async incrementBalance(userId, leaveTypeId, year, days) {
    const balance = await this.findByUserAndType(userId, leaveTypeId, year);
    
    if (!balance) {
      return await this.create({
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
        balance: parseFloat(days),
        taken: Math.max(0, parseFloat(balance?.taken || 0) - parseFloat(days))
      });
    }

    const newBalance = parseFloat(balance.balance) + parseFloat(days);
    const newTaken = Math.max(0, parseFloat(balance.taken) - parseFloat(days));

    return await this.update(balance.id, {
      balance: newBalance,
      taken: newTaken
    });
  }
}

module.exports = LeaveBalance;

