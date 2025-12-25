const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// 假期申請（支援多檔案上傳）
router.post('/', authenticate, upload.array('files', 50), leaveController.createApplication);
router.get('/', authenticate, leaveController.getApplications);
router.get('/balances', authenticate, leaveController.getBalances);
router.get('/department-group-balances', authenticate, leaveController.getDepartmentGroupBalances);
router.get('/pending-approvals', authenticate, leaveController.getPendingApprovals);

// 文件相關路由（必須在 /:id 之前，按順序匹配）
router.get('/documents/:id/download', authenticate, leaveController.downloadDocument);
router.delete('/documents/:id', authenticate, leaveController.deleteDocument);

// 文件上傳（支援多檔案）
router.post('/:id/documents', authenticate, upload.array('files', 50), leaveController.uploadDocument);
router.get('/:id/documents', authenticate, leaveController.getDocuments);

// 取消假期（必須在 /:id 之前）
router.post('/cancel', authenticate, leaveController.requestCancellation);
router.post('/reverse', authenticate, leaveController.requestReversal);

// 獲取單個申請（必須在最後，因為會匹配所有 /:id 路徑）
router.get('/:id', authenticate, leaveController.getApplicationById);

module.exports = router;
