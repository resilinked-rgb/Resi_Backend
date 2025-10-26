const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

// User reports another user
router.post('/user', auth.verify, reportController.reportUser);

// User reports a job
router.post('/job', auth.verify, reportController.reportJob);

// Admin fetches all reports
router.get('/', auth.verify, auth.verifyAdmin, reportController.getReports);

// Admin updates report status
router.patch('/:id', auth.verify, auth.verifyAdmin, reportController.updateReportStatus);

module.exports = router;
