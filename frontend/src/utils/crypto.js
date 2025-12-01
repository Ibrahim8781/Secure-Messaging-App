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

  // ============ ADD THESE METHODS TO YOUR EXISTING CryptoUtils CLASS ============

  // Generate ECDH key pair (P-256 curve)
  async generateECDHKeyPair() {
    try {
      console.log('🔐 Generating ECDH P-256 key pair...');

      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true, // extractable
        ['deriveKey', 'deriveBits']
      );

      console.log('✅ ECDH key pair generated');
      return keyPair;
    } catch (error) {
      console.error('❌ ECDH key generation failed:', error);
      throw error;
    }
  }

  // Export ECDH public key
  async exportECDHPublicKey(publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('raw', publicKey);
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error('ECDH public key export failed:', error);
      throw error;
    }
  }

  // Import ECDH public key
  async importECDHPublicKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const publicKey = await window.crypto.subtle.importKey(
        'raw',
        binary,
        {
          name: 'ECDH',
          namedCurve: 'P-256'
        },
        true,
        []
      );
      return publicKey;
    } catch (error) {
      console.error('ECDH public key import failed:', error);
      throw error;
    }
  }

  // Compute ECDH shared secret
  async computeECDHSharedSecret(privateKey, publicKey) {
    try {
      console.log('🔑 Computing ECDH shared secret...');

      const sharedSecret = await window.crypto.subtle.deriveBits(
        {
          name: 'ECDH',
          public: publicKey
        },
        privateKey,
        256 // 256 bits
      );

      console.log('✅ Shared secret computed');
      return sharedSecret;
    } catch (error) {
      console.error('❌ Shared secret computation failed:', error);
      throw error;
    }
  }

  // Derive session key using HKDF
  async deriveSessionKey(sharedSecret, salt, info) {
    try {
      console.log('🔐 Deriving session key with HKDF...');

      // Import shared secret as key material
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'HKDF' },
        false,
        ['deriveKey']
      );

      // Derive AES-GCM key
      const sessionKey = await window.crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt,
          info: info
        },
        keyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      console.log('✅ Session key derived (AES-256-GCM)');
      return sessionKey;
    } catch (error) {
      console.error('❌ Session key derivation failed:', error);
      throw error;
    }
  }

  // Generate RSA-PSS signing key pair
  async generateSigningKeyPair() {
    try {
      console.log('🔐 Generating RSA-PSS signing key pair...');

      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
          hash: { name: 'SHA-256' }
        },
        true, // extractable
        ['sign', 'verify']
      );

      console.log('✅ Signing key pair generated');
      return keyPair;
    } catch (error) {
      console.error('❌ Signing key generation failed:', error);
      throw error;
    }
  }

  // Export signing public key
  async exportSigningPublicKey(publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('spki', publicKey);
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error('Signing public key export failed:', error);
      throw error;
    }
  }

  // Export signing private key
  async exportSigningPrivateKey(privateKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error('Signing private key export failed:', error);
      throw error;
    }
  }

  // Import signing public key
  async importSigningPublicKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        binary,
        {
          name: 'RSA-PSS',
          hash: { name: 'SHA-256' }
        },
        true,
        ['verify']
      );
      return publicKey;
    } catch (error) {
      console.error('Signing public key import failed:', error);
      throw error;
    }
  }

  // Import signing private key
  async importSigningPrivateKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        binary,
        {
          name: 'RSA-PSS',
          hash: { name: 'SHA-256' }
        },
        true,
        ['sign']
      );
      return privateKey;
    } catch (error) {
      console.error('Signing private key import failed:', error);
      throw error;
    }
  }

  // Sign data with RSA-PSS
  async signData(privateKey, data) {
    try {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);

      const signature = await window.crypto.subtle.sign(
        {
          name: 'RSA-PSS',
          saltLength: 32
        },
        privateKey,
        encodedData
      );

      return this.arrayBufferToBase64(signature);
    } catch (error) {
      console.error('Data signing failed:', error);
      throw error;
    }
  }

  // Verify RSA-PSS signature
  async verifySignature(publicKey, signature, data) {
    try {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      const signatureBuffer = this.base64ToArrayBuffer(signature);

      const isValid = await window.crypto.subtle.verify(
        {
          name: 'RSA-PSS',
          saltLength: 32
        },
        publicKey,
        signatureBuffer,
        encodedData
      );

      return isValid;
    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  // Generate HMAC
  async generateHMAC(sharedSecret, data) {
    try {
      // Import shared secret as HMAC key
      const key = await window.crypto.subtle.importKey(
        'raw',
        sharedSecret,
        {
          name: 'HMAC',
          hash: { name: 'SHA-256' }
        },
        false,
        ['sign']
      );

      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);

      const signature = await window.crypto.subtle.sign(
        'HMAC',
        key,
        encodedData
      );

      return this.arrayBufferToBase64(signature);
    } catch (error) {
      console.error('HMAC generation failed:', error);
      throw error;
    }
  }

  // Generate nonce
  generateNonce() {
    const nonce = window.crypto.getRandomValues(new Uint8Array(32));
    return this.arrayBufferToBase64(nonce.buffer);
  }

  // Export session key for storage
  async exportSessionKey(sessionKey) {
    try {
      const exported = await window.crypto.subtle.exportKey('raw', sessionKey);
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error('Session key export failed:', error);
      throw error;
    }
  }

  // Import session key from storage
  async importSessionKey(base64Key) {
    try {
      const binary = this.base64ToArrayBuffer(base64Key);
      const sessionKey = await window.crypto.subtle.importKey(
        'raw',
        binary,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );
      return sessionKey;
    } catch (error) {
      console.error('Session key import failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const cryptoUtils = new CryptoUtils();
export default cryptoUtils;