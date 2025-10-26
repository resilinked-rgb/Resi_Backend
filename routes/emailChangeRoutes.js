const express = require('express');
const router = express.Router();
const emailChangeController = require('../controllers/emailChangeController');
const auth = require('../middleware/auth');

// Request email change - sends verification to current email
router.post('/request', auth.verify, emailChangeController.requestEmailChange);

// Verify email change with token (no auth required - token is the auth)
router.get('/verify/:token', emailChangeController.verifyEmailChange);

// Cancel email change request
router.delete('/cancel', auth.verify, emailChangeController.cancelEmailChange);

// Get pending email change request
router.get('/pending', auth.verify, emailChangeController.getPendingEmailChange);

module.exports = router;
