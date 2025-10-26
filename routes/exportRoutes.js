const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const auth = require('../middleware/auth');
const verifyAdmin = require('../middleware/verifyAdmin');
const { exportLimiter } = require('../middleware/rateLimit');

// All routes require authentication, admin privileges, and rate limiting
router.use(auth.verify);
router.use(verifyAdmin);
router.use(exportLimiter);

// Export data with query parameter filters
router.get('/:type', exportController.exportData);

// Export filtered data with POST request (for complex filters)
router.post('/:type/filtered', exportController.exportFilteredData);

module.exports = router;