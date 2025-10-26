const Notification = require('../models/Notification');

/**
 * Create a notification for a user.
 * @param {Object} opts
 * @param {string|ObjectId} opts.recipient - User ID
 * @param {string} opts.type - Notification type (e.g., 'job_accepted')
 * @param {string} opts.message - Notification message
 * @param {string|ObjectId} [opts.relatedJob] - Related Job ID
 * @returns {Promise<Notification>}
 */
exports.createNotification = async ({ recipient, type, message, relatedJob }) => {
    const notification = new Notification({
        recipient,
        type,
        message,
        relatedJob,
        isRead: false
    });
    await notification.save();
    return notification;
};