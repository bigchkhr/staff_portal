const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 取得排班列表
router.get('/', scheduleController.getSchedules.bind(scheduleController));

// 取得單一排班記錄
router.get('/:id', scheduleController.getSchedule.bind(scheduleController));

// 建立排班記錄（單筆）
router.post('/', scheduleController.createSchedule.bind(scheduleController));

// 批量建立排班記錄
router.post('/batch', scheduleController.createBatchSchedules.bind(scheduleController));

// 更新排班記錄
router.put('/:id', scheduleController.updateSchedule.bind(scheduleController));

// 刪除排班記錄
router.delete('/:id', scheduleController.deleteSchedule.bind(scheduleController));

// 批量刪除排班記錄
router.delete('/batch', scheduleController.deleteBatchSchedules.bind(scheduleController));

module.exports = router;
