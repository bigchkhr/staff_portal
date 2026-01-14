const knex = require('../../config/database');

class LeaveType {
  static async findAll(options = {}) {
    let query = knex('leave_types')
      .where('is_active', true);
    
    // 如果指定了 onlyAvailableInFlow，則只返回 is_available_in_flow = true 的假期類型
    if (options.onlyAvailableInFlow) {
      query = query.where('is_available_in_flow', true);
    }
    
    return await query.orderBy('name');
  }

  static async findById(id) {
    return await knex('leave_types').where('id', id).first();
  }

  static async findByCode(code) {
    return await knex('leave_types').where('code', code).first();
  }

  // 獲取在 e-flow 和 paper-flow 中可用的假期類型
  static async findAllAvailableInFlow() {
    return await knex('leave_types')
      .where('is_active', true)
      .where('is_available_in_flow', true)
      .orderBy('name');
  }

  static async create(leaveTypeData) {
    const [leaveType] = await knex('leave_types').insert(leaveTypeData).returning('*');
    return leaveType;
  }

  static async update(id, leaveTypeData) {
    await knex('leave_types').where('id', id).update(leaveTypeData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('leave_types').where('id', id).update({ is_active: false });
  }
}

module.exports = LeaveType;
