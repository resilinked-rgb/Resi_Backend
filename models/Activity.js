const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'registration', 
      'profile_update', 
      'job_post', 
      'job_apply', 
      'job_assigned',
      'job_completed',
      'rating_given', 
      'rating_received', 
      'application_sent', 
      'application_accepted', 
      'application_rejected',
      'password_reset',
      'email_verification',
      'admin_action',
      'report_submitted',
      'login',
      'security_alert'
    ]
  },
  description: {
    type: String,
    required: true
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'entityType'
  },
  entityType: {
    type: String,
    enum: ['Job', 'Rating', 'User', 'Report', null]
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Index for better query performance
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });
activitySchema.index({ type: 1 });

module.exports = mongoose.model('Activity', activitySchema);