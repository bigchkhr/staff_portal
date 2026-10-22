const express = require('express');
const router = express.Router();
const { requireBossApiKey } = require('../middleware/bossApiKey');
const scheduleHeadcountController = require('../controllers/scheduleHeadcount.controller');

router.post('/', requireBossApiKey, scheduleHeadcountController.getScheduleHeadcount);

module.exports = router;
