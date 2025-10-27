require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const accounts = [
  {
    firstName: 'Test',
    lastName: 'Employee',
    email: 'employee@test.com',
    password: 'Employee123!',
    mobileNo: '09123456789',
    barangay: 'Barangay 1',
    address: '123 Test Street',
    idType: 'National ID',
    idNumber: 'EMP-001-2024',
    userType: 'employee',
    bio: 'Test employee account for development',
    skills: ['General Labor', 'Construction'],
    experience: '2 years of experience',
    availability: 'Full-time',
    isVerified: true
  },
  {
    firstName: 'Test',
    lastName: 'Employer',
    email: 'employer@test.com',
    password: 'Employer123!',
    mobileNo: '09234567890',
    barangay: 'Barangay 2',
    address: '456 Business Avenue',
    idType: 'Business Permit',
    idNumber: 'EMP-002-2024',
    userType: 'employer',
    bio: 'Test employer account for development',
    companyName: 'Test Company Inc.',
    companyDescription: 'Leading provider of testing services',
    isVerified: true
  },
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@test.com',
    password: 'Admin123!',
    mobileNo: '09345678901',
    barangay: 'Barangay 3',
    address: '789 Admin Road',
    idType: 'Government ID',
    idNumber: 'ADM-001-2024',
    userType: 'admin',
    bio: 'Test admin account for development',
    isVerified: true
  }
];

async function createAccount(accountData) {
  try {
    console.log(`\n📝 Creating ${accountData.userType} account: ${accountData.email}...`);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: accountData.email });
    if (existingUser) {
      console.log(`   ℹ️  Account already exists!`);
      console.log(`   Email: ${accountData.email}`);
      console.log(`   Password: ${accountData.password}`);
      console.log(`   User ID: ${existingUser._id}`);
      return existingUser;
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(accountData.password, 10);
    
    // Create user
    const user = new User({
      ...accountData,
      password: hashedPassword
    });
    
    await user.save();
    
    console.log(`✅ ${accountData.userType} account created successfully!`);
    console.log(`   Email: ${accountData.email}`);
    console.log(`   Password: ${accountData.password}`);
    console.log(`   User ID: ${user._id}`);
    
    return user;
  } catch (error) {
    console.error(`❌ Failed to create ${accountData.userType} account:`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
}

async function createAllAccounts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    console.log('🚀 Creating test accounts...');
    console.log('================================\n');
    
    for (const account of accounts) {
      await createAccount(account);
    }
    
    console.log('\n================================');
    console.log('✨ Account creation complete!\n');
    console.log('📋 Test Account Credentials:');
    console.log('----------------------------');
    accounts.forEach(acc => {
      console.log(`\n${acc.userType.toUpperCase()}:`);
      console.log(`  Email: ${acc.email}`);
      console.log(`  Password: ${acc.password}`);
    });
    console.log('\n✅ All accounts are verified and ready to use!\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔒 Database connection closed');
    process.exit(0);
  }
}

// Run the script
createAllAccounts();
