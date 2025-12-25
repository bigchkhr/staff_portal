const knex = require('../../config/database');

class Position {
  static async findAll() {
    return await knex('positions')
      .where('is_active', true)
      .orderBy('name');
  }

  static async findById(id) {
    return await knex('positions').where('id', id).first();
  }

  static async create(positionData) {
    const [position] = await knex('positions').insert(positionData).returning('*');
    return position;
  }

  static async update(id, positionData) {
    await knex('positions').where('id', id).update(positionData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('positions').where('id', id).update({ is_active: false });
  }
}

module.exports = Position;

