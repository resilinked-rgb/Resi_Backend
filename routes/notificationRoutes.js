const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/NotificationController');
const auth = require('../middleware/auth');

// Middleware to disable caching for notifications (real-time data)
const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('ETag', ''); // Prevent ETag generation
    next();
};

// Notifications
router.get('/', auth.verify, noCacheMiddleware, notificationController.getMyNotifications);
router.post('/', auth.verify, notificationController.createNotification);
router.patch('/read-all', auth.verify, notificationController.markAsRead); // Mark all as read
router.patch('/:id/read', auth.verify, notificationController.markAsRead); // Mark single as read
router.delete('/:id', auth.verify, notificationController.deleteNotification);

module.exports = router;