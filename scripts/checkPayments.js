const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/Job');
const Payment = require('../models/Payment');

const checkPayments = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in .env file');
    }
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get the most recent payments
    const payments = await Payment.find()
      .populate('employerId', 'firstName lastName email')
      .populate('workerId', 'firstName lastName email')
      .populate('jobId', 'title price')
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`📊 Found ${payments.length} recent payments:\n`);

    payments.forEach((payment, index) => {
      console.log(`${index + 1}. Payment #${payment._id}`);
      console.log(`   Job: ${payment.jobId?.title || 'N/A'}`);
      console.log(`   Employer: ${payment.employerId?.firstName} ${payment.employerId?.lastName} (${payment.employerId?.email})`);
      console.log(`   Worker: ${payment.workerId?.firstName} ${payment.workerId?.lastName} (${payment.workerId?.email})`);
      console.log(`   Amount: ₱${payment.amount?.toLocaleString()} (Worker gets: ₱${payment.workerAmount?.toLocaleString()})`);
      console.log(`   Platform Fee: ₱${payment.platformFee?.toLocaleString()}`);
      console.log(`   Payment Method: ${payment.paymentMethod?.toUpperCase()}`);
      console.log(`   Status: ${payment.status?.toUpperCase()}`);
      console.log(`   PayMongo Source ID: ${payment.paymongoSourceId || 'N/A'}`);
      console.log(`   PayMongo Payment ID: ${payment.paymongoPaymentId || 'N/A'}`);
      console.log(`   Created: ${payment.createdAt?.toLocaleString()}`);
      console.log(`   Updated: ${payment.updatedAt?.toLocaleString()}`);
      console.log('-----------------------------------\n');
    });

    // Check for specific job ID (if provided)
    const jobId = process.argv[2];
    if (jobId) {
      console.log(`\n🔍 Searching for payments for job: ${jobId}\n`);
      const jobPayments = await Payment.find({ jobId: jobId })
        .populate('employerId', 'firstName lastName email')
        .populate('workerId', 'firstName lastName email')
        .sort({ createdAt: -1 });

      if (jobPayments.length === 0) {
        console.log('❌ No payments found for this job\n');
      } else {
        jobPayments.forEach((payment, index) => {
          console.log(`${index + 1}. Payment #${payment._id}`);
          console.log(`   Amount: ₱${payment.amount?.toLocaleString()}`);
          console.log(`   Status: ${payment.status?.toUpperCase()}`);
          console.log(`   Method: ${payment.paymentMethod?.toUpperCase()}`);
          console.log(`   Created: ${payment.createdAt?.toLocaleString()}`);
          console.log('-----------------------------------\n');
        });
      }
    }

    // Show payment statistics
    const totalPayments = await Payment.countDocuments();
    const pendingPayments = await Payment.countDocuments({ status: 'pending' });
    const paidPayments = await Payment.countDocuments({ status: 'paid' });
    const failedPayments = await Payment.countDocuments({ status: 'failed' });

    console.log('\n📈 Payment Statistics:');
    console.log(`   Total Payments: ${totalPayments}`);
    console.log(`   Pending: ${pendingPayments}`);
    console.log(`   Paid: ${paidPayments}`);
    console.log(`   Failed: ${failedPayments}`);

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkPayments();
