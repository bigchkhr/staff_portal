const knex = require('../../config/database');

class Department {
  static async findAll() {
    return await knex('departments')
      .where('is_active', true)
      .orderBy('name');
  }

  static async findById(id) {
    return await knex('departments').where('id', id).first();
  }

  static async create(departmentData) {
    const [department] = await knex('departments').insert(departmentData).returning('*');
    return department;
  }

  static async update(id, departmentData) {
    await knex('departments').where('id', id).update(departmentData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('departments').where('id', id).update({ is_active: false });
  }
}

module.exports = Department;
