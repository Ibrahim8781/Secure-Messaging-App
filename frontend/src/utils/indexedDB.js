// IndexedDB utility for secure key storage
class IndexedDBManager {
  constructor() {
    this.dbName = 'SecureMessagingDB';
    this.dbVersion = 2;
    this.storeName = 'keys';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject(new Error(`IndexedDB error: ${request.error}`));
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('keyType', 'keyType', { unique: false });
        }
      };
    });
  }

  async storePrivateKey(userId, privateKeyData, keyInfo = {}, keyType = 'encryption') {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const keyRecord = {
      id: `${keyType}_${userId}`,
      userId: userId,
      keyType: keyType,
      keyData: privateKeyData,
      keyInfo: {
        algorithm: keyInfo.algorithm || (keyType === 'encryption' ? 'RSA-OAEP' : 'RSA-PSS'),
        modulusLength: keyInfo.modulusLength || 2048,
        hash: keyInfo.hash || 'SHA-256',
        generatedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const req = store.put(keyRecord);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getPrivateKey(userId, keyType = 'encryption') {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(`${keyType}_${userId}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(`Failed to retrieve ${keyType} private key`));
    });
  }

  async storeSessionKey(userId, sessionId, keyData, keyInfo = {}) {
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
      sequenceNumber: 0, // Module 7: Initialize sequence
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    };
    return new Promise((resolve, reject) => {
      const req = store.put(keyRecord);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSessionKey(userId, sessionId) {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(`session_${userId}_${sessionId}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to retrieve session key'));
    });
  }

  // ✅ Module 7: Increment and Get Sequence Number
  async getNextSequenceNumber(userId, sessionId) {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const id = `session_${userId}_${sessionId}`;

    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (record) {
          const nextSeq = (record.sequenceNumber || 0) + 1;
          record.sequenceNumber = nextSeq;
          record.lastAccessed = new Date().toISOString();
          const updateRequest = store.put(record);
          updateRequest.onsuccess = () => resolve(nextSeq);
          updateRequest.onerror = () => reject(new Error('Failed to update sequence number'));
        } else {
          reject(new Error('Session not found for sequencing'));
        }
      };
      request.onerror = () => reject(new Error('Failed to access session for sequencing'));
    });
  }

  async hasPrivateKey(userId, keyType = 'encryption') {
    const key = await this.getPrivateKey(userId, keyType);
    return key !== null;
  }

  async getUserKeys(userId) {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const index = store.index('userId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to retrieve user keys'));
    });
  }

  async deleteKey(keyId) {
    if (!this.db) await this.init();
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    return new Promise((resolve, reject) => {
      const request = store.delete(keyId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(new Error(`Failed to delete key`));
    });
  }

  async clearUserKeys(userId, keyType = null) {
    try {
      const userKeys = await this.getUserKeys(userId);
      for (const key of userKeys) {
        if (keyType === null || key.keyType === keyType) {
          await this.deleteKey(key.id);
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to clear user keys:', error);
      throw error;
    }
  }

  updateLastAccessed(keyId) {
    // Optimization: fire and forget, don't await
    if (!this.db) return;
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.get(keyId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.lastAccessed = new Date().toISOString();
        store.put(request.result);
      }
    };
  }
}

const indexedDBManager = new IndexedDBManager();
export default indexedDBManager;