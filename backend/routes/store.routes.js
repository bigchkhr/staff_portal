const express = require('express');
const router = express.Router();
const knex = require('../config/database');
const { authenticate } = require('../middleware/auth');

// 獲取所有店舖列表
router.get('/', authenticate, async (req, res) => {
  try {
    const stores = await knex('stores')
      .where('is_closed', false)
      .orderBy('store_code')
      .select(
        'id',
        'store_code',
        'store_short_name_',
        'district',
        'tel',
        'email',
        'address_en',
        'address_chi',
        'open_date',
        'close_date',
        'is_closed'
      );
    
    res.json({ stores });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ message: '獲取店舖列表失敗', error: error.message });
  }
});

module.exports = router;
