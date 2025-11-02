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

    // Validate job and check for existing payment in parallel
    console.log('🔍 Looking up job:', jobId);
    const [job, existingPayment] = await Promise.all([
      Job.findById(jobId).populate('postedBy assignedTo').lean(),
      Payment.findOne({ 
        jobId: jobId,
        status: { $in: ['succeeded', 'processing', 'pending'] }
      })
    ]);

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

    // Check if payment already exists or is in progress
    if (existingPayment) {
      return res.status(400).json({ 
        message: 'Payment already exists for this job',
        payment: existingPayment,
        status: existingPayment.status
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
      // Get the primary frontend URL (first one in the list)
      const frontendUrl = process.env.FRONTEND_URL.split(',')[0].trim();
      const redirectUrl = {
        success: `${frontendUrl}/payment/success?jobId=${jobId}`,
        failed: `${frontendUrl}/payment/failed?jobId=${jobId}`
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
    
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({ 
        message: 'Payment gateway timeout. Please try again.',
        error: 'Request timed out',
        retry: true
      });
    }

    // Handle PayMongo API errors
    if (error.response?.data) {
      return res.status(error.response.status || 500).json({ 
        message: 'Payment initiation failed',
        error: error.response.data.errors?.[0]?.detail || error.message,
        retry: true
      });
    }

    res.status(500).json({ 
      message: 'Failed to initiate payment',
      error: error.message,
      retry: true
    });
  }
};

/**
 * Webhook handler for PayMongo events
 * POST /api/payments/webhook
 */
exports.handleWebhook = async (req, res) => {
  try {
    // PayMongo sends event directly in req.body, not req.body.data
    const event = req.body.data || req.body;
    const eventType = event.attributes?.type;
    
    if (!eventType) {
      console.error('❌ Invalid webhook payload:', req.body);
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log('📥 PayMongo webhook received:', eventType);
    console.log('Event data:', JSON.stringify(event.attributes?.data || {}, null, 2));

    // Handle source.chargeable event (for GCash, GrabPay, PayMaya)
    if (eventType === 'source.chargeable') {
      const sourceId = event.attributes.data.id;
      console.log('🔍 Looking for payment with sourceId:', sourceId);
      
      const payment = await Payment.findOne({ paymongoSourceId: sourceId });

      if (!payment) {
        console.error('❌ Payment not found for source:', sourceId);
        return res.status(404).json({ error: 'Payment not found' });
      }

      console.log('✅ Payment found:', payment._id);

      // Only create PayMongo payment if not already processing
      if (payment.status === 'pending' && !payment.paymongoPaymentId) {
        try {
          console.log('💳 Creating PayMongo payment from source...');
          const paymentData = await paymongo.createPayment(
            sourceId,
            paymongo.phpToCentavos(payment.amount),
            payment.description
          );

          payment.status = 'processing';
          payment.paymongoPaymentId = paymentData.data.id;
          payment.paymongoResponse = paymentData;
          await payment.save();
          
          console.log('✅ Payment created successfully:', paymentData.data.id);
        } catch (paymentError) {
          console.error('❌ Failed to create payment:', paymentError.message);
          payment.status = 'failed';
          payment.errorMessage = paymentError.message;
          await payment.save();
          
          // Notify employer
          await createNotification({
            recipient: payment.employerId,
            type: 'payment_failed',
            message: `Payment processing failed. Please try again.`,
            relatedJob: payment.jobId
          });
        }
      } else {
        console.log('⏭️ Payment already processing or has paymentId:', payment.status);
      }
    }

    // Handle payment.paid event
    if (eventType === 'payment.paid') {
      const paymentId = event.attributes.data.id;
      console.log('🔍 Looking for payment with paymentId:', paymentId);
      
      const payment = await Payment.findOne({ paymongoPaymentId: paymentId });

      if (!payment) {
        console.error('❌ Payment not found for paymentId:', paymentId);
        return res.status(404).json({ error: 'Payment not found' });
      }

      console.log('✅ Payment found:', payment._id, 'Current status:', payment.status);

      // Update payment to succeeded (not just "paid")
      if (payment.status !== 'succeeded') {
        payment.status = 'succeeded';
        payment.paidAt = new Date();
        await payment.save();

        console.log('✅ Payment marked as succeeded:', paymentId);

        // Mark job as completed
        const job = await Job.findById(payment.jobId);
        if (job && !job.completed) {
          job.completed = true;
          job.completedAt = new Date();
          await job.save();

          console.log('✅ Job marked as completed:', job._id);

          // Add income to worker's active goal (worker receives workerAmount, not total amount)
          try {
            await addIncomeToActiveGoal(payment.workerId, payment.workerAmount);
            console.log('✅ Income added to worker goal:', payment.workerAmount);
          } catch (goalError) {
            console.error('⚠️ Failed to update goal:', goalError.message);
            // Don't fail webhook if goal update fails
          }

          // Send notifications in parallel
          await Promise.all([
            createNotification({
              recipient: payment.workerId,
              type: 'payment_received',
              message: `Payment of ₱${payment.workerAmount.toLocaleString()} received for job: ${job.title}`,
              relatedJob: payment.jobId
            }),
            createNotification({
              recipient: payment.employerId,
              type: 'payment_confirmed',
              message: `Payment confirmed for job: ${job.title}`,
              relatedJob: payment.jobId
            })
          ]);

          console.log('✅ Notifications sent successfully');
        } else {
          console.log('⏭️ Job already completed or not found');
        }
      } else {
        console.log('⏭️ Payment already marked as succeeded');
      }
    }

    // Handle payment.failed event
    if (eventType === 'payment.failed') {
      const paymentId = event.attributes.data.id;
      console.log('🔍 Looking for failed payment with paymentId:', paymentId);
      
      const payment = await Payment.findOne({ paymongoPaymentId: paymentId });

      if (payment) {
        payment.status = 'failed';
        payment.errorMessage = event.attributes.data.attributes?.last_payment_error?.message || 'Payment failed';
        await payment.save();

        console.log('❌ Payment marked as failed:', paymentId);

        // Notify employer
        await createNotification({
          recipient: payment.employerId,
          type: 'payment_failed',
          message: `Payment failed: ${payment.errorMessage}. Please try again.`,
          relatedJob: payment.jobId
        });

        console.log('✅ Failure notification sent');
      } else {
        console.error('❌ Failed payment not found:', paymentId);
      }
    }

    res.status(200).json({ received: true, eventType });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    console.error('Error stack:', error.stack);
    // Still return 200 to prevent PayMongo from retrying
    res.status(200).json({ 
      received: false, 
      error: error.message 
    });
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

    // Ensure no caching for payment status
    res.removeHeader('ETag');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Last-Modified', new Date().toUTCString());

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

    // Ensure no caching for payment data (sensitive financial information)
    res.removeHeader('ETag');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Last-Modified', new Date().toUTCString());

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

    // Ensure no caching for payment history (sensitive financial data)
    res.removeHeader('ETag');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Last-Modified', new Date().toUTCString());

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

/**
 * Manually check and update payment status from PayMongo
 * POST /api/payments/:paymentId/check-status
 */
exports.checkPaymentStatusFromPayMongo = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId)
      .populate('jobId', 'title price')
      .populate('employerId', 'firstName lastName')
      .populate('workerId', 'firstName lastName');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Verify user has access
    const userId = req.user.id;
    if (payment.employerId._id.toString() !== userId && payment.workerId._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let paymongoStatus = null;
    let updated = false;

    // Check PayMongo payment intent status
    if (payment.paymongoPaymentIntentId) {
      try {
        const intentData = await paymongo.getPaymentIntent(payment.paymongoPaymentIntentId);
        paymongoStatus = intentData.data.attributes.status;
        
        console.log('PayMongo Intent Status:', paymongoStatus);
        
        // Update payment status if it changed
        if (paymongoStatus === 'succeeded' && payment.status !== 'succeeded') {
          payment.status = 'succeeded';
          payment.paidAt = new Date();
          await payment.save();
          updated = true;
          
          // Complete job
          const job = await Job.findById(payment.jobId);
          if (job && !job.completed) {
            job.completed = true;
            job.completedAt = new Date();
            await job.save();
            
            await addIncomeToActiveGoal(payment.workerId._id, payment.workerAmount);
            
            // Send notifications
            await Promise.all([
              createNotification({
                recipient: payment.workerId._id,
                type: 'payment_received',
                message: `Payment of ₱${payment.workerAmount.toLocaleString()} received for job: ${job.title}`,
                relatedJob: payment.jobId
              }),
              createNotification({
                recipient: payment.employerId._id,
                type: 'payment_confirmed',
                message: `Payment confirmed for job: ${job.title}`,
                relatedJob: payment.jobId
              })
            ]);
          }
        }
      } catch (error) {
        console.error('Error checking PayMongo intent:', error.message);
      }
    }

    // Check source status
    if (payment.paymongoSourceId) {
      try {
        const sourceData = await paymongo.getSource(payment.paymongoSourceId);
        const sourceStatus = sourceData.data.attributes.status;
        
        console.log('PayMongo Source Status:', sourceStatus);
        paymongoStatus = sourceStatus;
      } catch (error) {
        console.error('Error checking PayMongo source:', error.message);
      }
    }

    res.status(200).json({
      success: true,
      payment: payment,
      paymongoStatus: paymongoStatus,
      updated: updated,
      message: updated ? 'Payment status updated successfully' : 'Payment status is current'
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ 
      message: 'Failed to check payment status',
      error: error.message
    });
  }
};
