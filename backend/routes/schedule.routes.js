const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 獲取用戶有權限查看的排班群組列表
router.get('/accessible-groups', scheduleController.getAccessibleScheduleGroups.bind(scheduleController));

// 更新群組的 checker 編輯權限設置（必須放在 /:id 之前）
router.put('/group/:department_group_id/checker-edit-permission', scheduleController.updateCheckerEditPermission.bind(scheduleController));

// 批量更新所有群組的 checker 編輯權限設置（必須放在 /:id 之前）
router.put('/groups/batch-checker-edit-permission', scheduleController.batchUpdateCheckerEditPermission.bind(scheduleController));

// 取得原本群組的排班列表（原舖）
router.get('/', scheduleController.getSchedules.bind(scheduleController));

// 取得幫舖排班列表（helper schedules）
router.get('/helpers', scheduleController.getHelperSchedules.bind(scheduleController));

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
