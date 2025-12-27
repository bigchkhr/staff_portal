const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/s3-upload', webhookController.handleS3Upload);

module.exports = router;

