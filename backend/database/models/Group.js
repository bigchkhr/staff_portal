const knex = require('../../config/database');

class Group {
  static async findAll() {
    return await knex('groups')
      .where('is_active', true)
      .orderBy('name');
  }

  static async findById(id) {
    return await knex('groups').where('id', id).first();
  }

  static async create(groupData) {
    const [group] = await knex('groups').insert(groupData).returning('*');
    return group;
  }

  static async update(id, groupData) {
    await knex('groups').where('id', id).update(groupData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('groups').where('id', id).update({ is_active: false });
  }
}

module.exports = Group;
