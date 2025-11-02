require('dotenv').config();
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Job = require('../models/Job');
const paymongo = require('../utils/paymongoService');
const { addIncomeToActiveGoal } = require('../controllers/goalController');
const { createNotification } = require('../utils/notificationHelper');

/**
 * Script to check and fix stuck payments
 * This checks PayMongo for the actual payment status and updates local database
 */
const fixStuckPayments = async () => {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all payments that are stuck in pending or processing
    const stuckPayments = await Payment.find({
      status: { $in: ['pending', 'processing'] },
      createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } // Older than 5 minutes
    })
      .populate('jobId', 'title price')
      .populate('employerId', 'firstName lastName')
      .populate('workerId', 'firstName lastName');

    if (stuckPayments.length === 0) {
      console.log('✅ No stuck payments found');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n📋 Found ${stuckPayments.length} potentially stuck payment(s)\n`);

    for (const payment of stuckPayments) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Payment ID: ${payment._id}`);
      console.log(`Job: ${payment.jobId?.title || 'Unknown'}`);
      console.log(`Current Status: ${payment.status}`);
      console.log(`Amount: ₱${payment.amount}`);
      console.log(`Created: ${payment.createdAt}`);
      console.log(`Payment Method: ${payment.paymentMethod}`);

      let updated = false;

      // Check PayMongo payment intent status
      if (payment.paymongoPaymentIntentId) {
        try {
          console.log(`\n🔍 Checking PayMongo Payment Intent: ${payment.paymongoPaymentIntentId}`);
          const intentData = await paymongo.getPaymentIntent(payment.paymongoPaymentIntentId);
          const paymongoStatus = intentData.data.attributes.status;
          
          console.log(`PayMongo Status: ${paymongoStatus}`);
          
          if (paymongoStatus === 'succeeded' && payment.status !== 'succeeded') {
            console.log('✅ Payment is actually SUCCEEDED in PayMongo! Updating...');
            
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
              console.log('✅ Job marked as completed');
              
              // Add income to goal
              await addIncomeToActiveGoal(payment.workerId._id, payment.workerAmount);
              console.log('✅ Income added to worker goal');
              
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
              console.log('✅ Notifications sent');
            }
          } else if (paymongoStatus === 'awaiting_payment_method') {
            console.log('⏳ Still waiting for payment method');
          } else if (paymongoStatus === 'processing') {
            console.log('⏳ Payment is still processing');
          } else {
            console.log(`⚠️ Unexpected status: ${paymongoStatus}`);
          }
        } catch (error) {
          console.error('❌ Error checking payment intent:', error.message);
        }
      }

      // Check source status
      if (payment.paymongoSourceId) {
        try {
          console.log(`\n🔍 Checking PayMongo Source: ${payment.paymongoSourceId}`);
          const sourceData = await paymongo.getSource(payment.paymongoSourceId);
          const sourceStatus = sourceData.data.attributes.status;
          
          console.log(`Source Status: ${sourceStatus}`);
          
          if (sourceStatus === 'chargeable' && payment.status === 'pending') {
            console.log('⚠️ Source is chargeable but payment not created! Creating payment...');
            
            try {
              const paymentData = await paymongo.createPayment(
                payment.paymongoSourceId,
                paymongo.phpToCentavos(payment.amount),
                payment.description
              );
              
              payment.status = 'processing';
              payment.paymongoPaymentId = paymentData.data.id;
              await payment.save();
              updated = true;
              
              console.log('✅ Payment created from source');
            } catch (createError) {
              console.error('❌ Failed to create payment:', createError.message);
            }
          } else if (sourceStatus === 'failed' || sourceStatus === 'cancelled') {
            console.log('❌ Source failed or cancelled');
            payment.status = 'failed';
            payment.errorMessage = `Source ${sourceStatus}`;
            await payment.save();
            updated = true;
          }
        } catch (error) {
          console.error('❌ Error checking source:', error.message);
        }
      }

      if (updated) {
        console.log('\n✅ Payment record updated successfully!');
      } else {
        console.log('\n⏸️ No updates needed');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Finished checking all stuck payments');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the script
fixStuckPayments();
