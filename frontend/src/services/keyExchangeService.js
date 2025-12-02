import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';
import { keyExchangeAPI } from './api';

class KeyExchangeService {
  constructor() {
    this.activeSessions = new Map();
  }

  async initiateKeyExchange(responderId, myUserId) {
    try {
      const ecdhKeyPair = await cryptoUtils.generateECDHKeyPair();
      const ephemeralPublicKey = await cryptoUtils.exportECDHPublicKey(ecdhKeyPair.publicKey);
      const nonce = cryptoUtils.generateNonce();
      const timestamp = Date.now().toString();
      
      const signatureData = JSON.stringify({ responderId, ephemeralPublic: ephemeralPublicKey, nonce, timestamp, type: 'key_exchange_init' });
      const signingKeyData = await indexedDBManager.getPrivateKey(myUserId, 'signing');
      if (!signingKeyData) throw new Error('Signing keys not found');

      const signingPrivateKey = await cryptoUtils.importSigningPrivateKey(signingKeyData.keyData);
      const signature = await cryptoUtils.signData(signingPrivateKey, signatureData);

      const response = await keyExchangeAPI.initiate({ responderId, ephemeralPublic: ephemeralPublicKey, nonce, timestamp, signature });

      this.activeSessions.set(response.data.sessionId, {
        sessionId: response.data.sessionId,
        role: 'initiator',
        responderId, // Crucial: Storing this for later
        myECDHKeyPair: ecdhKeyPair,
        myNonce: nonce,
        status: 'initiated'
      });

      return { sessionId: response.data.sessionId };
    } catch (error) {
      console.error('Initiate failed:', error);
      throw error;
    }
  }

  async respondToKeyExchange(sessionId, myUserId) {
    try {
      const ecdhKeyPair = await cryptoUtils.generateECDHKeyPair();
      const ephemeralPublicKey = await cryptoUtils.exportECDHPublicKey(ecdhKeyPair.publicKey);
      const nonce = cryptoUtils.generateNonce();
      const timestamp = Date.now().toString();

      const signatureData = JSON.stringify({ sessionId, ephemeralPublic: ephemeralPublicKey, nonce, timestamp, type: 'key_exchange_response' });
      const signingKeyData = await indexedDBManager.getPrivateKey(myUserId, 'signing');
      if (!signingKeyData) throw new Error('Signing keys not found');

      const signingPrivateKey = await cryptoUtils.importSigningPrivateKey(signingKeyData.keyData);
      const signature = await cryptoUtils.signData(signingPrivateKey, signatureData);

      await keyExchangeAPI.respond({ sessionId, ephemeralPublic: ephemeralPublicKey, nonce, timestamp, signature });
      
      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      const initiatorPublicKey = await cryptoUtils.importECDHPublicKey(session.initiatorEphemeralPublic);
      const sharedSecret = await cryptoUtils.computeECDHSharedSecret(ecdhKeyPair.privateKey, initiatorPublicKey);

      const n1 = cryptoUtils.base64ToArrayBuffer(session.initiatorNonce);
      const n2 = cryptoUtils.base64ToArrayBuffer(nonce);
      const combined = new Uint8Array(n1.byteLength + n2.byteLength);
      combined.set(new Uint8Array(n1), 0);
      combined.set(new Uint8Array(n2), n1.byteLength);
      
      const sessionKey = await cryptoUtils.deriveSessionKey(sharedSecret, combined.buffer, new TextEncoder().encode('secure-messaging-session-key'));

      this.activeSessions.set(sessionId, {
        sessionId,
        role: 'responder',
        initiatorId: session.initiatorId._id, // Crucial: Storing this
        myECDHKeyPair: ecdhKeyPair,
        myNonce: nonce,
        sharedSecret,
        sessionKey,
        status: 'responded'
      });

      return { sessionKey };
    } catch (error) {
      console.error('Respond failed:', error);
      throw error;
    }
  }

  async completeKeyExchange(sessionId, myUserId) {
    try {
      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) throw new Error('Session data not found in memory. Please reload if persistent.');

      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      const responderPublicKey = await cryptoUtils.importECDHPublicKey(session.responderEphemeralPublic);
      const sharedSecret = await cryptoUtils.computeECDHSharedSecret(sessionData.myECDHKeyPair.privateKey, responderPublicKey);

      const n1 = cryptoUtils.base64ToArrayBuffer(sessionData.myNonce);
      const n2 = cryptoUtils.base64ToArrayBuffer(session.responderNonce);
      const combined = new Uint8Array(n1.byteLength + n2.byteLength);
      combined.set(new Uint8Array(n1), 0);
      combined.set(new Uint8Array(n2), n1.byteLength);

      const sessionKey = await cryptoUtils.deriveSessionKey(sharedSecret, combined.buffer, new TextEncoder().encode('secure-messaging-session-key'));

      const sharedSecretHash = cryptoUtils.arrayBufferToBase64(await window.crypto.subtle.digest('SHA-256', sharedSecret));
      const confirmation = await cryptoUtils.generateHMAC(sharedSecret, `${sessionId}|initiator|${sharedSecretHash}`);
      
      await keyExchangeAPI.confirm({ sessionId, confirmation, isInitiator: true });

      // ✅ FIXED: Explicitly pass partnerId (responderId) to IndexedDB
      await indexedDBManager.storeSessionKey(
        myUserId,
        sessionId,
        await cryptoUtils.exportSessionKey(sessionKey),
        { 
          algorithm: 'AES-GCM',
          keyLength: 256,
          derivedAt: new Date().toISOString(),
          partnerId: sessionData.responderId // THIS WAS MISSING/UNDEFINED BEFORE
        } 
      );

      return { sessionKey };
    } catch (error) {
      console.error('Complete failed:', error);
      throw error;
    }
  }

  async verifyKeyConfirmation(sessionId, myUserId) {
    try {
      const sessionData = this.activeSessions.get(sessionId);
      if (!sessionData) throw new Error('Session not found');

      const sessionResponse = await keyExchangeAPI.getSession(sessionId);
      const session = sessionResponse.data.session;

      const sharedSecretHash = cryptoUtils.arrayBufferToBase64(await window.crypto.subtle.digest('SHA-256', sessionData.sharedSecret));
      const expected = await cryptoUtils.generateHMAC(sessionData.sharedSecret, `${sessionId}|initiator|${sharedSecretHash}`);
      
      if (session.initiatorConfirmation !== expected) throw new Error('MITM Detected');

      const ourConfirmation = await cryptoUtils.generateHMAC(sessionData.sharedSecret, `${sessionId}|responder|${sharedSecretHash}`);
      await keyExchangeAPI.confirm({ sessionId, confirmation: ourConfirmation, isInitiator: false });

      // ✅ FIXED: Explicitly pass partnerId (initiatorId) to IndexedDB
      await indexedDBManager.storeSessionKey(
        myUserId,
        sessionId,
        await cryptoUtils.exportSessionKey(sessionData.sessionKey),
        { 
          algorithm: 'AES-GCM',
          keyLength: 256,
          derivedAt: new Date().toISOString(),
          partnerId: sessionData.initiatorId // THIS WAS MISSING/UNDEFINED BEFORE
        } 
      );
    } catch (error) {
      console.error('Verify failed:', error);
      throw error;
    }
  }

  getActiveSessions() { return Array.from(this.activeSessions.entries()); }
}

const keyExchangeService = new KeyExchangeService();
export default keyExchangeService;