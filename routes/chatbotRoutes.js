const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const auth = require('../middleware/auth');

/**
 * POST /api/chatbot/query
 * Send a message to the chatbot and get AI-powered response
 * Protected route - requires authentication
 */
router.post('/query', auth.verify, chatbotController.chatbotQuery);

module.exports = router;
