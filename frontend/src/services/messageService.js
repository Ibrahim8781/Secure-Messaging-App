
import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';
import { messagesAPI } from './api';

class MessageService {
  constructor() {
    this.MAX_MESSAGE_SIZE = 256 * 1024; // 256 KiB
  }

  /**
   * Encrypt a text message using session key
   * @param {string} plaintext - Message to encrypt
   * @param {string} sessionId - Session ID for retrieving session key
   * @param {string} userId - Current user ID
   * @returns {Object} - { ciphertext: base64, iv: base64 }
   */
  async encryptMessage(plaintext, sessionId, userId) {
    try {
      console.log('🔐 Encrypting message...');

      // Get session key from IndexedDB
      const sessionKeyRecord = await indexedDBManager.getSessionKey(userId, sessionId);
      if (!sessionKeyRecord) {
        throw new Error('Session key not found. Please complete key exchange first.');
      }

      // Import session key
      const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);

      // Generate random 12-byte IV
      const iv = cryptoUtils.generateMessageIV();

      // Convert plaintext to ArrayBuffer
      const encoder = new TextEncoder();
      const plaintextBuffer = encoder.encode(plaintext);

      // Check size before encryption
      if (plaintextBuffer.byteLength > this.MAX_MESSAGE_SIZE) {
        throw new Error('Message exceeds maximum size of 256 KiB');
      }

      // Encrypt using AES-256-GCM
      const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128 // 128-bit authentication tag
        },
        sessionKey,
        plaintextBuffer
      );

      // Convert to base64
      const ciphertext = cryptoUtils.arrayBufferToBase64(ciphertextBuffer);
      const ivBase64 = cryptoUtils.arrayBufferToBase64(iv);

      console.log('✅ Message encrypted successfully');

      return {
        ciphertext,
        iv: ivBase64
      };

    } catch (error) {
      console.error('❌ Message encryption failed:', error);
      throw error;
    }
  }

  /**
   * Decrypt a message using session key
   * @param {string} ciphertext - Base64 encoded ciphertext
   * @param {string} iv - Base64 encoded IV
   * @param {string} sessionId - Session ID for retrieving session key
   * @param {string} userId - Current user ID
   * @returns {string} - Decrypted plaintext
   */
  async decryptMessage(ciphertext, iv, sessionId, userId) {
    try {
      console.log('🔓 Decrypting message...');

      // Get session key from IndexedDB
      const sessionKeyRecord = await indexedDBManager.getSessionKey(userId, sessionId);
      if (!sessionKeyRecord) {
        throw new Error('Session key not found');
      }

      // Import session key
      const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);

      // Convert from base64 to ArrayBuffer
      const ciphertextBuffer = cryptoUtils.base64ToArrayBuffer(ciphertext);
      const ivBuffer = cryptoUtils.base64ToArrayBuffer(iv);

      // Decrypt using AES-256-GCM
      const plaintextBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBuffer,
          tagLength: 128
        },
        sessionKey,
        ciphertextBuffer
      );

      // Convert to string
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(plaintextBuffer);

      console.log('✅ Message decrypted successfully');

      return plaintext;

    } catch (error) {
      console.error('❌ Message decryption failed');
      // Don't log the actual error details to prevent information leakage
      throw new Error('Failed to decrypt message. The message may be corrupted or the session key may be invalid.');
    }
  }

  /**
   * Send encrypted message
   * @param {string} recipientId - Recipient user ID
   * @param {string} sessionId - Session ID from key exchange
   * @param {string} plaintext - Message to send
   * @param {string} userId - Current user ID
   */
  async sendMessage(recipientId, sessionId, plaintext, userId) {
    try {
      // Encrypt message
      const { ciphertext, iv } = await this.encryptMessage(plaintext, sessionId, userId);

      // Send to server
      const response = await messagesAPI.send({
        to: recipientId,
        sessionId,
        ciphertext,
        iv,
        messageType: 'text'
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

  /**
   * Get and decrypt messages for a conversation
   * @param {string} userId - Other user ID
   * @param {string} currentUserId - Current user ID
   * @param {Object} options - { limit, before }
   */
  async getConversationMessages(userId, currentUserId, options = {}) {
    try {
      const response = await messagesAPI.getConversation(userId, options);
      const encryptedMessages = response.data.messages;

      // Decrypt all messages
      const decryptedMessages = await Promise.all(
        encryptedMessages.map(async (msg) => {
          try {
            const plaintext = await this.decryptMessage(
              msg.ciphertext,
              msg.iv,
              msg.sessionId,
              currentUserId
            );

            return {
              id: msg.id,
              from: msg.from,
              to: msg.to,
              plaintext,
              timestamp: msg.timestamp,
              messageType: msg.messageType,
              decrypted: true
            };
          } catch (error) {
            // If decryption fails, return error marker
            console.error('Failed to decrypt message:', msg.id);
            return {
              id: msg.id,
              from: msg.from,
              to: msg.to,
              plaintext: '[Decryption failed]',
              timestamp: msg.timestamp,
              messageType: msg.messageType,
              decrypted: false,
              error: true
            };
          }
        })
      );

      return {
        messages: decryptedMessages,
        hasMore: response.data.hasMore
      };

    } catch (error) {
      console.error('Failed to get conversation messages:', error);
      throw error;
    }
  }

  /**
   * Get conversations list
   */
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

// Create singleton instance
const messageService = new MessageService();
export default messageService;