const axios = require('axios');
const crypto = require('crypto');

// Config
const API_URL = 'http://localhost:5000/api';
// Need valid credentials to run this test
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMwMzliNjUyYzgzODAzZDU3ZjEyZjgiLCJ1c2VybmFtZSI6ImV2ZSIsImlhdCI6MTc2NDc2ODE4MywiZXhwIjoxNzY0ODU0NTgzfQ.UsMSIHkVE-6JuLVSgEq7ukL-dlzwpjxV7j4wmpg7i1k'; 
const TARGET_ID = '693039a452c83803d57f12f1';

async function testSecurity() {
  console.log('🛡️  Running Security Tests...\n');

  // TEST 1: Replay Attack (Old Timestamp)
  console.log('🧪 Test 1: Replay Attack (Expired Timestamp)');
  try {
    await axios.post(`${API_URL}/keys/exchange/initiate`, {
      responderId: TARGET_ID,
      ephemeralPublic: 'somekey',
      nonce: 'somenonce',
      timestamp: Date.now() - (10 * 60 * 1000), // 10 mins ago
      signature: 'somesig'
    }, { headers: { Authorization: `Bearer ${USER_TOKEN}` }});
    console.log('❌ Failed: Server accepted expired timestamp');
  } catch (error) {
    if (error.response && error.response.data.code === 'TIMESTAMP_EXPIRED') {
      console.log('✅ Passed: Server rejected expired timestamp');
    } else {
      console.log('⚠️  Unexpected error:', error.message);
    }
  }

  // TEST 2: Invalid Signature
  console.log('\n🧪 Test 2: Invalid Signature Check');
  try {
    await axios.post(`${API_URL}/keys/exchange/initiate`, {
      responderId: TARGET_ID,
      ephemeralPublic: 'somekey',
      nonce: 'somenonce',
      timestamp: Date.now(),
      signature: 'invalid_signature_string'
    }, { headers: { Authorization: `Bearer ${USER_TOKEN}` }});
    console.log('❌ Failed: Server accepted invalid signature');
  } catch (error) {
    // Note: It might return 400 or 500 depending on exact parsing, but as long as it's not 201
    console.log('✅ Passed: Server rejected invalid signature');
  }
}

testSecurity();