import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';
import { messagesAPI } from './api';

class MessageService {
  constructor() {
    this.MAX_MESSAGE_SIZE = 256 * 1024; // 256 KiB
  }

  async encryptMessage(plaintext, sessionId, userId) {
    try {
      const sessionKeyRecord = await indexedDBManager.getSessionKey(userId, sessionId);
      if (!sessionKeyRecord) throw new Error('Session key not found.');
      const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);
      const iv = cryptoUtils.generateMessageIV();
      const encoder = new TextEncoder();
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv, tagLength: 128 },
        sessionKey,
        encoder.encode(plaintext)
      );
      return {
        ciphertext: cryptoUtils.arrayBufferToBase64(ciphertextBuffer),
        iv: cryptoUtils.arrayBufferToBase64(iv)
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  async decryptMessage(ciphertext, iv, sessionId, userId) {
    try {
      const sessionKeyRecord = await indexedDBManager.getSessionKey(userId, sessionId);
      if (!sessionKeyRecord) throw new Error('Session key not found');
      const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);
      const ciphertextBuffer = cryptoUtils.base64ToArrayBuffer(ciphertext);
      const ivBuffer = cryptoUtils.base64ToArrayBuffer(iv);
      const plaintextBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer, tagLength: 128 },
        sessionKey,
        ciphertextBuffer
      );
      return new TextDecoder().decode(plaintextBuffer);
    } catch (error) {
      // console.error('Decryption failed'); // Reduce noise
      throw new Error('Decryption failed');
    }
  }

  // ✅ Updated for Module 7
  async sendMessage(recipientId, sessionId, plaintext, userId) {
    try {
      // 1. Encrypt
      const { ciphertext, iv } = await this.encryptMessage(plaintext, sessionId, userId);

      // 2. Get Replay Protection Data
      const sequenceNumber = await indexedDBManager.getNextSequenceNumber(userId, sessionId);
      const nonce = cryptoUtils.generateNonce();
      const timestamp = Date.now();

      // 3. Send with Module 7 Fields
      const response = await messagesAPI.send({
        to: recipientId,
        sessionId,
        ciphertext,
        iv,
        messageType: 'text',
        sequenceNumber, // ✅
        nonce,          // ✅
        timestamp       // ✅
      });

      return {
        success: true,
        messageId: response.data.messageId,
        timestamp: response.data.timestamp
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  async getConversationMessages(userId, currentUserId, options = {}) {
    try {
      const response = await messagesAPI.getConversation(userId, options);
      const encryptedMessages = response.data.messages;
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg) => {
          try {
            const plaintext = await this.decryptMessage(msg.ciphertext, msg.iv, msg.sessionId, currentUserId);
            return {
              id: msg.id, from: msg.from, to: msg.to, plaintext, timestamp: msg.timestamp,
              messageType: msg.messageType, decrypted: true
            };
          } catch (error) {
            return {
              id: msg.id, from: msg.from, to: msg.to, plaintext: '[Decryption failed]',
              timestamp: msg.timestamp, messageType: msg.messageType, decrypted: false, error: true
            };
          }
        })
      );
      return { messages: decryptedMessages, hasMore: response.data.hasMore };
    } catch (error) {
      console.error('Failed to get messages:', error);
      throw error;
    }
  }

  async getConversations() {
    try {
      const response = await messagesAPI.getConversations();
      return response.data.conversations;
    } catch (error) {
      console.error('Failed to get conversations:', error);
      throw error;
    }
  }
}

const messageService = new MessageService();
export default messageService;