const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');

// 登入端點加入 Rate Limiting（防暴力破解）
router.post('/login', loginLimiter, authController.login);
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
