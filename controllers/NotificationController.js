const Notification = require('../models/Notification');
const { createNotification } = require('../utils/notificationHelper');

exports.createNotification = async (req, res) => {
    try {
        const { recipient, type, title, message } = req.body;
        
        if (!recipient || !type || !message) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields",
                alert: "Recipient, type, and message are required"
            });
        }

        const notification = await createNotification({
            recipient,
            type,
            title: title || 'Admin Message',
            message,
            sender: req.user.id
        });

        res.status(201).json({
            success: true,
            data: notification,
            message: "Notification sent successfully",
            alert: "Message sent to user successfully"
        });
    } catch (err) {
        console.error('Error creating notification:', err);
        res.status(500).json({
            success: false,
            message: "Error creating notification",
            error: err.message,
            alert: "Failed to send notification"
        });
    }
};

exports.getMyNotifications = async (req, res) => {
    try {
        const { type, isRead, page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

        let query = { recipient: req.user.id };
        if (type) query.type = type;
        if (isRead !== undefined) query.isRead = isRead === 'true';

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean()
                .maxTimeMS(5000),
            Notification.countDocuments(query).maxTimeMS(3000),
            Notification.countDocuments({ 
                recipient: req.user.id, 
                isRead: false 
            }).maxTimeMS(3000)
        ]);

        // Disable caching and ETag for real-time notifications
        res.removeHeader('ETag');
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Last-Modified', new Date().toUTCString());
        
        res.status(200).json({
            success: true,
            data: notifications || [],
            meta: {
                total: total || 0,
                unreadCount: unreadCount || 0,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil((total || 0) / limitNum)
                }
            },
            alert: unreadCount > 0 
                ? `You have ${unreadCount} unread notifications` 
                : "No new notifications"
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ 
            success: false,
            message: "Error fetching notifications", 
            error: err.message,
            alert: "Failed to load notifications",
            data: [],
            meta: { total: 0, unreadCount: 0, pagination: { page: 1, limit: 20, pages: 0 } }
        });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        if (req.body.all) {
            const result = await Notification.updateMany(
                { recipient: req.user.id, isRead: false },
                { $set: { isRead: true } }
            );

            return res.status(200).json({
                message: "All notifications marked as read",
                updatedCount: result.modifiedCount,
                alert: `Marked ${result.modifiedCount} notifications as read`
            });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id, isRead: false },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ 
                message: "Notification not found or already read",
                alert: "Notification not found or already read"
            });
        }

        res.status(200).json({
            message: "Notification marked as read",
            notification,
            alert: "Notification marked as read"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error updating notification", 
            error: err.message,
            alert: "Failed to update notification status"
        });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ 
            _id: req.params.id, 
            recipient: req.user.id 
        });

        if (!notification) {
            return res.status(404).json({ 
                message: "Notification not found",
                alert: "Notification not found or already deleted"
            });
        }

        res.status(200).json({
            message: "Notification deleted",
            deletedNotification: {
                id: notification._id,
                type: notification.type,
                message: notification.message.substring(0, 50) + '...'
            },
            alert: "Notification deleted"
        });
    } catch (err) {
        res.status(500).json({ 
            message: "Error deleting notification", 
            error: err.message,
            alert: "Failed to delete notification"
        });
    }
};
