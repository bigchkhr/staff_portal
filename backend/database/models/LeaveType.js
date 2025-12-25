const knex = require('../../config/database');

class LeaveType {
  static async findAll() {
    return await knex('leave_types')
      .where('is_active', true)
      .orderBy('name');
  }

  static async findById(id) {
    return await knex('leave_types').where('id', id).first();
  }

  static async findByCode(code) {
    return await knex('leave_types').where('code', code).first();
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
