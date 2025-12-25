const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/', authenticate, leaveController.createApplication);
router.get('/', authenticate, leaveController.getApplications);
router.get('/balances', authenticate, leaveController.getBalances);
router.get('/:id', authenticate, leaveController.getApplicationById);
router.post('/:id/documents', authenticate, upload.single('file'), leaveController.uploadDocument);
router.get('/:id/documents', authenticate, leaveController.getDocuments);

module.exports = router;

