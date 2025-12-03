const crypto = require('crypto');

class BackendCryptoUtils {
  constructor() {
    this.ecdhCurve = 'prime256v1'; // P-256 curve
  }

  // ✅ FIXED: Proper RSA-PSS signature verification
  verifySignature(publicKeyPem, signature, data) {
    try {
      // Convert base64 signature to Buffer
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      // Convert data string to Buffer
      const dataBuffer = Buffer.from(data, 'utf8');
      
      // Verify with RSA-PSS padding
      const isValid = crypto.verify(
        'sha256',
        dataBuffer,
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: 32 // Must match frontend (32 bytes)
        },
        signatureBuffer
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
// Log security event to MongoDB
  async logSecurityEvent(eventType, sessionId, userId, details, req = null) {
    try {
      const SecurityLog = require('../models/SecurityLog'); // Lazy load to avoid circular deps
      const timestamp = new Date().toISOString();
      
      // Console log for immediate debug
      console.log(`[SECURITY][${timestamp}] ${eventType}`, details);

      // Save to Database
      const logEntry = new SecurityLog({
        eventType,
        sessionId,
        userId,
        details,
        ipAddress: req ? (req.ip || req.connection.remoteAddress) : 'internal'
      });

      await logEntry.save();
      return logEntry;
    } catch (error) {
      console.error('Failed to save security log:', error);
    }
  }
}

// Create singleton instance
const backendCryptoUtils = new BackendCryptoUtils();
module.exports = backendCryptoUtils;