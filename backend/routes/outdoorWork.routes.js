const express = require('express');
const router = express.Router();
const outdoorWorkController = require('../controllers/outdoorWork.controller');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/outdoorWorkUpload');

// 外勤工作申請（支援多檔案上傳）
router.post('/', authenticate, upload.array('files', 50), outdoorWorkController.createApplication);
router.get('/', authenticate, outdoorWorkController.getApplications);
router.get('/pending-approvals', authenticate, outdoorWorkController.getPendingApprovals);
router.post('/:id/approve', authenticate, outdoorWorkController.approve);
router.get('/:id', authenticate, outdoorWorkController.getApplicationById);

module.exports = router;

