// Web Crypto API utility functions
class CryptoUtils {
  constructor() {
    this.algorithm = {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: { name: 'SHA-256' }
    };
    
    this.keyUsages = {
      publicKey: ['encrypt', 'wrapKey'],
      privateKey: ['decrypt', 'unwrapKey']
    };
  }

  // Generate RSA-2048 key pair
  async generateKeyPair() {
    try {
      console.log('🔑 Generating RSA-2048 key pair...');
      
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: { name: 'SHA-256' }
        },
        true, // extractable
        ['encrypt', 'decrypt'] // key usages
      );

      console.log('✅ Key pair generated successfully');
      return keyPair;
    } catch (error) {
      console.error('❌ Key generation failed:', error);
      throw new Error(`Key generation failed: ${error.message}`);
    }
  }

  // Export public key as Base64 string for storage
  async exportPublicKey(publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('spki', publicKey);
      const base64 = this.arrayBufferToBase64(exported);
      return base64;
    } catch (error) {
      console.error('Public key export failed:', error);
      throw error;
    }
  }

  // Export private key as Base64 string for secure storage
  async exportPrivateKey(privateKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
      const base64 = this.arrayBufferToBase64(exported);
      return base64;
    } catch (error) {
      console.error('Private key export failed:', error);
      throw error;
    }
  }

  // Import public key from Base64 string
  async importPublicKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        binary,
        {
          name: 'RSA-OAEP',
          hash: { name: 'SHA-256' }
        },
        true,
        ['encrypt']
      );
      return publicKey;
    } catch (error) {
      console.error('Public key import failed:', error);
      throw error;
    }
  }

  // Import private key from Base64 string
  async importPrivateKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        binary,
        {
          name: 'RSA-OAEP',
          hash: { name: 'SHA-256' }
        },
        true,
        ['decrypt']
      );
      return privateKey;
    } catch (error) {
      console.error('Private key import failed:', error);
      throw error;
    }
  }

  // Generate key fingerprint (SHA-256 hash of public key)
  async generateKeyFingerprint(publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('spki', publicKey);
      const hash = await window.crypto.subtle.digest('SHA-256', exported);
      const fingerprint = this.arrayBufferToHex(hash).substring(0, 32); // First 16 bytes
      return fingerprint;
    } catch (error) {
      console.error('Fingerprint generation failed:', error);
      throw error;
    }
  }

  // Utility: ArrayBuffer to Base64
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Utility: Base64 to ArrayBuffer
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Utility: ArrayBuffer to Hex string
  arrayBufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Generate random IV for AES-GCM
  generateRandomIV() {
    return window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
  }

  // Generate random key for symmetric encryption
  async generateSymmetricKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
  }
}

// Create singleton instance
const cryptoUtils = new CryptoUtils();
export default cryptoUtils;