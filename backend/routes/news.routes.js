const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news.controller');
const { authenticate } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/newsUpload');

// Multer 錯誤處理中間件
const handleUploadError = (err, req, res, next) => {
  if (err) {
    console.error('Upload error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '檔案大小超過限制（最大 10MB）'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: '檔案數量超過限制（最多 10 個）'
      });
    }
    if (err.message) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    return res.status(500).json({
      success: false,
      message: '上傳附件時發生錯誤',
      error: err.message
    });
  }
  next();
};

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有消息列表（根據用戶權限過濾）
router.get('/', newsController.getAllNews);

// 創建新消息（僅 HR 成員）
router.post('/', uploadMultiple, handleUploadError, newsController.createNews);

// 獲取單個消息詳情
router.get('/:id', newsController.getNewsById);

// 更新消息（僅 HR 成員或創建者）
router.put('/:id', uploadMultiple, handleUploadError, newsController.updateNews);

// 刪除消息（僅 HR 成員或創建者）
router.delete('/:id', newsController.deleteNews);

// 上傳消息附件
router.post('/:id/attachments', uploadMultiple, handleUploadError, newsController.uploadAttachment);

// 刪除消息附件
router.delete('/:id/attachments/:attachmentId', newsController.deleteAttachment);

// 下載消息附件
router.get('/:id/attachments/:attachmentId/download', newsController.downloadAttachment);

module.exports = router;

