const express = require('express');
const router = express.Router();
const newsGroupController = require('../controllers/newsGroup.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.use(authenticate);

// 檢查是否為群組管理員
router.get('/check-manager', newsGroupController.checkIsManager);

// 獲取所有消息群組
router.get('/', newsGroupController.getNewsGroups);

// 獲取單個消息群組
router.get('/:id', newsGroupController.getNewsGroup);

// 創建消息群組（僅群組管理員）
router.post('/', newsGroupController.createNewsGroup);

// 更新消息群組（僅群組管理員）
router.put('/:id', newsGroupController.updateNewsGroup);

// 刪除消息群組（僅群組管理員）
router.delete('/:id', newsGroupController.deleteNewsGroup);

// 獲取群組成員
router.get('/:id/members', newsGroupController.getNewsGroupMembers);

// 添加成員到群組（僅群組管理員）
router.post('/:id/members', newsGroupController.addUserToNewsGroup);

// 從群組移除成員（僅群組管理員）
router.delete('/:id/members/:userId', newsGroupController.removeUserFromNewsGroup);

// 獲取所有群組管理員（僅系統管理員）
router.get('/managers/all', newsGroupController.getManagers);

// 添加群組管理員（僅系統管理員）
router.post('/managers', newsGroupController.addManager);

// 移除群組管理員（僅系統管理員）
router.delete('/managers/:user_id', newsGroupController.removeManager);

module.exports = router;

