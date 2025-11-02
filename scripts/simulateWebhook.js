const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const simulateWebhook = async () => {
  try {
    // Get payment ID from command line
    const paymentMongoId = process.argv[2];
    
    if (!paymentMongoId) {
      console.log('Usage: node simulateWebhook.js <payment_mongodb_id>');
      console.log('Example: node simulateWebhook.js 6906e2cf31a5f51392d42383');
      process.exit(1);
    }

    console.log('🧪 Simulating PayMongo webhook for payment:', paymentMongoId);
    console.log('');

    // First, get the payment details from database
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const Job = require('../models/Job');
    const Payment = require('../models/Payment');

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in .env file');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const payment = await Payment.findById(paymentMongoId);
    
    if (!payment) {
      console.log('❌ Payment not found in database');
      process.exit(1);
    }

    console.log('📋 Payment found:');
    console.log(`   PayMongo Source ID: ${payment.paymongoSourceId}`);
    console.log(`   PayMongo Payment ID: ${payment.paymongoPaymentId || 'Not set yet'}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Amount: ₱${payment.amount}`);
    console.log('');

    // Generate a test payment ID if not exists
    const testPaymentId = payment.paymongoPaymentId || ('pay_test_' + Date.now());
    
    // Update payment with test payment ID if it doesn't have one
    if (!payment.paymongoPaymentId) {
      console.log('⚠️ Payment doesn\'t have PayMongo Payment ID yet');
      console.log('   Setting test payment ID:', testPaymentId);
      payment.paymongoPaymentId = testPaymentId;
      await payment.save();
      console.log('');
    }

    // Simulate the webhook payload
    const webhookPayload = {
      data: {
        id: 'evt_test_' + Date.now(),
        type: 'event',
        attributes: {
          type: 'payment.paid',
          livemode: false,
          data: {
            id: testPaymentId,
            type: 'payment',
            attributes: {
              amount: payment.amount * 100, // In centavos
              currency: 'PHP',
              status: 'paid',
              paid_at: Math.floor(Date.now() / 1000),
              source: {
                id: payment.paymongoSourceId,
                type: 'source'
              }
            }
          },
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        }
      }
    };

    console.log('📤 Sending webhook to backend...');
    
    const webhookUrl = 'http://localhost:5000/api/payments/webhook';
    
    try {
      const response = await axios.post(webhookUrl, webhookPayload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Webhook sent successfully!');
      console.log('Response:', response.data);
    } catch (webhookError) {
      if (webhookError.code === 'ECONNREFUSED') {
        console.log('❌ Could not connect to backend server');
        console.log('   Make sure your backend is running on http://localhost:5000');
      } else {
        console.log('❌ Webhook error:', webhookError.message);
        if (webhookError.response?.data) {
          console.log('   Response:', webhookError.response.data);
        }
      }
    }

    // Check if payment was updated
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const updatedPayment = await Payment.findById(paymentMongoId);
    console.log('');
    console.log('📊 Updated payment status:', updatedPayment.status);
    
    if (updatedPayment.status === 'paid') {
      console.log('✅ Payment successfully marked as paid!');
      
      // Check if job was completed
      const job = await Job.findById(payment.jobId);
      if (job) {
        console.log('📋 Job status:');
        console.log(`   Completed: ${job.completed}`);
        console.log(`   Completed At: ${job.completedAt || 'N/A'}`);
      }
    } else {
      console.log('⚠️ Payment status not updated. Check webhook handler.');
    }

    await mongoose.connection.close();
    console.log('');
    console.log('✅ Done');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

simulateWebhook();
