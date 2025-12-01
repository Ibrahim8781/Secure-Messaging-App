import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';
import { usersAPI } from './api';

class KeyService {
  constructor() {
    this.keyGenerationInProgress = false;
  }

  // ============================================================
  // ========== ENCRYPTION KEYS (YOUR ORIGINAL VERSION) ==========
  // ============================================================

  // Generate and store keys for user
  async generateAndStoreKeys(userId) {
    if (this.keyGenerationInProgress) {
      throw new Error('Key generation already in progress');
    }

    this.keyGenerationInProgress = true;

    try {
      console.log('🚀 Starting key generation process...');

      // Step 1: Generate RSA key pair
      console.log('🔑 Generating RSA-2048 key pair...');
      const keyPair = await cryptoUtils.generateKeyPair();

      // Step 2: Export keys
      console.log('📤 Exporting keys...');
      const publicKeyBase64 = await cryptoUtils.exportPublicKey(keyPair.publicKey);
      const privateKeyBase64 = await cryptoUtils.exportPrivateKey(keyPair.privateKey);

      // Step 3: Generate key fingerprint
      console.log('🔍 Generating key fingerprint...');
      const fingerprint = await cryptoUtils.generateKeyFingerprint(keyPair.publicKey);

      // Step 4: Store private key locally in IndexedDB
      console.log('💾 Storing private key locally...');
      await indexedDBManager.storePrivateKey(userId, privateKeyBase64, {
        algorithm: 'RSA-OAEP',
        modulusLength: 2048,
        hash: 'SHA-256'
      });

      // Step 5: Upload public key to server
      console.log('📡 Uploading public key to server...');
      await usersAPI.updatePublicKey({
        publicKey: publicKeyBase64,
        keyInfo: {
          algorithm: 'RSA-OAEP',
          modulusLength: 2048,
          hash: 'SHA-256',
          publicExponent: [1, 0, 1],
          keyUsages: ['encrypt', 'wrapKey']
        },
        keyFingerprint: fingerprint
      });

      console.log('✅ Key generation and storage completed successfully');

      return {
        success: true,
        fingerprint: fingerprint,
        publicKey: publicKeyBase64,
        keyInfo: {
          algorithm: 'RSA-OAEP',
          modulusLength: 2048,
          hash: 'SHA-256'
        }
      };

    } catch (error) {
      console.error('❌ Key generation failed:', error);
      throw error;
    } finally {
      this.keyGenerationInProgress = false;
    }
  }

  // Get user's private key
  async getPrivateKey(userId) {
    try {
      const keyRecord = await indexedDBManager.getPrivateKey(userId);
      
      if (!keyRecord) {
        return null;
      }

      // Import the private key for use
      const privateKey = await cryptoUtils.importPrivateKey(keyRecord.keyData);
      
      return {
        cryptoKey: privateKey,
        keyRecord: keyRecord
      };
    } catch (error) {
      console.error('Failed to get private key:', error);
      throw error;
    }
  }

  // Check if user has keys generated
  async hasKeys(userId) {
    try {
      const hasPrivateKey = await indexedDBManager.hasPrivateKey(userId);
      
      // Also check if public key is on server (optional)
      // This would require an API call to verify
      
      return hasPrivateKey;
    } catch (error) {
      console.error('Failed to check key status:', error);
      return false;
    }
  }

