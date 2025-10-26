const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

// Barangay stats
router.get('/barangay', auth.verify, dashboardController.barangayStats);

// Employee dashboard stats
router.get('/employee/:id/stats', auth.verify, dashboardController.employeeDashboardStats);
// User search/PDF
router.get('/search-users', auth.verify, dashboardController.searchUsers);
router.get('/download-users-pdf', auth.verify, dashboardController.downloadUsersPdf);

// Job search/PDF
router.get('/search-jobs', auth.verify, dashboardController.searchJobs);
router.get('/download-jobs-pdf', auth.verify, dashboardController.downloadJobsPdf);

// Rating search/PDF
router.get('/search-ratings', auth.verify, dashboardController.searchRatings);
router.get('/download-ratings-pdf', auth.verify, dashboardController.downloadRatingsPdf);

// Admin-only edit/delete
router.patch('/admin/user/:id', auth.verify, auth.verifyAdmin, dashboardController.adminEditUser);
router.delete('/admin/user/:id', auth.verify, auth.verifyAdmin, dashboardController.adminDeleteUser);

router.patch('/admin/job/:id', auth.verify, auth.verifyAdmin, dashboardController.adminEditJob);
router.delete('/admin/job/:id', auth.verify, auth.verifyAdmin, dashboardController.adminDeleteJob);

router.patch('/admin/rating/:id', auth.verify, auth.verifyAdmin, dashboardController.adminEditRating);
router.delete('/admin/rating/:id', auth.verify, auth.verifyAdmin, dashboardController.adminDeleteRating);

router.patch('/admin/report/:id', auth.verify, auth.verifyAdmin, dashboardController.adminEditReport);
router.delete('/admin/report/:id', auth.verify, auth.verifyAdmin, dashboardController.adminDeleteReport);

module.exports = router;
