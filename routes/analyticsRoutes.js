const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const auth = require('../middleware/auth');
const verifyAdmin = require('../middleware/verifyAdmin');

// All routes require authentication and admin privileges
router.use(auth.verify);
router.use(verifyAdmin);

// Dashboard statistics
router.get('/dashboard', analyticsController.getDashboardStats);

// User growth analytics
router.get('/user-growth', analyticsController.getUserGrowth);

// Job statistics
router.get('/job-stats', analyticsController.getJobStatistics);

// Popular jobs
router.get('/popular-jobs', analyticsController.getPopularJobs);

module.exports = router;