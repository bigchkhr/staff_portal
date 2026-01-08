const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 取得考勤列表
router.get('/', attendanceController.getAttendances.bind(attendanceController));

// 獲取考勤對比（對比排班表）
router.get('/comparison', attendanceController.getAttendanceComparison.bind(attendanceController));

// 取得單一考勤記錄
router.get('/:id', attendanceController.getAttendance.bind(attendanceController));

// 建立考勤記錄
router.post('/', attendanceController.createAttendance.bind(attendanceController));

// 更新考勤記錄
router.put('/:id', attendanceController.updateAttendance.bind(attendanceController));

// 刪除考勤記錄
router.delete('/:id', attendanceController.deleteAttendance.bind(attendanceController));

module.exports = router;
