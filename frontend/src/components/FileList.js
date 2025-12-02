import React, { useState, useEffect } from 'react';
import fileService from '../services/fileService';
import { authService } from '../services/auth';
import './FileList.css';

const FileList = () => {
  const [myFiles, setMyFiles] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('my-files');
  const [downloading, setDownloading] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadFiles();
  }, [activeTab]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError('');

      if (activeTab === 'my-files') {
        const files = await fileService.getMyFiles();
        setMyFiles(files);
      } else {
        const files = await fileService.getSharedFiles();
        setSharedFiles(files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setError('Failed to load files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      setDownloading(file.id);
      setDownloadProgress(0);
      setError('');

      let result;

      if (file.sessionId) {
        // Session-based download
        result = await fileService.downloadFileWithSessionKey(
          file.id,
          file.sessionId,
          currentUser.id,
          (current, total) => {
            setDownloadProgress(Math.round((current / total) * 100));
          }
        );
      } else {
        // Envelope-based download
        result = await fileService.downloadFileWithEnvelope(
          file.id,
          currentUser.id,
          (current, total) => {
            setDownloadProgress(Math.round((current / total) * 100));
          }
        );
      }

      // Trigger browser download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('✅ File downloaded and decrypted successfully');

    } catch (error) {
      console.error('Download error:', error);
      setError('Download failed: ' + error.message);
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const files = activeTab === 'my-files' ? myFiles : sharedFiles;

  return (
    <div className="file-list-container">
      <h3>📁 Encrypted Files</h3>

      {/* Tab Selection */}
      <div className="tab-selector">
        <button
          className={activeTab === 'my-files' ? 'active' : ''}
          onClick={() => setActiveTab('my-files')}
        >
          My Uploads ({myFiles.length})
        </button>
        <button
          className={activeTab === 'shared' ? 'active' : ''}
          onClick={() => setActiveTab('shared')}
        >
          Shared With Me ({sharedFiles.length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading files...</p>
        </div>
      )}

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* File List */}
      {!loading && files.length === 0 && (
        <div className="empty-state">
          <p>No files found.</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div className="files-grid">
          {files.map(file => (
            <div key={file.id} className="file-card">
              <div className="file-icon">
                📄
              </div>
              <div className="file-details">
                <h4>{file.filename}</h4>
                <p className="file-size">{formatFileSize(file.fileSize)}</p>
                <p className="file-date">{formatDate(file.createdAt)}</p>
                
                {activeTab === 'my-files' && file.sharedWith && file.sharedWith.length > 0 && (
                  <p className="shared-info">
                    🔗 Shared with {file.sharedWith.length} user(s)
                  </p>
                )}

                {activeTab === 'shared' && file.uploader && (
                  <p className="uploader-info">
                    👤 From: {file.uploader.username}
                  </p>
                )}

                <p className="encryption-badge">
                  {file.sessionId ? '🔐 Session-encrypted' : '🔑 Envelope-encrypted'}
                </p>
              </div>

              {downloading === file.id ? (
                <div className="download-progress-inline">
                  <div className="progress-bar-small">
                    <div className="progress-fill-small" style={{ width: `${downloadProgress}%` }}></div>
                  </div>
                  <p>{downloadProgress}%</p>
                </div>
              ) : (
                <button
                  onClick={() => handleDownload(file)}
                  disabled={downloading !== null}
                  className="download-button"
                >
                  📥 Download
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileList;