const SystemYear = require('../database/models/SystemYear');

class SystemYearController {
  // 獲取所有年份（管理用，包含停用的）
  async getAll(req, res) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const years = await SystemYear.findAll(includeInactive);
      res.json(years);
    } catch (error) {
      console.error('Get system years error:', error);
      res.status(500).json({ message: '獲取年份列表時發生錯誤', error: error.message });
    }
  }

  // 獲取啟用的年份列表（用於下拉選單）
  async getActiveYears(req, res) {
    try {
      const years = await SystemYear.getActiveYears();
      res.json(years);
    } catch (error) {
      console.error('Get active years error:', error);
      res.status(500).json({ message: '獲取年份列表時發生錯誤', error: error.message });
    }
  }

  // 創建年份
  async create(req, res) {
    try {
      const { year, is_active, display_order } = req.body;

      if (!year) {
        return res.status(400).json({ message: '請填寫年份' });
      }

      // 檢查年份是否已存在
      const existingYear = await SystemYear.findByYear(year);
      if (existingYear) {
        return res.status(400).json({ message: '此年份已存在' });
      }

      const yearData = {
        year: parseInt(year),
        is_active: is_active !== undefined ? is_active : true,
        display_order: display_order || 0
      };

      const newYear = await SystemYear.create(yearData);

      res.status(201).json({
        message: '年份已新增',
        year: newYear
      });
    } catch (error) {
      console.error('Create system year error:', error);
      res.status(500).json({ message: '新增年份時發生錯誤', error: error.message });
    }
  }

  // 更新年份
  async update(req, res) {
    try {
      const { id } = req.params;
      const { year, is_active, display_order } = req.body;

      const existingYear = await SystemYear.findById(id);
      if (!existingYear) {
        return res.status(404).json({ message: '找不到此年份' });
      }

      // 如果要更改年份數值，檢查是否與其他年份衝突
      if (year && year !== existingYear.year) {
        const duplicateYear = await SystemYear.findByYear(year);
        if (duplicateYear) {
          return res.status(400).json({ message: '此年份已存在' });
        }
      }

      const updateData = {};
      if (year !== undefined) updateData.year = parseInt(year);
      if (is_active !== undefined) updateData.is_active = is_active;
      if (display_order !== undefined) updateData.display_order = display_order;

      const updatedYear = await SystemYear.update(id, updateData);

      res.json({
        message: '年份已更新',
        year: updatedYear
      });
    } catch (error) {
      console.error('Update system year error:', error);
      res.status(500).json({ message: '更新年份時發生錯誤', error: error.message });
    }
  }

  // 刪除年份
  async delete(req, res) {
    try {
      const { id } = req.params;

      const existingYear = await SystemYear.findById(id);
      if (!existingYear) {
        return res.status(404).json({ message: '找不到此年份' });
      }

      await SystemYear.delete(id);

      res.json({ message: '年份已刪除' });
    } catch (error) {
      console.error('Delete system year error:', error);
      res.status(500).json({ message: '刪除年份時發生錯誤', error: error.message });
    }
  }
}

module.exports = new SystemYearController();
