const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

const checkPayMongoPayment = async () => {
  try {
    const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
    
    if (!PAYMONGO_SECRET_KEY) {
      throw new Error('PAYMONGO_SECRET_KEY not found in .env file');
    }

    console.log('🔑 Using PayMongo Secret Key:', PAYMONGO_SECRET_KEY.substring(0, 15) + '...');
    console.log('');

    // Get source ID from command line argument
    const sourceId = process.argv[2] || 'src_JBQVW2mbgeDF4U5EezqiJaNL';
    
    console.log(`🔍 Checking PayMongo for source: ${sourceId}\n`);

    // Check the source
    try {
      const sourceResponse = await axios.get(
        `https://api.paymongo.com/v1/sources/${sourceId}`,
        {
          auth: {
            username: PAYMONGO_SECRET_KEY,
            password: ''
          }
        }
      );

      const source = sourceResponse.data.data;
      
      console.log('✅ Source Found in PayMongo!\n');
      console.log('📋 Source Details:');
      console.log('─────────────────────────────────────────');
      console.log(`   ID: ${source.id}`);
      console.log(`   Type: ${source.attributes.type.toUpperCase()}`);
      console.log(`   Amount: ₱${(source.attributes.amount / 100).toFixed(2)}`);
      console.log(`   Status: ${source.attributes.status.toUpperCase()}`);
      console.log(`   Currency: ${source.attributes.currency}`);
      console.log(`   Created: ${new Date(source.attributes.created_at * 1000).toLocaleString()}`);
      console.log(`   Updated: ${new Date(source.attributes.updated_at * 1000).toLocaleString()}`);
      
      if (source.attributes.redirect) {
        console.log('\n🔗 Redirect URLs:');
        console.log(`   Checkout: ${source.attributes.redirect.checkout_url}`);
        console.log(`   Success: ${source.attributes.redirect.success}`);
        console.log(`   Failed: ${source.attributes.redirect.failed}`);
      }

      if (source.attributes.metadata) {
        console.log('\n📝 Metadata:');
        Object.keys(source.attributes.metadata).forEach(key => {
          console.log(`   ${key}: ${source.attributes.metadata[key]}`);
        });
      }

      // Check if there's a payment associated
      const paymentId = source.attributes.payments?.[0];
      if (paymentId) {
        console.log('\n💳 Associated Payment:');
        console.log(`   Payment ID: ${paymentId}`);
        
        // Try to fetch payment details
        try {
          const paymentResponse = await axios.get(
            `https://api.paymongo.com/v1/payments/${paymentId}`,
            {
              auth: {
                username: PAYMONGO_SECRET_KEY,
                password: ''
              }
            }
          );

          const payment = paymentResponse.data.data;
          console.log(`   Status: ${payment.attributes.status.toUpperCase()}`);
          console.log(`   Amount: ₱${(payment.attributes.amount / 100).toFixed(2)}`);
          console.log(`   Fee: ₱${(payment.attributes.fee / 100).toFixed(2)}`);
          console.log(`   Net Amount: ₱${(payment.attributes.net_amount / 100).toFixed(2)}`);
          console.log(`   Paid At: ${payment.attributes.paid_at ? new Date(payment.attributes.paid_at * 1000).toLocaleString() : 'N/A'}`);
        } catch (paymentError) {
          console.log('   ⚠️ Payment details not accessible');
        }
      } else {
        console.log('\n⏳ Status: Awaiting payment completion');
        console.log('   No payment has been made yet for this source.');
      }

      console.log('\n─────────────────────────────────────────\n');

    } catch (sourceError) {
      if (sourceError.response?.status === 404) {
        console.log('❌ Source not found in PayMongo');
        console.log('   This could mean:');
        console.log('   1. The source ID is incorrect');
        console.log('   2. The source was created in a different environment (test vs live)');
        console.log('   3. The source was deleted\n');
      } else if (sourceError.response?.status === 401) {
        console.log('❌ Authentication failed');
        console.log('   Check your PAYMONGO_SECRET_KEY in .env file\n');
      } else {
        throw sourceError;
      }
    }

    // List recent sources
    console.log('📊 Recent Sources from PayMongo:\n');
    
    try {
      const sourcesResponse = await axios.get(
        'https://api.paymongo.com/v1/sources',
        {
          auth: {
            username: PAYMONGO_SECRET_KEY,
            password: ''
          }
        }
      );

      const sources = sourcesResponse.data.data;
      
      if (sources.length === 0) {
        console.log('   No sources found in PayMongo');
      } else {
        sources.slice(0, 5).forEach((source, index) => {
          console.log(`${index + 1}. ${source.id}`);
          console.log(`   Type: ${source.attributes.type.toUpperCase()}`);
          console.log(`   Amount: ₱${(source.attributes.amount / 100).toFixed(2)}`);
          console.log(`   Status: ${source.attributes.status.toUpperCase()}`);
          console.log(`   Created: ${new Date(source.attributes.created_at * 1000).toLocaleString()}`);
          console.log('');
        });
      }
    } catch (listError) {
      console.log('   ⚠️ Could not list recent sources');
    }

    console.log('✅ Done\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('PayMongo Error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
};

checkPayMongoPayment();