  // Get public key for another user from server
  async getPublicKeyForUser(userId) {
    try {
      const response = await usersAPI.getPublicKey(userId);
      
      if (response.data.publicKey) {
        const publicKey = await cryptoUtils.importPublicKey(response.data.publicKey);
        return {
          cryptoKey: publicKey,
          keyInfo: response.data.keyInfo,
          fingerprint: response.data.keyFingerprint
        };
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get public key for user:', error);
      throw error;
    }
  }

  // Regenerate keys (for key rotation)
  async regenerateKeys(userId) {
    try {
      // First, clear existing keys
      await this.clearUserKeys(userId);
      
      // Generate new keys
      return await this.generateAndStoreKeys(userId);
    } catch (error) {
      console.error('Key regeneration failed:', error);
      throw error;
    }
  }

  // Clear all keys for user
  async clearUserKeys(userId) {
    try {
      await indexedDBManager.clearUserKeys(userId);
      
      // Note: We don't clear the public key from server as it might be needed for old messages
      // In production, you might want a more sophisticated key rotation strategy
      
      return true;
    } catch (error) {
      console.error('Failed to clear user keys:', error);
      throw error;
    }
  }

  // Get key statistics
  async getKeyStats(userId) {
    try {
      const hasKeys = await this.hasKeys(userId);
      const userKeys = await indexedDBManager.getUserKeys(userId);
      
      return {
        hasKeys: hasKeys,
        totalKeys: userKeys.length,
        keyTypes: userKeys.reduce((acc, key) => {
          acc[key.keyType] = (acc[key.keyType] || 0) + 1;
          return acc;
        }, {}),
        latestAccess: userKeys.length > 0 
          ? new Date(Math.max(...userKeys.map(k => new Date(k.lastAccessed))))
          : null
      };
    } catch (error) {
      console.error('Failed to get key stats:', error);
      throw error;
    }
  }

  // ============================================================
  // ========== SIGNING KEYS (PEER'S NEW ADDITIONS) =============
  // ============================================================

  // Generate and store RSA-PSS signing keys
  async generateAndStoreSigningKeys(userId) {
    if (this.keyGenerationInProgress) {
      throw new Error('Key generation already in progress');
    }

    this.keyGenerationInProgress = true;

    try {
      console.log('🚀 Starting signing key generation...');

      // Step 1: Generate RSA-PSS signing key pair
      console.log('🔐 Generating RSA-PSS key pair...');
      const signingKeyPair = await cryptoUtils.generateSigningKeyPair();

      // Step 2: Export keys
      console.log('📤 Exporting signing keys...');
      const signingPublicKeyBase64 = await cryptoUtils.exportSigningPublicKey(signingKeyPair.publicKey);
      const signingPrivateKeyBase64 = await cryptoUtils.exportSigningPrivateKey(signingKeyPair.privateKey);

      // Step 3: Store private signing key locally in IndexedDB
      console.log('💾Storing signing private key locally...');
      await indexedDBManager.storePrivateKey(
        userId,
        signingPrivateKeyBase64,
        {
          algorithm: 'RSA-PSS',
          modulusLength: 2048,
          hash: 'SHA-256'
        },
        'signing' // Key type identifier
      );

      // Step 4: Upload public signing key to server
      console.log('📡 Uploading signing public key to server...');
      await usersAPI.updatePublicKey({
        signingPublicKey: signingPublicKeyBase64,
        signingKeyInfo: {
          algorithm: 'RSA-PSS',
          modulusLength: 2048,
          hash: 'SHA-256',
          publicExponent: [1, 0, 1],
          keyUsages: ['verify']
        }
      });

      console.log('✅ Signing key generation completed successfully');

      return {
        success: true,
        publicKey: signingPublicKeyBase64
      };

    } catch (error) {
      console.error('❌ Signing key generation failed:', error);
      throw error;
    } finally {
      this.keyGenerationInProgress = false;
    }
  }

  // Get user's signing private key
  async getSigningPrivateKey(userId) {
    try {
      const keyRecord = await indexedDBManager.getPrivateKey(userId, 'signing');

      if (!keyRecord) {
        return null;
      }

      // Import the signing private key for use
      const signingPrivateKey = await cryptoUtils.importSigningPrivateKey(keyRecord.keyData);

      return {
        cryptoKey: signingPrivateKey,
        keyRecord: keyRecord
      };
    } catch (error) {
      console.error('Failed to get signing private key:', error);
      throw error;
    }
  }

  // Check if user has signing keys
  async hasSigningKeys(userId) {
    try {
      const hasPrivateKey = await indexedDBManager.hasPrivateKey(userId, 'signing');
      return hasPrivateKey;
    } catch (error) {
      console.error('Failed to check signing key status:', error);
      return false;
    }
  }

  // Get signing public key for another user from server
  async getSigningPublicKeyForUser(userId) {
    try {
      const response = await usersAPI.getPublicKey(userId);

      if (response.data.signingPublicKey) {
        const publicKey = await cryptoUtils.importSigningPublicKey(response.data.signingPublicKey);
        return {
          cryptoKey: publicKey,
          keyInfo: response.data.signingKeyInfo
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get signing public key for user:', error);
      throw error;
    }
  }
}

// Create singleton instance
const keyService = new KeyService();
export default keyService;
