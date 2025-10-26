const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const auth = require('../middleware/auth');
const verifyAdmin = require('../middleware/verifyAdmin');

// All routes require authentication
router.use(auth.verify);

// Get user activity - user can view their own activity, admin can view any user's activity
router.get('/users/:userId', async (req, res, next) => {
  try {
    // Allow users to view their own activity or admin to view any activity
    if (req.params.userId === req.user.id || req.user.userType === 'admin') {
      return activityController.getUserActivity(req, res);
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
        alert: "You can only view your own activity"
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get recent activity - admin only
router.get('/recent', verifyAdmin, activityController.getRecentActivity);

// Get activity statistics - admin only
router.get('/stats', verifyAdmin, activityController.getActivityStats);

// Get my activity (current user)
router.get('/me', (req, res, next) => {
  req.params.userId = req.user.id;
  return activityController.getUserActivity(req, res, next);
});

module.exports = router;