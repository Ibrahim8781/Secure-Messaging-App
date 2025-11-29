import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';
import { keyExchangeAPI } from './api';

class KeyExchangeService {
  constructor() {
    this.activeSessions = new Map();
  }

  // Initiate key exchange with another user (UPDATED)
  async initiateKeyExchange(responderId, myUserId) {
    try {
      console.log('🚀 Initiating key exchange with user:', responderId);

      // Step 1: Generate ephemeral ECDH key pair
      console.log('🔑 Generating ephemeral ECDH key pair...');
      const ecdhKeyPair = await cryptoUtils.generateECDHKeyPair();
      const ephemeralPublicKey = await cryptoUtils.exportECDHPublicKey(ecdhKeyPair.publicKey);

      // Step 2: Generate nonce and timestamp
      const nonce = cryptoUtils.generateNonce();
      const timestamp = new Date().toISOString();

      // Step 3: Create signature data
      const signatureData = JSON.stringify({
        responderId,
        ephemeralPublic: ephemeralPublicKey,
        nonce,
        timestamp,
        type: 'key_exchange_init'
      });

      // Step 4: Get user's SIGNING private key and sign (CRITICAL FIX)
      const signingKeyData = await indexedDBManager.getPrivateKey(myUserId, 'signing');
      if (!signingKeyData) {
        throw new Error('Signing private key not found. Please regenerate keys first.');
      }

      // Import the key using the raw key data from IndexedDB
      const signingPrivateKey = await cryptoUtils.importPrivateKey(signingKeyData.keyData);
      
      // Use the signing private key to create the signature
      const signature = await cryptoUtils.signData(signingPrivateKey, signatureData);

      // Step 5: Send initiation request to server
      console.log('📡 Sending key exchange initiation...');
      const response = await keyExchangeAPI.initiate({
        responderId,
        ephemeralPublic: ephemeralPublicKey,
        nonce,
        timestamp,
        signature
      });

      // Step 6: Store session data locally
      const sessionData = {
        sessionId: response.data.sessionId,
        role: 'initiator',
        responderId,
        myECDHKeyPair: ecdhKeyPair,
        myNonce: nonce,
        timestamp,
        status: 'initiated'
      };

      this.activeSessions.set(response.data.sessionId, sessionData);

      console.log('✅ Key exchange initiated successfully');
      return {
        success: true,
        sessionId: response.data.sessionId,
        sessionData
      };

    } catch (error) {
      console.error('❌ Key exchange initiation failed:', error);
      throw error;
    }
  }

  // Respond to key exchange initiation
  async respondToKeyExchange(sessionId, myUserId) {
    try {
      console.log('🔄 Responding to key exchange:', sessionId);

      // Step 1: Generate ephemeral ECDH key pair
      console.log('🔑 Generating ephemeral ECDH key pair...');
      const ecdhKeyPair = await cryptoUtils.generateECDHKeyPair();
      const ephemeralPublicKey = await cryptoUtils.exportECDHPublicKey(ecdhKeyPair.publicKey);

      // Step 2: Generate nonce and timestamp
      const nonce = cryptoUtils.generateNonce();
      const timestamp = new Date().toISOString();

      // Step 3: Create signature data
      const signatureData = JSON.stringify({
        sessionId,
        ephemeralPublic: ephemeralPublicKey,
        nonce,
        timestamp,
        type: 'key_exchange_response'
      });

      // Step 4: Get user's SIGNING private key and sign
      const signingKeyData = await indexedDBManager.getPrivateKey(myUserId, 'signing');
      if (!signingKeyData) {
        throw new Error('Signing private key not found. Please regenerate keys first.');
      }

      const signingPrivateKey = await cryptoUtils.importPrivateKey(signingKeyData.keyData);
      const signature = await cryptoUtils.signData(signingPrivateKey, signatureData);


      // Step 5: Send response to server
      console.log('📡 Sending key exchange response...');
      const response = await keyExchangeAPI.respond({
        sessionId,
        ephemeralPublic: ephemeralPublicKey,
        nonce,
        timestamp,
        signature
      });

      // Step 6: Get session data from server
      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      // Step 7: Compute shared secret and session key
      console.log('🔐 Computing shared secret...');
      const initiatorPublicKey = await cryptoUtils.importECDHPublicKey(session.initiatorEphemeralPublic);
      const sharedSecret = await cryptoUtils.computeECDHSharedSecret(ecdhKeyPair.privateKey, initiatorPublicKey);

      // Derive session key
      const salt = cryptoUtils.base64ToArrayBuffer(session.initiatorNonce + nonce);
      const info = new TextEncoder().encode('secure-messaging-session-key');
      const sessionKey = await cryptoUtils.deriveSessionKey(sharedSecret, salt, info);

      // Step 8: Store session data locally
      const sessionData = {
        sessionId,
        role: 'responder',
        initiatorId: session.initiatorId._id,
        myECDHKeyPair: ecdhKeyPair,
        myNonce: nonce,
        initiatorNonce: session.initiatorNonce,
        sharedSecret,
        sessionKey,
        status: 'responded'
      };

      this.activeSessions.set(sessionId, sessionData);

      console.log('✅ Key exchange response completed');
      return {
        success: true,
        sessionId,
        sessionData,
        initiatorPublicKey: response.data.initiatorPublicKey
      };

    } catch (error) {
      console.error('❌ Key exchange response failed:', error);
      throw error;
    }
  }

