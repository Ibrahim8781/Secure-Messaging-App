const crypto = require('crypto');

class BackendCryptoUtils {
  constructor() {
    this.ecdhCurve = 'prime256v1'; // P-256 curve
  }

  // Verify RSA-PSS signature
// Verify RSA-PSS signature
verifySignature(publicKeyPem, signature, data) {
  try {
    // Node.js requires 'sha256' as the algorithm, not 'RSA-PSS'
    // RSA-PSS is specified in the verify options
    const verify = crypto.createVerify('sha256');
    verify.update(data);
    verify.end();
    
    const isValid = verify.verify(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST
      },
      signature,
      'base64'
    );
    
    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
  // Generate HMAC for key confirmation
  generateHMAC(key, data) {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return hmac.digest('base64');
  }

  // Verify HMAC
  verifyHMAC(key, data, hmac) {
    const calculatedHmac = this.generateHMAC(key, data);
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac, 'base64'),
      Buffer.from(hmac, 'base64')
    );
  }

  // Generate random nonce
  generateNonce() {
    return crypto.randomBytes(32).toString('base64'); // 256-bit nonce
  }

  // Validate timestamp (within 5 minutes)
  validateTimestamp(timestamp) {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return Math.abs(now - timestamp) <= fiveMinutes;
  }

  // Convert base64 string to PEM format for RSA public key
  base64ToPEM(base64Key, keyType = 'PUBLIC KEY') {
    const keyLines = base64Key.match(/.{1,64}/g) || [];
    return `-----BEGIN ${keyType}-----\n${keyLines.join('\n')}\n-----END ${keyType}-----`;
  }

  // Log security event
  logSecurityEvent(eventType, sessionId, userId, details) {
    const timestamp = new Date().toISOString();
    console.log(`[SECURITY][${timestamp}] ${eventType} - Session: ${sessionId}, User: ${userId}`, details);
    
    // In Module 9, this will be stored in MongoDB
    return {
      eventType,
      sessionId,
      userId,
      timestamp,
      details
    };
  }
}

// Create singleton instance
const backendCryptoUtils = new BackendCryptoUtils();
module.exports = backendCryptoUtils;