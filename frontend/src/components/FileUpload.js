import React, { useState } from 'react';
import fileService from '../services/fileService';
import { authService } from '../services/auth';
import './FileUpload.css';

const FileUpload = ({ sessionId, onUploadComplete }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [useEnvelope, setUseEnvelope] = useState(!sessionId);

  const currentUser = authService.getCurrentUser();

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      setError('File exceeds maximum size of 100MB');
      return;
    }

    setSelectedFile(file);
    setError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError('');

      let result;

      if (useEnvelope || !sessionId) {
        console.log('📤 Uploading with envelope encryption...');
        result = await fileService.uploadFileWithEnvelope(
          selectedFile,
          currentUser.id,
          (current, total) => {
            setProgress(Math.round((current / total) * 100));
          }
        );
      } else {
        console.log('📤 Uploading with session key...');
        result = await fileService.uploadFileWithSessionKey(
          selectedFile,
          sessionId,
          currentUser.id,
          (current, total) => {
            setProgress(Math.round((current / total) * 100));
          }
        );
      }

      console.log('✅ Upload complete:', result);

      setSelectedFile(null);
      setProgress(0);

      if (onUploadComplete) {
        onUploadComplete(result);
      }

    } catch (error) {
      console.error('Upload error:', error);
      setError('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  return (
    <div className="file-upload-container">
      <h3>📤 Upload Encrypted File</h3>

      {sessionId && (
        <div className="encryption-mode">
          <label>
            <input
              type="radio"
              checked={!useEnvelope}
              onChange={() => setUseEnvelope(false)}
              disabled={uploading}
            />
            Session-based (current chat session)
          </label>
          <label>
            <input
              type="radio"
              checked={useEnvelope}
              onChange={() => setUseEnvelope(true)}
              disabled={uploading}
            />
            Envelope encryption (shareable with anyone)
          </label>
        </div>
      )}

      <div className="file-input-wrapper">
        <input
          type="file"
          id="file-input"
          onChange={handleFileSelect}
          disabled={uploading}
          className="file-input"
        />
        <label htmlFor="file-input" className="file-input-label">
          {selectedFile ? '📄 Change File' : '📁 Choose File'}
        </label>
      </div>

      {selectedFile && (
        <div className="file-info">
          <p><strong>File:</strong> {selectedFile.name}</p>
          <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
          <p><strong>Type:</strong> {selectedFile.type || 'Unknown'}</p>
          <p className="encryption-method">
            {useEnvelope ? '🔑 Envelope Encryption' : '🔐 Session Encryption'}
          </p>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p>Uploading: {progress}%</p>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        className="upload-button"
      >
        {uploading ? `Encrypting and Uploading... ${progress}%` : '🔐 Encrypt and Upload'}
      </button>

      <div className="upload-info">
        <p><strong>How it works:</strong></p>
        <ul>
          <li>File is split into 256KB chunks</li>
          <li>Each chunk is encrypted with AES-256-GCM</li>
          <li>Unique IV per chunk (no reuse)</li>
          <li>Server stores only ciphertext</li>
          <li>Max file size: 100MB</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;