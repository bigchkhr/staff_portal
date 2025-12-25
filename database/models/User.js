const knex = require('../../config/database');

class User {
  static async findByEmail(email) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .leftJoin('groups', 'users.group_id', 'groups.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh',
        'groups.name as group_name',
        'groups.name_zh as group_name_zh'
      )
      .where('users.email', email)
      .first();
  }

  static async findById(id) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .leftJoin('groups', 'users.group_id', 'groups.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh',
        'groups.name as group_name',
        'groups.name_zh as group_name_zh'
      )
      .where('users.id', id)
      .first();
  }

  static async create(userData) {
    const [user] = await knex('users').insert(userData).returning('*');
    return await this.findById(user.id);
  }

  static async update(id, userData) {
    await knex('users').where('id', id).update(userData);
    return await this.findById(id);
  }

  static async updatePassword(id, passwordHash) {
    return await knex('users').where('id', id).update({ password_hash: passwordHash });
  }

  static async findAll(options = {}) {
    let query = knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .leftJoin('groups', 'users.group_id', 'groups.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh',
        'groups.name as group_name',
        'groups.name_zh as group_name_zh'
      );

    if (options.department_id) {
      query = query.where('users.department_id', options.department_id);
    }

    if (options.is_active !== undefined) {
      query = query.where('users.is_active', options.is_active);
    }

    if (options.search) {
      query = query.where(function() {
        this.where('users.employee_number', 'like', `%${options.search}%`)
          .orWhere('users.surname', 'like', `%${options.search}%`)
          .orWhere('users.given_name', 'like', `%${options.search}%`)
          .orWhere('users.name_zh', 'like', `%${options.search}%`)
          .orWhere('users.email', 'like', `%${options.search}%`);
      });
    }

    return await query.orderBy('users.created_at', 'desc');
  }

  static async findByEmployeeNumber(employeeNumber) {
    return await knex('users')
      .leftJoin('departments', 'users.department_id', 'departments.id')
      .leftJoin('positions', 'users.position_id', 'positions.id')
      .leftJoin('groups', 'users.group_id', 'groups.id')
      .select(
        'users.*',
        'departments.name as department_name',
        'departments.name_zh as department_name_zh',
        'positions.name as position_name',
        'positions.name_zh as position_name_zh',
        'groups.name as group_name',
        'groups.name_zh as group_name_zh'
      )
      .where('users.employee_number', employeeNumber)
      .first();
  }
}

module.exports = User;

