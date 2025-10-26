const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
        type: String, 
        enum: [
            'job_accepted',
            'job_completed',
            'rating_received',
            'verification_complete',
            'job_applied',
            'admin_message',
            'verification_needed',
            'security_alert',
            'goal_created',
            'job_match', 
            'application_sent',
            'rating_reported',
            'user_reported',  
            'report_resolved',
            'profile_update',
            'job_invitation',
            'application_cancelled',
            'application_rejected',
            'application_update',
            'goal_income_added',
            'goal_completed_job',
            'new_message',
            'message',
            'job_update',
            'account_update',
            'goal_update'
        ],
        required: true
    },
    message: { type: String, required: true },
    relatedJob: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
