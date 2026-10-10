const knex = require('../../config/database');

class ShiftDutyRole {
  static async findAll({ includeInactive = true } = {}) {
    let query = knex('shift_duty_roles').orderBy('display_order', 'asc').orderBy('name_zh', 'asc');
    if (!includeInactive) {
      query = query.where('is_active', true);
    }
    return query;
  }

  static async findById(id) {
    return knex('shift_duty_roles').where('id', id).first();
  }

  static async findByCode(code, excludeId = null) {
    if (!code) return null;
    let query = knex('shift_duty_roles').whereRaw('lower(code) = ?', [String(code).toLowerCase()]);
    if (excludeId != null) {
      query = query.whereNot('id', excludeId);
    }
    return query.first();
  }

  static async create(data) {
    const [role] = await knex('shift_duty_roles').insert(data).returning('*');
    return role;
  }

  static async update(id, data) {
    await knex('shift_duty_roles').where('id', id).update({
      ...data,
      updated_at: knex.fn.now()
    });
    return this.findById(id);
  }

  static async delete(id) {
    return knex('shift_duty_roles').where('id', id).del();
  }

  static async isInUse(id) {
    const row = await knex('schedule_duty_assignments').where('duty_role_id', id).first();
    return !!row;
  }
}

module.exports = ShiftDutyRole;
