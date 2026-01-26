const express = require('express');
const router = express.Router();
const extraWorkingHoursController = require('../controllers/extraWorkingHours.controller');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/extraWorkingHoursUpload');

// 額外工作時數申報（支援多檔案上傳）
router.post('/', authenticate, upload.array('files', 50), extraWorkingHoursController.createApplication);
router.get('/', authenticate, extraWorkingHoursController.getApplications);
router.get('/pending-approvals', authenticate, extraWorkingHoursController.getPendingApprovals);
router.post('/:id/approve', authenticate, extraWorkingHoursController.approve);
router.get('/:id', authenticate, extraWorkingHoursController.getApplicationById);

module.exports = router;

