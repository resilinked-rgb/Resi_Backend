const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verify: auth } = require('../middleware/auth');

// Middleware to disable caching for payment data (real-time/sensitive data)
const noCacheMiddleware = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
};

// Initiate payment for job completion
router.post('/initiate', auth, paymentController.initiatePayment);

// PayMongo webhook endpoint (no auth required)
router.post('/webhook', paymentController.handleWebhook);

// Get payment status (no cache - payment status changes frequently)
router.get('/:paymentId/status', auth, noCacheMiddleware, paymentController.getPaymentStatus);

// Get payments for a specific job (no cache - payment data is sensitive)
router.get('/job/:jobId', auth, noCacheMiddleware, paymentController.getJobPayments);

// Get user's payment history (no cache - financial data must be current)
router.get('/my-payments', auth, noCacheMiddleware, paymentController.getMyPayments);

// Manually check payment status from PayMongo (for debugging stuck payments)
router.post('/:paymentId/check-status', auth, paymentController.checkPaymentStatusFromPayMongo);

module.exports = router;