  // Complete key exchange (for initiator)
  async completeKeyExchange(sessionId, myUserId) {
    try {
      console.log('🏁 Completing key exchange:', sessionId);

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      // Step 1: Get session data from server
      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      // Step 2: Compute shared secret and session key
      console.log('🔐 Computing shared secret...');
      const responderPublicKey = await cryptoUtils.importECDHPublicKey(session.responderEphemeralPublic);
      const sharedSecret = await cryptoUtils.computeECDHSharedSecret(sessionData.myECDHKeyPair.privateKey, responderPublicKey);

      // Derive session key
      const salt = cryptoUtils.base64ToArrayBuffer(sessionData.myNonce + session.responderNonce);
      const info = new TextEncoder().encode('secure-messaging-session-key');
      const sessionKey = await cryptoUtils.deriveSessionKey(sharedSecret, salt, info);

      // Step 3: Generate key confirmation
      console.log('🔏 Generating key confirmation...');
      const confirmationData = JSON.stringify({
        sessionId,
        sharedSecret: cryptoUtils.arrayBufferToBase64(sharedSecret)
      });

      const confirmation = await cryptoUtils.generateHMAC(sharedSecret, confirmationData);

      // Step 4: Send confirmation
      console.log('📡 Sending key confirmation...');
      await keyExchangeAPI.confirm({
        sessionId,
        confirmation,
        isInitiator: true
      });

      // Step 5: Update local session data
      sessionData.sharedSecret = sharedSecret;
      sessionData.sessionKey = sessionKey;
      sessionData.status = 'confirmed';
      this.activeSessions.set(sessionId, sessionData);

      // Step 6: Store session key for future use
      const sessionKeyBase64 = await cryptoUtils.exportSessionKey(sessionKey);
      await indexedDBManager.storeSessionKey(
        myUserId,
        sessionId,
        sessionKeyBase64,
        {
          algorithm: 'AES-GCM',
          keyLength: 256,
          derivedAt: new Date().toISOString()
        }
      );

      console.log('✅ Key exchange completed successfully');
      return {
        success: true,
        sessionId,
        sessionKey
      };

    } catch (error) {
      console.error('❌ Key exchange completion failed:', error);
      throw error;
    }
  }

  // Verify key confirmation (for responder)
  async verifyKeyConfirmation(sessionId, myUserId) {
    try {
      console.log('🔍 Verifying key confirmation:', sessionId);

      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) {
        throw new Error('Session not found');
      }

      // Step 1: Get session data from server
      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      // Step 2: Verify initiator's confirmation
      if (!session.initiatorConfirmation) {
        throw new Error('Initiator confirmation not received');
      }

      // Step 3: Generate our own confirmation for comparison
      const confirmationData = JSON.stringify({
        sessionId,
        sharedSecret: cryptoUtils.arrayBufferToBase64(sessionData.sharedSecret)
      });

      const expectedConfirmation = await cryptoUtils.generateHMAC(sessionData.sharedSecret, confirmationData);

      if (session.initiatorConfirmation !== expectedConfirmation) {
        throw new Error('Key confirmation mismatch - possible MITM attack!');
      }

      // Step 4: Send our confirmation
      console.log('📡 Sending key confirmation...');
      const ourConfirmation = await cryptoUtils.generateHMAC(sessionData.sharedSecret, 'responder-confirmation');
      await keyExchangeAPI.confirm({
        sessionId,
        confirmation: ourConfirmation,
        isInitiator: false
      });

      // Step 5: Update local session data
      sessionData.status = 'completed';
      this.activeSessions.set(sessionId, sessionData);

      // Step 6: Store session key for future use
      const sessionKeyBase64 = await cryptoUtils.exportSessionKey(sessionData.sessionKey);
      await indexedDBManager.storeSessionKey(
        myUserId,
        sessionId,
        sessionKeyBase64,
        {
          algorithm: 'AES-GCM',
          keyLength: 256,
          derivedAt: new Date().toISOString()
        }
      );

      console.log('✅ Key confirmation verified and exchange completed');
      return {
        success: true,
        sessionId,
        sessionKey: sessionData.sessionKey
      };

    } catch (error) {
      console.error('❌ Key confirmation verification failed:', error);
      throw error;
    }
  }

  // Get active session
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }

  // Get all active sessions
  getActiveSessions() {
    return Array.from(this.activeSessions.entries());
  }

  // Clean up session
  removeSession(sessionId) {
    this.activeSessions.delete(sessionId);
  }
}

// NOTE: This assumes you have already added exportSessionKey to cryptoUtils in crypto.js
// If not, please ensure it is present for Step 6 to work:
// cryptoUtils.exportSessionKey = async function(sessionKey) { ... };

// Create singleton instance
const keyExchangeService = new KeyExchangeService();
export default keyExchangeService;