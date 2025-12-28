const express = require('express');
const router = express.Router();
const outdoorWorkController = require('../controllers/outdoorWork.controller');
const { authenticate } = require('../middleware/auth');

// 外勤工作申請
router.post('/', authenticate, outdoorWorkController.createApplication);
router.get('/', authenticate, outdoorWorkController.getApplications);
router.get('/pending-approvals', authenticate, outdoorWorkController.getPendingApprovals);
router.post('/:id/approve', authenticate, outdoorWorkController.approve);
router.get('/:id', authenticate, outdoorWorkController.getApplicationById);

module.exports = router;

