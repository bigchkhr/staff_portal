const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const { authenticate } = require('../middleware/auth');

// 所有路由都需要認證
router.get('/', authenticate, contactController.getContacts);
router.get('/:id', authenticate, contactController.getContact);
router.post('/', authenticate, contactController.createContact);
router.put('/:id', authenticate, contactController.updateContact);
router.delete('/:id', authenticate, contactController.deleteContact);

module.exports = router;
