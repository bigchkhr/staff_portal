const express = require('express');
const router = express.Router();
const formLibraryController = require('../controllers/formLibrary.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/formLibraryUpload');

// 所有路由都需要認證
router.use(authenticate);

// HR成員上傳表單
router.post('/upload', isSystemAdmin, uploadSingle.single('file'), formLibraryController.uploadForm);

// 獲取所有表單列表（用戶端：只顯示可見的，HR：顯示所有）
router.get('/all', formLibraryController.getAllForms);

// 下載表單
router.get('/:id/download', formLibraryController.downloadForm);

// 更新表單信息（HR成員）
router.put('/:id', isSystemAdmin, formLibraryController.updateForm);

// 刪除表單（HR成員）
router.delete('/:id', isSystemAdmin, formLibraryController.deleteForm);

module.exports = router;

