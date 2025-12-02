import api from './api';
import cryptoUtils from '../utils/crypto';
import indexedDBManager from '../utils/indexedDB';

const CHUNK_SIZE = 256 * 1024; // 256KB

class FileService {
  async uploadFile(file, recipientUserId, sessionId, currentUserId) {
    if (!recipientUserId) throw new Error('Recipient ID missing'); // Critical check

    console.log(`📤 Uploading ${file.name} to ${recipientUserId}`);
    
    const sessionKeyRecord = await indexedDBManager.getSessionKey(currentUserId, sessionId);
    if (!sessionKeyRecord) throw new Error('Session key not found');
    const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);

    const fileKey = await cryptoUtils.generateFileKey();
    const encryptedKey = await cryptoUtils.wrapFileKey(sessionKey, fileKey);

    const chunks = [];
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = await file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE).arrayBuffer();
      const { ciphertext, iv } = await cryptoUtils.encryptChunk(fileKey, chunk);
      chunks.push({ index: i, ciphertext, iv });
    }

    const payload = {
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      recipients: [{ userId: recipientUserId, encryptedKey, sessionId }],
      chunks
    };

    const response = await api.post('/files/upload', payload);
    return response.data;
  }

  async downloadFile(fileId, currentUserId) {
    const { data: { file } } = await api.get(`/files/download/${fileId}`);
    
    const recipientInfo = file.recipients.find(r => r.userId === currentUserId);
    if (!recipientInfo) throw new Error('Key not found for user');

    const sessionKeyRecord = await indexedDBManager.getSessionKey(currentUserId, recipientInfo.sessionId);
    if (!sessionKeyRecord) throw new Error('Session key missing');
    const sessionKey = await cryptoUtils.importSessionKey(sessionKeyRecord.keyData);

    const fileKey = await cryptoUtils.unwrapFileKey(sessionKey, recipientInfo.encryptedKey);
    
    const chunks = [];
    for (const chunk of file.chunks.sort((a, b) => a.index - b.index)) {
      chunks.push(await cryptoUtils.decryptChunk(fileKey, chunk.ciphertext, chunk.iv));
    }

    return { blob: new Blob(chunks, { type: file.mimeType }), filename: file.filename };
  }

  async listFiles() { return api.get('/files/list'); }
}

export const fileService = new FileService();