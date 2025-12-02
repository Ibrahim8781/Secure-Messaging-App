const crypto = require('crypto');

// Simulate Web Crypto API operations using Node.js crypto

async function testE2EEncryption() {
  console.log('🧪 Testing E2E Message Encryption\n');

  // 1. Generate session key (simulating HKDF derivation)
  const sessionKey = crypto.randomBytes(32); // 256-bit AES key
  console.log('✅ Session key generated (32 bytes)');

  // 2. Original message
  const plaintext = 'Hello, this is a secret message!';
  console.log(`📝 Original message: "${plaintext}"\n`);

  // 3. Generate random IV (12 bytes for GCM)
  const iv = crypto.randomBytes(12);
  console.log(`🔐 Generated IV: ${iv.toString('base64')}`);

  // 4. Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertextWithTag = Buffer.concat([ciphertext, authTag]);

  const ciphertextBase64 = ciphertextWithTag.toString('base64');
  const ivBase64 = iv.toString('base64');

  console.log(`✅ Encrypted ciphertext: ${ciphertextBase64.substring(0, 40)}...`);
  console.log(`📏 Ciphertext size: ${ciphertextBase64.length} bytes (base64)\n`);

  // 5. Simulate sending to server
  const messagePayload = {
    from: 'user1',
    to: 'user2',
    sessionId: 'session_123',
    ciphertext: ciphertextBase64,
    iv: ivBase64,
    timestamp: new Date().toISOString()
  };

  console.log('📡 Sending to server:');
  console.log(JSON.stringify(messagePayload, null, 2));
  console.log();

  // 6. Simulate retrieval from server and decryption
  const receivedCiphertext = Buffer.from(messagePayload.ciphertext, 'base64');
  const receivedIV = Buffer.from(messagePayload.iv, 'base64');

  // Split ciphertext and auth tag
  const receivedData = receivedCiphertext.slice(0, -16);
  const receivedTag = receivedCiphertext.slice(-16);

  // Decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, receivedIV);
  decipher.setAuthTag(receivedTag);
  let decrypted = decipher.update(receivedData, null, 'utf8');
  decrypted += decipher.final('utf8');

  console.log(`🔓 Decrypted message: "${decrypted}"\n`);

  // 7. Verify
  if (decrypted === plaintext) {
    console.log('✅ SUCCESS: Message decrypted correctly!');
    console.log('✅ E2E encryption working as expected');
  } else {
    console.log('❌ FAILED: Decryption mismatch');
  }

  // 8. Security notes
  console.log('\n📋 Security Notes:');
  console.log('- Session key: 256-bit AES (never transmitted)');
  console.log('- IV: 12 bytes (96 bits), randomly generated per message');
  console.log('- Algorithm: AES-256-GCM with 128-bit auth tag');
  console.log('- Server stores: only ciphertext, IV, and metadata');
  console.log('- Plaintext never touches server');
}

testE2EEncryption().catch(console.error);