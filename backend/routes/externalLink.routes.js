const express = require('express');
const router = express.Router();
const externalLinkController = require('../controllers/externalLink.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有外部連結列表（用戶端：只顯示啟用的，HR：顯示所有）
router.get('/all', externalLinkController.getAllLinks);

// 創建外部連結（HR成員）
router.post('/', isSystemAdmin, externalLinkController.createLink);

// 更新外部連結（HR成員）
router.put('/:id', isSystemAdmin, externalLinkController.updateLink);

// 刪除外部連結（HR成員）
router.delete('/:id', isSystemAdmin, externalLinkController.deleteLink);

module.exports = router;

