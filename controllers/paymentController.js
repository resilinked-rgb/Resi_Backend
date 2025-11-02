const Payment = require('../models/Payment');
const Job = require('../models/Job');
const User = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');
const { sendSMS } = require('../utils/smsService');
const paymongo = require('../utils/paymongoService');
const { addIncomeToActiveGoal } = require('./goalController');

/**
 * Initiate payment for job completion
 * POST /api/payments/initiate
 */
exports.initiatePayment = async (req, res) => {
  try {
    console.log('💰 Payment initiation request received');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?.id);
    
    const { jobId, paymentMethod, receiptImage } = req.body;
    const employerId = req.user.id;

    // Validate job
    console.log('🔍 Looking up job:', jobId);
    const job = await Job.findById(jobId).populate('postedBy assignedTo');
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Verify employer owns this job
    if (job.postedBy._id.toString() !== employerId) {
      return res.status(403).json({ message: 'Not authorized to pay for this job' });
    }

    // Verify job has an assigned worker
    if (!job.assignedTo) {
      return res.status(400).json({ message: 'No worker has been assigned to this job' });
    }

    // Check if payment already exists
    const existingPayment = await Payment.findOne({ 
      jobId: jobId,
      status: { $in: ['succeeded', 'processing'] }
    });
    
    if (existingPayment) {
      return res.status(400).json({ 
        message: 'Payment already processed for this job',
        payment: existingPayment
      });
    }

    const workerId = job.assignedTo._id;
    const jobPrice = job.price;
    
    // Platform fee configuration (10% platform fee)
    const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '10');
    const platformFee = Math.round((jobPrice * PLATFORM_FEE_PERCENTAGE) / 100);
    const workerAmount = jobPrice; // Worker receives full job price
    const totalAmount = jobPrice + platformFee; // Employer pays job price + platform fee
    
    const totalAmountInCentavos = paymongo.phpToCentavos(totalAmount);

    // Handle manual payment (old verification image method)
    if (paymentMethod === 'manual') {
      const payment = new Payment({
        jobId: jobId,
        employerId: employerId,
        workerId: workerId,
        amount: totalAmount, // Total amount employer pays
        workerAmount: workerAmount, // Amount worker receives
        platformFee: platformFee, // Platform fee amount
        paymentMethod: 'manual',
        receiptImage: receiptImage || null,
        status: 'succeeded',
        description: `Manual payment for job: ${job.title}`,
        paidAt: new Date()
      });

      await payment.save();

      // Mark job as completed
      job.completed = true;
      job.completedAt = new Date();
      await job.save();

      // Add income to worker's active goal (worker receives full job price)
      await addIncomeToActiveGoal(workerId, workerAmount);

      // Send notifications
      await createNotification({
        recipient: workerId,
        type: 'job_completed',
        message: `Job "${job.title}" has been marked as completed. Payment: ₱${workerAmount.toLocaleString()}`,
        relatedJob: jobId
      });

      return res.status(200).json({
        message: 'Payment recorded successfully',
        payment: payment,
        breakdown: {
          jobPrice: jobPrice,
          platformFee: platformFee,
          totalAmount: totalAmount,
          workerReceives: workerAmount
        }
      });
    }

    // Handle PayMongo payments (gcash, paymaya, grab_pay, card)
    if (['gcash', 'paymaya', 'grab_pay'].includes(paymentMethod)) {
      // Create PayMongo source for e-wallet payments
      const redirectUrl = {
        success: `${process.env.FRONTEND_URL}/payment/success?jobId=${jobId}`,
        failed: `${process.env.FRONTEND_URL}/payment/failed?jobId=${jobId}`
      };

      const sourceData = await paymongo.createSource({
        amount: totalAmountInCentavos, // Charge total amount (job price + platform fee)
        type: paymentMethod,
        redirectUrl: redirectUrl,
        metadata: {
          jobId: jobId.toString(),
          employerId: employerId.toString(),
          workerId: workerId.toString(),
          jobTitle: job.title,
          jobPrice: jobPrice.toString(),
          platformFee: platformFee.toString(),
          totalAmount: totalAmount.toString()
        }
      });

      // Create payment record
      const payment = new Payment({
        jobId: jobId,
        employerId: employerId,
        workerId: workerId,
        amount: totalAmount,
        workerAmount: workerAmount,
        platformFee: platformFee,
        paymentMethod: paymentMethod,
        status: 'pending',
        description: `Payment for job: ${job.title} (Job: ₱${jobPrice} + Platform Fee: ₱${platformFee})`,
        paymongoSourceId: sourceData.data.id,
        paymongoResponse: sourceData,
        receiptImage: receiptImage || null
      });

      await payment.save();

      return res.status(200).json({
        message: 'Payment initiated',
        payment: payment,
        checkoutUrl: sourceData.data.attributes.redirect.checkout_url,
        sourceId: sourceData.data.id,
        breakdown: {
          jobPrice: jobPrice,
          platformFee: platformFee,
          totalAmount: totalAmount,
          workerReceives: workerAmount
        }
      });
    }

    // Handle card payments (requires payment intent)
    if (paymentMethod === 'card') {
      const paymentIntentData = await paymongo.createPaymentIntent({
        amount: totalAmountInCentavos, // Charge total amount (job price + platform fee)
        description: `Payment for job: ${job.title} (Job: ₱${jobPrice} + Platform Fee: ₱${platformFee})`,
        metadata: {
          jobId: jobId.toString(),
          employerId: employerId.toString(),
          workerId: workerId.toString(),
          jobTitle: job.title,
          jobPrice: jobPrice.toString(),
          platformFee: platformFee.toString(),
          totalAmount: totalAmount.toString()
        }
      });

      // Create payment record
      const payment = new Payment({
        jobId: jobId,
        employerId: employerId,
        workerId: workerId,
        amount: totalAmount,
        workerAmount: workerAmount,
        platformFee: platformFee,
        paymentMethod: 'card',
        status: 'pending',
        description: `Payment for job: ${job.title} (Job: ₱${jobPrice} + Platform Fee: ₱${platformFee})`,
        paymongoPaymentIntentId: paymentIntentData.data.id,
        paymongoResponse: paymentIntentData,
        receiptImage: receiptImage || null
      });

      await payment.save();

      return res.status(200).json({
        message: 'Payment intent created',
        payment: payment,
        clientKey: paymentIntentData.data.attributes.client_key,
        paymentIntentId: paymentIntentData.data.id,
        breakdown: {
          jobPrice: jobPrice,
          platformFee: platformFee,
          totalAmount: totalAmount,
          workerReceives: workerAmount
        }
      });
    }

    return res.status(400).json({ 
      message: 'Invalid payment method',
      allowedMethods: ['gcash', 'paymaya', 'grab_pay', 'card', 'manual']
    });

  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ 
      message: 'Failed to initiate payment',
      error: error.message
    });
  }
};

