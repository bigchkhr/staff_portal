const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todo.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ========== HR 待處理清單路由 ==========
// 獲取所有 HR 待處理清單
router.get('/hr', todoController.getHRTodos);

// 創建 HR 待處理項目
router.post('/hr', todoController.createHRTodo);

// 更新 HR 待處理項目
router.put('/hr/:id', todoController.updateHRTodo);

// 刪除 HR 待處理項目
router.delete('/hr/:id', todoController.deleteHRTodo);

// ========== Payroll Alert Items 路由 ==========
// 獲取所有 Payroll Alert Items
router.get('/payroll-alert', todoController.getPayrollAlertItems);

// 創建 Payroll Alert Item
router.post('/payroll-alert', todoController.createPayrollAlertItem);

// 更新 Payroll Alert Item
router.put('/payroll-alert/:id', todoController.updatePayrollAlertItem);

// 刪除 Payroll Alert Item
router.delete('/payroll-alert/:id', todoController.deletePayrollAlertItem);

// ========== 個人待辦事項路由 ==========
// 獲取當前用戶的個人待辦事項
router.get('/my', todoController.getMyTodos);

// 創建個人待辦事項
router.post('/my', todoController.createMyTodo);

// 更新個人待辦事項
router.put('/my/:id', todoController.updateMyTodo);

// 刪除個人待辦事項
router.delete('/my/:id', todoController.deleteMyTodo);

module.exports = router;

