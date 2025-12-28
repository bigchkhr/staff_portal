const express = require('express');
const router = express.Router();
const extraWorkingHoursController = require('../controllers/extraWorkingHours.controller');
const { authenticate } = require('../middleware/auth');

// 額外工作時數申報
router.post('/', authenticate, extraWorkingHoursController.createApplication);
router.get('/', authenticate, extraWorkingHoursController.getApplications);
router.get('/pending-approvals', authenticate, extraWorkingHoursController.getPendingApprovals);
router.post('/:id/approve', authenticate, extraWorkingHoursController.approve);
router.get('/:id', authenticate, extraWorkingHoursController.getApplicationById);

module.exports = router;

