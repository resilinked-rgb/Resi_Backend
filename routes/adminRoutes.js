const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const verifyAdmin = require('../middleware/verifyAdmin');

// Apply both authentication & admin check
router.use(auth.verify, verifyAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// User management
router.get('/users', adminController.searchUsers);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id', adminController.editUser);

// 👉 Add user activity + jobs routes
router.get('/users/:id/activity', adminController.getUserActivity);
router.get('/users/:id/jobs', adminController.getUserJobs);

// Job management
router.get('/jobs', adminController.getAllJobs);
router.delete('/jobs/:id', adminController.deleteJob);
router.put('/jobs/:id', adminController.editJob);

// Reports
router.get('/users/download/pdf', adminController.downloadUsersPdf);
router.get('/export/users', adminController.exportUsers);
router.get('/export/jobs', adminController.exportJobs);
router.get('/export/ratings', adminController.exportRatings);

// Local error handler
router.use((err, req, res, next) => {
  console.error('Admin route error:', err.stack || err);
  res.status(500).json({
    success: false,
    message: 'Admin operation failed',
    error: err.message || err
  });
});

module.exports = router;
