const express = require('express');
const router = express.Router();
const publicHolidayController = require('../controllers/publicHoliday.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 獲取法定假期列表（可選年份參數）
router.get('/', publicHolidayController.getPublicHolidays);

// 創建法定假期
router.post('/', publicHolidayController.createPublicHoliday);

// 更新法定假期
router.put('/:id', publicHolidayController.updatePublicHoliday);

// 刪除法定假期
router.delete('/:id', publicHolidayController.deletePublicHoliday);

// 獲取日期範圍內的法定假期（不需要 HR 權限）
router.get('/range', publicHolidayController.getHolidaysInRange);

module.exports = router;

