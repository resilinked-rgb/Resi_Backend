const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth.verify);

// Send a message
router.post('/', messageController.sendMessage);

// Get inbox (received messages)
router.get('/inbox', messageController.getInbox);

// Get sent messages
router.get('/sent', messageController.getSentMessages);

// Get conversation with a specific user
router.get('/conversation/:userId', messageController.getConversation);

// Mark message as read
router.patch('/:messageId/read', messageController.markAsRead);

// Mark messages as seen
router.post('/seen', messageController.markAsSeen);

// Delete message
router.delete('/:messageId', messageController.deleteMessage);

// Get unread message count
router.get('/unread/count', messageController.getUnreadCount);

module.exports = router;
