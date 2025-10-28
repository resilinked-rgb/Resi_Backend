const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function updateEmailVerification() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 
      "mongodb+srv://resilinked_db_admin:dDJwBzfpJvaBUQqt@resilinked.bddvynh.mongodb.net/ResiLinked?retryWrites=true&w=majority";
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Update all users to set isEmailVerified = true
    const result = await User.updateMany(
      {},
      { $set: { isEmailVerified: true } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users`);
    console.log(`📊 Total users matched: ${result.matchedCount}`);

    // Display updated users
    const users = await User.find({}).select('email firstName lastName isEmailVerified isVerified');
    console.log('\n📋 Updated Users:');
    users.forEach(user => {
      console.log(`  - ${user.email}: Email Verified: ${user.isEmailVerified}, Admin Approved: ${user.isVerified}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error updating users:', error);
    process.exit(1);
  }
}

updateEmailVerification();
