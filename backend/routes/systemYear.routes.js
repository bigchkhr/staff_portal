const express = require('express');
const router = express.Router();
const systemYearController = require('../controllers/systemYear.controller');
const { authenticate, isSystemAdmin } = require('../middleware/auth');

// 公開路由 - 獲取啟用的年份列表（用於下拉選單）
router.get('/active', authenticate, systemYearController.getActiveYears);

// 管理員路由 - 需要系統管理員權限
router.get('/', authenticate, isSystemAdmin, systemYearController.getAll);
router.post('/', authenticate, isSystemAdmin, systemYearController.create);
router.put('/:id', authenticate, isSystemAdmin, systemYearController.update);
router.delete('/:id', authenticate, isSystemAdmin, systemYearController.delete);

module.exports = router;
