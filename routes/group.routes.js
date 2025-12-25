const express = require('express');
const router = express.Router();
const Group = require('../database/models/Group');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const groups = await Group.findAll();
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ message: '獲取群組列表時發生錯誤' });
  }
});

module.exports = router;

