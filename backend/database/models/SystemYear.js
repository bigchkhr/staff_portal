const knex = require('../../config/database');

class SystemYear {
  static async findAll(includeInactive = false) {
    let query = knex('system_years').orderBy('year', 'asc');
    
    if (!includeInactive) {
      query = query.where('is_active', true);
    }
    
    return await query;
  }

  static async findById(id) {
    return await knex('system_years').where('id', id).first();
  }

  static async findByYear(year) {
    return await knex('system_years').where('year', year).first();
  }

  static async create(yearData) {
    const [systemYear] = await knex('system_years').insert(yearData).returning('*');
    return systemYear;
  }

  static async update(id, yearData) {
    await knex('system_years').where('id', id).update({
      ...yearData,
      updated_at: knex.fn.now()
    });
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('system_years').where('id', id).del();
  }

  // 獲取所有啟用的年份（用於下拉選單）
  static async getActiveYears() {
    const years = await knex('system_years')
      .where('is_active', true)
      .orderBy('year', 'asc')
      .select('year');
    return years.map(y => y.year);
  }
}

module.exports = SystemYear;
