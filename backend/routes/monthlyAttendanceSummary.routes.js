const express = require('express');
const router = express.Router();
const monthlyAttendanceSummaryController = require('../controllers/monthlyAttendanceSummary.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 取得月結記錄列表
router.get('/', monthlyAttendanceSummaryController.getMonthlySummaries.bind(monthlyAttendanceSummaryController));

// 取得單一月結記錄
router.get('/:id', monthlyAttendanceSummaryController.getMonthlySummary.bind(monthlyAttendanceSummaryController));

// 從考勤數據複製並計算月結數據
router.post('/copy-from-attendance', monthlyAttendanceSummaryController.copyFromAttendance.bind(monthlyAttendanceSummaryController));

// 計算單一天的數據
router.post('/calculate-day', monthlyAttendanceSummaryController.calculateDay.bind(monthlyAttendanceSummaryController));

// 更新月結記錄
router.put('/:id', monthlyAttendanceSummaryController.updateMonthlySummary.bind(monthlyAttendanceSummaryController));

// 刪除月結記錄
router.delete('/:id', monthlyAttendanceSummaryController.deleteMonthlySummary.bind(monthlyAttendanceSummaryController));

module.exports = router;
