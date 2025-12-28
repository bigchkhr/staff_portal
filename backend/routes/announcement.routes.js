const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/announcementUpload');

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有公告列表（所有用戶都可以查看）
router.get('/', announcementController.getAllAnnouncements);

// 下載附件（所有用戶都可以下載）- 必須在 /:id 之前，避免路由衝突
router.get('/attachments/:attachmentId/download', announcementController.downloadAttachment);

// HR Group 成員刪除附件 - 必須在 /:id 之前，避免路由衝突
router.delete('/attachments/:attachmentId', isSystemAdmin, announcementController.deleteAttachment);

// HR Group 成員上傳附件到現有公告
router.post('/:id/attachments', isSystemAdmin, uploadMultiple.array('files', 50), announcementController.uploadAttachment);

// 獲取單個公告詳情（所有用戶都可以查看）
router.get('/:id', announcementController.getAnnouncementById);

// HR Group 成員創建公告（可同時上傳附件）
router.post('/', isSystemAdmin, uploadMultiple.array('files', 50), announcementController.createAnnouncement);

// HR Group 成員更新公告
router.put('/:id', isSystemAdmin, announcementController.updateAnnouncement);

// HR Group 成員刪除公告
router.delete('/:id', isSystemAdmin, announcementController.deleteAnnouncement);

module.exports = router;

