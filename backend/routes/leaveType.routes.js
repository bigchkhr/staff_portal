const express = require('express');
const router = express.Router();
const LeaveType = require('../database/models/LeaveType');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const leaveTypes = await LeaveType.findAll();
    res.json({ leaveTypes });
  } catch (error) {
    res.status(500).json({ message: '獲取假期類型列表時發生錯誤' });
  }
});

module.exports = router;
