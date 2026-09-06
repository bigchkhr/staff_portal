const express = require('express');
const router = express.Router();
const { requireBossApiKey } = require('../middleware/bossApiKey');
const payrollHoursController = require('../controllers/payrollHours.controller');

router.post('/', requireBossApiKey, payrollHoursController.getPayrollHours);

module.exports = router;
