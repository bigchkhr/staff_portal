const express = require('express');
const router = express.Router();
const { requireBossApiKey } = require('../middleware/bossApiKey');
const leaveDaysController = require('../controllers/leaveDays.controller');

router.post('/', requireBossApiKey, leaveDaysController.getLeaveDays);

module.exports = router;
