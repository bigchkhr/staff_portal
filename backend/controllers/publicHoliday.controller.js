const PublicHoliday = require('../database/models/PublicHoliday');
const User = require('../database/models/User');

class PublicHolidayController {
  // 獲取法定假期列表
  async getPublicHolidays(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以查看法定假期' });
      }

      const { year } = req.query;
      const holidays = await PublicHoliday.findAll(year ? parseInt(year) : null);
      
      res.json({ publicHolidays: holidays });
    } catch (error) {
      console.error('Get public holidays error:', error);
      res.status(500).json({ message: '獲取法定假期列表時發生錯誤', error: error.message });
    }
  }

  // 創建法定假期
  async createPublicHoliday(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以管理法定假期' });
      }

      const { date, name, name_zh, year } = req.body;

      // 驗證必填欄位
      if (!date || !name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      // 檢查日期是否已存在
      const existingHoliday = await PublicHoliday.findByDate(date);
      if (existingHoliday) {
        return res.status(400).json({ message: '該日期已存在法定假期' });
      }

      // 計算年份（如果未提供）
      const holidayYear = year || new Date(date).getFullYear();

      const holidayData = {
        date,
        name,
        name_zh,
        year: holidayYear
      };

      const holiday = await PublicHoliday.create(holidayData);

      res.status(201).json({
        message: '法定假期已建立',
        publicHoliday: holiday
      });
    } catch (error) {
      console.error('Create public holiday error:', error);
      
      // 處理唯一約束錯誤
      if (error.code === '23505' || error.message.includes('unique')) {
        return res.status(400).json({ message: '該日期已存在法定假期' });
      }
      
      res.status(500).json({ message: '建立法定假期時發生錯誤', error: error.message });
    }
  }

  // 更新法定假期
  async updatePublicHoliday(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以管理法定假期' });
      }

      const { id } = req.params;
      const { date, name, name_zh, year } = req.body;

      // 驗證必填欄位
      if (!date || !name || !name_zh) {
        return res.status(400).json({ message: '請填寫所有必填欄位' });
      }

      // 檢查法定假期是否存在
      const existingHoliday = await PublicHoliday.findById(id);
      if (!existingHoliday) {
        return res.status(404).json({ message: '法定假期不存在' });
      }

      // 如果日期改變，檢查新日期是否已存在
      if (date !== existingHoliday.date) {
        const dateExists = await PublicHoliday.findByDate(date);
        if (dateExists && dateExists.id !== parseInt(id)) {
          return res.status(400).json({ message: '該日期已存在法定假期' });
        }
      }

      // 計算年份（如果未提供）
      const holidayYear = year || new Date(date).getFullYear();

      const updateData = {
        date,
        name,
        name_zh,
        year: holidayYear
      };

      const holiday = await PublicHoliday.update(id, updateData);

      res.json({
        message: '法定假期已更新',
        publicHoliday: holiday
      });
    } catch (error) {
      console.error('Update public holiday error:', error);
      
      // 處理唯一約束錯誤
      if (error.code === '23505' || error.message.includes('unique')) {
        return res.status(400).json({ message: '該日期已存在法定假期' });
      }
      
      res.status(500).json({ message: '更新法定假期時發生錯誤', error: error.message });
    }
  }

  // 刪除法定假期
  async deletePublicHoliday(req, res) {
    try {
      // 檢查是否為 HR Group 成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以管理法定假期' });
      }

      const { id } = req.params;

      // 檢查法定假期是否存在
      const existingHoliday = await PublicHoliday.findById(id);
      if (!existingHoliday) {
        return res.status(404).json({ message: '法定假期不存在' });
      }

      await PublicHoliday.delete(id);

      res.json({ message: '法定假期已刪除' });
    } catch (error) {
      console.error('Delete public holiday error:', error);
      res.status(500).json({ message: '刪除法定假期時發生錯誤', error: error.message });
    }
  }

  // 獲取日期範圍內的法定假期（不需要 HR 權限，所有用戶都可以查詢）
  async getHolidaysInRange(req, res) {
    try {
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ message: '請提供開始日期和結束日期' });
      }

      // 驗證日期格式
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: '日期格式無效' });
      }

      // 確保日期格式為 YYYY-MM-DD
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const holidays = await PublicHoliday.getHolidaysInRange(startDateStr, endDateStr);
      
      res.json({ publicHolidays: holidays });
    } catch (error) {
      console.error('Get holidays in range error:', error);
      res.status(500).json({ message: '獲取法定假期時發生錯誤', error: error.message });
    }
  }
}

module.exports = new PublicHolidayController();

