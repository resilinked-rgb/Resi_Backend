const Activity = require('../models/Activity');
const User = require('../models/User');

// Get user activity - NOW USING REAL DATA
exports.getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
   
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }
   
    // ✅ NOW USING REAL ACTIVITY DATA instead of mock data
    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
   
    res.status(200).json({
      success: true,
      data: activities,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email
      },
      total: activities.length,
      message: `Found ${activities.length} activities for user`
    });
  } catch (err) {
    // Error already handled - don't log details
    res.status(500).json({
      message: "Error fetching user activity",
      error: err.message
    });
  }
};

// Get recent activity - NOW USING REAL DATA
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
   
    // ✅ NOW USING REAL ACTIVITY DATA instead of mock data
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('userId', 'firstName lastName email');
   
    res.status(200).json({
      success: true,
      data: activities,
      total: activities.length,
      message: `Found ${activities.length} recent activities`
    });
  } catch (err) {
    // Error already handled - don't log details
    res.status(500).json({
      message: "Error fetching recent activity",
      error: err.message
    });
  }
};

// Create activity log (utility function for other controllers)
exports.createActivity = async (activityData) => {
  try {
    const activity = new Activity(activityData);
    await activity.save();
    return activity;
  } catch (error) {
    // Don't throw to avoid breaking main functionality
    return null;
  }
};

// Get activity statistics
exports.getActivityStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const stats = await Activity.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      stats: stats,
      period: {
        start: startDate,
        end: new Date(),
        days: parseInt(days)
      },
      message: `Activity statistics for the last ${days} days`
    });
  } catch (err) {
    // Error already handled - don't log details
    res.status(500).json({
      message: "Error fetching activity statistics",
      error: err.message
    });
  }
};

// Log user registration activity
exports.logRegistration = async (userId, userData) => {
  try {
    const user = await User.findById(userId);
    if (user) {
      await this.createActivity({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        type: 'registration',
        description: 'User registered an account',
        metadata: {
          email: user.email,
          userType: user.userType
        }
      });
    }
  } catch (error) {
    // Silent error - activity logging is non-critical
  }
};

// Log profile update activity
exports.logProfileUpdate = async (userId, updatedFields) => {
  try {
    const user = await User.findById(userId);
    if (user) {
      await this.createActivity({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        type: 'profile_update',
        description: 'User updated their profile',
        metadata: {
          updatedFields: Object.keys(updatedFields)
        }
      });
    }
  } catch (error) {
    // Silent error - activity logging is non-critical
  }
};

// Log job post activity
exports.logJobPost = async (userId, jobId, jobTitle) => {
  try {
    const user = await User.findById(userId);
    if (user) {
      await this.createActivity({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        type: 'job_post',
        description: `User posted a new job: ${jobTitle}`,
        relatedEntity: jobId,
        entityType: 'Job',
        metadata: {
          jobTitle: jobTitle
        }
      });
    }
  } catch (error) {
    // Silent error - activity logging is non-critical
  }
};

// Log job application activity
exports.logJobApply = async (userId, jobId, jobTitle, employerId) => {
  try {
    const user = await User.findById(userId);
    const employer = await User.findById(employerId);
    
    if (user && employer) {
      await this.createActivity({
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        type: 'job_apply',
        description: `User applied for job: ${jobTitle}`,
        relatedEntity: jobId,
        entityType: 'Job',
        metadata: {
          jobTitle: jobTitle,
          employer: `${employer.firstName} ${employer.lastName}`
        }
      });
    }
  } catch (error) {
    // Silent error - activity logging is non-critical
  }
};