/**
 * Webhook handler for PayMongo events
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res) => {
  try {
    const event = req.body.data;
    
    console.log('PayMongo webhook received:', event.attributes.type);

    // Handle source.chargeable event (for GCash, GrabPay, etc.)
    if (event.attributes.type === 'source.chargeable') {
      const sourceId = event.attributes.data.id;
      const payment = await Payment.findOne({ paymongoSourceId: sourceId });

      if (payment) {
        // Create payment from source
        const paymentData = await paymongo.createPayment(
          sourceId,
          paymongo.phpToCentavos(payment.amount),
          payment.description
        );

        payment.status = 'processing';
        payment.paymongoPaymentId = paymentData.data.id;
        payment.paymongoResponse = paymentData;
        await payment.save();
      }
    }

    // Handle payment.paid event
    if (event.attributes.type === 'payment.paid') {
      const paymentId = event.attributes.data.id;
      const payment = await Payment.findOne({ paymongoPaymentId: paymentId });

      if (payment) {
        payment.status = 'paid';
        payment.paidAt = new Date();
        await payment.save();

        console.log('✅ Payment marked as paid:', paymentId);

        // Mark job as completed
        const job = await Job.findById(payment.jobId);
        if (job) {
          job.completed = true;
          job.completedAt = new Date();
          await job.save();

          console.log('✅ Job marked as completed:', job._id);

          // Add income to worker's active goal (worker receives workerAmount, not total amount)
          await addIncomeToActiveGoal(payment.workerId, payment.workerAmount);

          // Send notification to worker
          await createNotification({
            recipient: payment.workerId,
            type: 'payment_received',
            message: `Payment of ₱${payment.amount.toLocaleString()} received for job: ${job.title}`,
            relatedJob: payment.jobId
          });

          // Send notification to employer
          await createNotification({
            recipient: payment.employerId,
            type: 'payment_confirmed',
            message: `Payment confirmed for job: ${job.title}`,
            relatedJob: payment.jobId
          });
        }
      }
    }

    // Handle payment.failed event
    if (event.attributes.type === 'payment.failed') {
      const paymentId = event.attributes.data.id;
      const payment = await Payment.findOne({ paymongoPaymentId: paymentId });

      if (payment) {
        payment.status = 'failed';
        payment.errorMessage = event.attributes.data.attributes.last_payment_error?.message || 'Payment failed';
        await payment.save();

        // Notify employer
        await createNotification({
          recipient: payment.employerId,
          type: 'payment_failed',
          message: `Payment failed for job. Please try again.`,
          relatedJob: payment.jobId
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Check payment status
 * GET /api/payments/:paymentId/status
 */
exports.getPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate('jobId', 'title price')
      .populate('employerId', 'firstName lastName')
      .populate('workerId', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Verify user has access to this payment
    const userId = req.user.id;
    if (payment.employerId._id.toString() !== userId && payment.workerId._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.status(200).json({
      success: true,
      payment: payment
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ 
      message: 'Failed to get payment status',
      error: error.message
    });
  }
};

/**
 * Get payments for a job
 * GET /api/payments/job/:jobId
 */
exports.getJobPayments = async (req, res) => {
  try {
    const { jobId } = req.params;

    const payments = await Payment.find({ jobId: jobId })
      .populate('employerId', 'firstName lastName')
      .populate('workerId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      payments: payments
    });
  } catch (error) {
    console.error('Error getting job payments:', error);
    res.status(500).json({ 
      message: 'Failed to get job payments',
      error: error.message
    });
  }
};

/**
 * Get user's payment history
 * GET /api/payments/my-payments
 */
exports.getMyPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type = 'all' } = req.query; // 'sent', 'received', or 'all'

    let query = {};
    if (type === 'sent') {
      query.employerId = userId;
    } else if (type === 'received') {
      query.workerId = userId;
    } else {
      query.$or = [
        { employerId: userId },
        { workerId: userId }
      ];
    }

    const payments = await Payment.find(query)
      .populate('jobId', 'title price')
      .populate('employerId', 'firstName lastName profilePicture')
      .populate('workerId', 'firstName lastName profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      payments: payments,
      total: payments.length
    });
  } catch (error) {
    console.error('Error getting user payments:', error);
    res.status(500).json({ 
      message: 'Failed to get payments',
      error: error.message
    });
  }
};
