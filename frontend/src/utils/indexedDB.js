// IndexedDB utility for secure key storage
class IndexedDBManager {
  constructor() {
    this.dbName = 'SecureMessagingDB';
    this.dbVersion = 1;
    this.storeName = 'keys';
    this.db = null;
  }

  // Initialize database connection
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`IndexedDB error: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB connection established');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('keyType', 'keyType', { unique: false });
          console.log('✅ IndexedDB store created');
        }
      };
    });
  }

  // Store private key securely (UPDATED)
  async storePrivateKey(userId, privateKeyData, keyInfo = {}, keyType = 'encryption') {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const keyRecord = {
        // ID is now a composite of keyType and userId
        id: `${keyType}_${userId}`,
        userId: userId,
        keyType: keyType,
        keyData: privateKeyData,
        keyInfo: {
          // Default algorithm based on keyType
          algorithm: keyInfo.algorithm || (keyType === 'encryption' ? 'RSA-OAEP' : 'RSA-PSS'),
          modulusLength: keyInfo.modulusLength || 2048,
          hash: keyInfo.hash || 'SHA-256',
          generatedAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };

      await store.put(keyRecord);
      console.log(`✅ ${keyType} private key stored securely in IndexedDB`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to store ${keyType} private key:`, error);
      throw error;
    }
  }

  // Retrieve private key (UPDATED)
  async getPrivateKey(userId, keyType = 'encryption') {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        // Composite key ID for retrieval
        const request = store.get(`${keyType}_${userId}`);
        
        request.onsuccess = () => {
          if (request.result) {
            // Update last accessed time
            this.updateLastAccessed(`${keyType}_${userId}`);
            console.log(`✅ ${keyType} private key retrieved from IndexedDB`);
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          reject(new Error(`Failed to retrieve ${keyType} private key`));
        };
      });
    } catch (error) {
      console.error(`❌ Failed to retrieve ${keyType} private key:`, error);
      throw error;
    }
  }

  // Store session keys (for future use)
  async storeSessionKey(userId, sessionId, keyData, keyInfo = {}) {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const keyRecord = {
        id: `session_${userId}_${sessionId}`,
        userId: userId,
        sessionId: sessionId,
        keyType: 'session',
        keyData: keyData,
        keyInfo: keyInfo,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };

      await store.put(keyRecord);
      console.log('✅ Session key stored in IndexedDB');
      return true;
    } catch (error) {
      console.error('❌ Failed to store session key:', error);
      throw error;
    }
  }

  // Retrieve session key
  async getSessionKey(userId, sessionId) {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      return new Promise((resolve, reject) => {
        const request = store.get(`session_${userId}_${sessionId}`);
        
        request.onsuccess = () => {
          if (request.result) {
            this.updateLastAccessed(`session_${userId}_${sessionId}`);
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          reject(new Error('Failed to retrieve session key'));
        };
      });
    } catch (error) {
      console.error('❌ Failed to retrieve session key:', error);
      throw error;
    }
  }

  // Update last accessed time
  async updateLastAccessed(keyId) {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const request = store.get(keyId);
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          record.lastAccessed = new Date().toISOString();
          store.put(record);
        }
      };
    } catch (error) {
      console.error('Failed to update last accessed time:', error);
    }
  }

  // Check if private key exists for user (UPDATED)
  async hasPrivateKey(userId, keyType = 'encryption') {
    try {
      // Use the updated getPrivateKey which handles keyType
      const key = await this.getPrivateKey(userId, keyType);
      return key !== null;
    } catch (error) {
      console.error(`Failed to check ${keyType} private key existence:`, error);
      return false;
    }
  }

  // Get all keys for a user (for management)
  async getUserKeys(userId) {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('userId');
      
      return new Promise((resolve, reject) => {
        const request = index.getAll(userId);
        
        request.onsuccess = () => {
          resolve(request.result);
        };
        
        request.onerror = () => {
          reject(new Error('Failed to retrieve user keys'));
        };
      });
    } catch (error) {
      console.error('❌ Failed to retrieve user keys:', error);
      throw error;
    }
  }

  // Delete specific key
  async deleteKey(keyId) {
    try {
      if (!this.db) await this.init();

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Return a promise since store.delete is asynchronous
      return new Promise((resolve, reject) => {
        const request = store.delete(keyId);
        
        request.onsuccess = () => {
          console.log(`✅ Key ${keyId} deleted from IndexedDB`);
          resolve(true);
        };
        
        request.onerror = () => {
          console.error(`❌ Failed to delete key ${keyId}:`, request.error);
          reject(new Error(`Failed to delete key: ${request.error.name}`));
        };
      });

    } catch (error) {
      console.error('❌ Failed to delete key:', error);
      throw error;
    }
  }

  // Clear all keys for user (UPDATED)
  async clearUserKeys(userId, keyType) {
    try {
      // NOTE: This now correctly calls getUserKeys and deletes all found keys.
      // If you intended to clear only a specific type, you would need to adjust this logic.
      // Given the keyService calls this for both 'signing' and 'encryption' keys, 
      // the keyService should be responsible for filtering. Let's keep this generic 
      // to rely on the keyService.clearUserKeys logic.
      
      const userKeys = await this.getUserKeys(userId);
      for (const key of userKeys) {
        // If keyType is provided, only delete that type (e.g., used for key rotation logic)
        if (!keyType || key.keyType === keyType) {
          await this.deleteKey(key.id);
        }
      }
      console.log(`✅ All ${keyType ? keyType + ' user ' : 'user'} keys cleared from IndexedDB`);
      return true;
    } catch (error) {
      console.error('❌ Failed to clear user keys:', error);
      throw error;
    }
  }
}

// Create singleton instance
const indexedDBManager = new IndexedDBManager();
export default indexedDBManager;