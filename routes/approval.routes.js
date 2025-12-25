const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approval.controller');
const { authenticate } = require('../middleware/auth');

router.get('/pending', authenticate, approvalController.getPendingApprovals);
router.post('/:id/approve', authenticate, approvalController.approve);

module.exports = router;

