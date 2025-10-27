const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth/register';

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
    availability: 'Full-time'
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
    companyDescription: 'Leading provider of testing services'
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
    bio: 'Test admin account for development'
  }
];

async function createAccount(accountData) {
  try {
    console.log(`\n📝 Creating ${accountData.userType} account: ${accountData.email}...`);
    
    const response = await axios.post(API_URL, accountData);
    
    console.log(`✅ ${accountData.userType} account created successfully!`);
    console.log(`   Email: ${accountData.email}`);
    console.log(`   Password: ${accountData.password}`);
    console.log(`   User ID: ${response.data.user?._id || response.data.userId}`);
    
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Failed to create ${accountData.userType} account:`);
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data.message || error.response.data.alert}`);
      
      if (error.response.data.message === 'Email already registered') {
        console.log(`   ℹ️  Account already exists - you can use it!`);
      }
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    return null;
  }
}

async function createAllAccounts() {
  console.log('🚀 Creating test accounts...');
  console.log('================================\n');
  
  for (const account of accounts) {
    await createAccount(account);
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n================================');
  console.log('✨ Account creation complete!\n');
  console.log('📋 Summary of test accounts:');
  console.log('----------------------------');
  accounts.forEach(acc => {
    console.log(`\n${acc.userType.toUpperCase()}:`);
    console.log(`  Email: ${acc.email}`);
    console.log(`  Password: ${acc.password}`);
  });
  console.log('\n⚠️  Note: These accounts may need email verification.');
  console.log('    Check the database and update isVerified to true if needed.\n');
}

// Run the script
createAllAccounts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
