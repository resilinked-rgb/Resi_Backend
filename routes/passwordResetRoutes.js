const express = require('express');
const router = express.Router();
const passwordController = require('../controllers/passwordController');
const auth = require('../middleware/auth');

// Token Management (Admin)
router.get('/', auth.verify, auth.verifyAdmin, passwordController.getAllTokens);
router.delete('/:id', auth.verify, auth.verifyAdmin, passwordController.deleteToken);
router.patch('/:id/used', auth.verify, auth.verifyAdmin, passwordController.markAsUsed);

module.exports = router;