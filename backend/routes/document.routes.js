const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/documentUpload');

// 所有路由都需要認證
router.use(authenticate);

// HR成員上傳文件
router.post('/upload', isSystemAdmin, uploadSingle.single('file'), documentController.uploadDocument);

// HR成員獲取所有文件列表
router.get('/all', isSystemAdmin, documentController.getAllDocuments);

// 員工獲取自己的文件列表
router.get('/my', documentController.getMyDocuments);

// 下載文件
router.get('/:id/download', documentController.downloadDocument);

// 更新文件信息（HR成員）
router.put('/:id', isSystemAdmin, documentController.updateDocument);

// 刪除文件（HR成員）
router.delete('/:id', isSystemAdmin, documentController.deleteDocument);

// 獲取所有文件類別
router.get('/categories', documentController.getCategories);

module.exports = router;

