const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 獲取所有消息列表（根據用戶權限過濾）
router.get('/', newsController.getAllNews);

// 創建新消息（僅 HR 成員）
router.post('/', newsController.createNews);

// 獲取單個消息詳情
router.get('/:id', newsController.getNewsById);

// 更新消息（僅 HR 成員或創建者）
router.put('/:id', newsController.updateNews);

// 刪除消息（僅 HR 成員或創建者）
router.delete('/:id', newsController.deleteNews);

module.exports = router;

