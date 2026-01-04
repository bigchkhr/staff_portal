const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 取得排班列表
router.get('/', scheduleController.getSchedules);

// 取得單一排班記錄
router.get('/:id', scheduleController.getSchedule);

// 建立排班記錄（單筆）
router.post('/', scheduleController.createSchedule);

// 批量建立排班記錄
router.post('/batch', scheduleController.createBatchSchedules);

// 更新排班記錄
router.put('/:id', scheduleController.updateSchedule);

// 刪除排班記錄
router.delete('/:id', scheduleController.deleteSchedule);

// 批量刪除排班記錄
router.delete('/batch', scheduleController.deleteBatchSchedules);

// 取得群組成員列表
router.get('/groups/:department_group_id/members', scheduleController.getGroupMembers);

module.exports = router;
