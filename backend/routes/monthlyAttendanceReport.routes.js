const express = require('express');
const router = express.Router();
const monthlyAttendanceReportController = require('../controllers/monthlyAttendanceReport.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 生成月報（從月結數據生成）
router.post('/generate', monthlyAttendanceReportController.generateReport.bind(monthlyAttendanceReportController));

// 取得月報列表
router.get('/', monthlyAttendanceReportController.getReports.bind(monthlyAttendanceReportController));

// 取得單一月報
router.get('/:id', monthlyAttendanceReportController.getReport.bind(monthlyAttendanceReportController));

// 更新月報
router.put('/:id', monthlyAttendanceReportController.updateReport.bind(monthlyAttendanceReportController));

// 刪除月報
router.delete('/:id', monthlyAttendanceReportController.deleteReport.bind(monthlyAttendanceReportController));

module.exports = router;

