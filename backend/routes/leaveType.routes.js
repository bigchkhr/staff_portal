const express = require('express');
const router = express.Router();
const LeaveType = require('../database/models/LeaveType');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const { onlyAvailableInFlow } = req.query;
    const leaveTypes = await LeaveType.findAll({ 
      onlyAvailableInFlow: onlyAvailableInFlow === 'true' 
    });
    res.json({ leaveTypes });
  } catch (error) {
    res.status(500).json({ message: '獲取假期類型列表時發生錯誤' });
  }
});

// 獲取在 e-flow 和 paper-flow 中可用的假期類型
router.get('/available-in-flow', authenticate, async (req, res) => {
  try {
    const leaveTypes = await LeaveType.findAllAvailableInFlow();
    res.json({ leaveTypes });
  } catch (error) {
    res.status(500).json({ message: '獲取可用假期類型列表時發生錯誤' });
  }
});

module.exports = router;
