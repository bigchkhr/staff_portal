const knex = require('../../config/database');

class PublicHoliday {
  static async findAll(year = null) {
    let query = knex('public_holidays').orderBy('date');
    
    if (year) {
      query = query.where('year', year);
    }
    
    return await query;
  }

  static async findById(id) {
    return await knex('public_holidays').where('id', id).first();
  }

  static async findByDate(date) {
    return await knex('public_holidays').where('date', date).first();
  }

  static async create(holidayData) {
    const [holiday] = await knex('public_holidays').insert(holidayData).returning('*');
    return holiday;
  }

  static async update(id, holidayData) {
    await knex('public_holidays').where('id', id).update(holidayData);
    return await this.findById(id);
  }

  static async delete(id) {
    return await knex('public_holidays').where('id', id).del();
  }

  // 檢查日期範圍內是否有法定假期
  static async hasPublicHolidays(startDate, endDate) {
    const holidays = await knex('public_holidays')
      .whereBetween('date', [startDate, endDate]);
    return holidays.length > 0;
  }

  // 獲取日期範圍內的所有法定假期
  static async getHolidaysInRange(startDate, endDate) {
    return await knex('public_holidays')
      .whereBetween('date', [startDate, endDate])
      .orderBy('date');
  }
}

module.exports = PublicHoliday;

