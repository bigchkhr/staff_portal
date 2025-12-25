const express = require('express');
const router = express.Router();
const Position = require('../database/models/Position');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const positions = await Position.findAll();
    res.json({ positions });
  } catch (error) {
    res.status(500).json({ message: '獲取職位列表時發生錯誤' });
  }
});

module.exports = router;
