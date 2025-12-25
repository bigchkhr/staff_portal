const express = require('express');
const router = express.Router();
const Department = require('../database/models/Department');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const departments = await Department.findAll();
    res.json({ departments });
  } catch (error) {
    res.status(500).json({ message: '獲取部門列表時發生錯誤' });
  }
});

module.exports = router;
