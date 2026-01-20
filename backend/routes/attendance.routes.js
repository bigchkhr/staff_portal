const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 獲取用戶有權限查看的考勤群組列表
router.get('/accessible-groups', attendanceController.getAccessibleAttendanceGroups.bind(attendanceController));

// 獲取指定用戶的打卡記錄（用於月結表等頁面，需要權限檢查）
router.get('/user-clock-records', attendanceController.getUserClockRecords.bind(attendanceController));

// 獲取當前用戶的打卡記錄（用於 My Attendance 頁面）
router.get('/my-clock-records', attendanceController.getMyClockRecords.bind(attendanceController));

// 取得考勤列表
router.get('/', attendanceController.getAttendances.bind(attendanceController));

// 獲取考勤對比（對比排班表）
router.get('/comparison', attendanceController.getAttendanceComparison.bind(attendanceController));

// 取得單一考勤記錄
router.get('/:id', attendanceController.getAttendance.bind(attendanceController));

// 建立考勤記錄
router.post('/', attendanceController.createAttendance.bind(attendanceController));

// 從CSV導入打卡記錄
router.post('/import-csv', attendanceController.importClockRecordsFromCSV.bind(attendanceController));

// 更新打卡記錄的有效性（必須放在 /:id 之前，否則會被當作 id）
router.put('/update-clock-records', attendanceController.updateClockRecordsValidity.bind(attendanceController));

// 更新打卡記錄的時間（必須放在 /:id 之前，否則會被當作 id）
router.put('/update-clock-records-time', attendanceController.updateClockRecordsTime.bind(attendanceController));

// 更新考勤備註（必須放在 /:id 之前，否則會被當作 id）
router.put('/update-remarks', attendanceController.updateAttendanceRemarks.bind(attendanceController));

// 更新考勤記錄
router.put('/:id', attendanceController.updateAttendance.bind(attendanceController));

// 刪除考勤記錄
router.delete('/:id', attendanceController.deleteAttendance.bind(attendanceController));

module.exports = router;
