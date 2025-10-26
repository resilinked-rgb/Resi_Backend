const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const auth = require('../middleware/auth');

// Notifications
router.get('/', auth.verify, notificationController.getMyNotifications);
router.post('/', auth.verify, notificationController.createNotification);
router.patch('/read-all', auth.verify, notificationController.markAsRead); // Mark all as read
router.patch('/:id/read', auth.verify, notificationController.markAsRead); // Mark single as read
router.delete('/:id', auth.verify, notificationController.deleteNotification);

module.exports = router;