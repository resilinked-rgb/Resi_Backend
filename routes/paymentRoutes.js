const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verify: auth } = require('../middleware/auth');

// Initiate payment for job completion
router.post('/initiate', auth, paymentController.initiatePayment);

// PayMongo webhook endpoint (no auth required)
router.post('/webhook', paymentController.handleWebhook);

// Get payment status
router.get('/:paymentId/status', auth, paymentController.getPaymentStatus);

// Get payments for a specific job
router.get('/job/:jobId', auth, paymentController.getJobPayments);

// Get user's payment history (sent or received)
router.get('/my-payments', auth, paymentController.getMyPayments);

module.exports = router;
