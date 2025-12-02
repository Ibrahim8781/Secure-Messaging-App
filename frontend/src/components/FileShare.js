import React, { useState, useEffect } from 'react';
import { fileService } from '../services/fileService';
import { authService } from '../services/auth';
import indexedDBManager from '../utils/indexedDB';
import './KeyManager.css';

const FileShare = ({ onStartChat }) => { // ✅ Added prop
  const [files, setFiles] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadFileStats();
    loadSessionsFromDB();
  }, []);

  const loadSessionsFromDB = async () => {
    try {
      const keys = await indexedDBManager.getUserKeys(currentUser.id);
      const sessions = keys
        .filter(k => k.keyType === 'session')
        .map(k => ({
          sessionId: k.sessionId,
          // Handle case where partnerId might be missing in old records
          partnerId: k.keyInfo?.partnerId || null, 
          date: new Date(k.createdAt).toLocaleDateString()
        }))
        // Only show sessions where we successfully saved the partner ID
        .filter(s => s.partnerId !== null); 
        
      setActiveSessions(sessions);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  };

  const loadFileStats = async () => {
    try {
      const res = await fileService.listFiles();
      setFiles(res.data.files);
    } catch (err) { console.error(err); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedSession) return;

    const session = activeSessions.find(s => s.sessionId === selectedSession);
    if (!session || !session.partnerId) {
      setError('Invalid session. Please perform key exchange again.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await fileService.uploadFile(file, session.partnerId, session.sessionId, currentUser.id);
      await loadFileStats();
      e.target.value = null; 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId) => {
    try {
      setLoading(true);
      const { blob, filename } = await fileService.downloadFile(fileId, currentUser.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Download failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!selectedSession) return;
    const session = activeSessions.find(s => s.sessionId === selectedSession);
    if (session && onStartChat) {
      onStartChat(session.partnerId, session.sessionId);
    }
  };

  return (
    <div className="key-manager">
      <h3>📂 Secure File Sharing & Chat</h3>
      {error && <div className="key-status key-status-error">{error}</div>}
      
      <div className="key-actions" style={{ flexDirection: 'column' }}>
        <p style={{fontSize: '0.9em', color: '#666', marginBottom: '5px'}}>
          Select a secure session to upload files or start chatting:
        </p>
        
        <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
          <select 
            onChange={(e) => setSelectedSession(e.target.value)}
            className="search-input"
            value={selectedSession}
            style={{ flex: 1 }}
          >
            <option value="">-- Select Recipient --</option>
            {activeSessions.map(s => (
              <option key={s.sessionId} value={s.sessionId}>
                Partner: {s.partnerId} ({s.date})
              </option>
            ))}
          </select>

          <button 
            onClick={handleStartChat}
            disabled={!selectedSession}
            className="key-action-button primary"
            style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          >
            💬 Chat
          </button>
        </div>

        <input type="file" onChange={handleFileUpload} disabled={loading || !selectedSession} />
        {loading && <div className="loading-spinner-small"></div>}
      </div>

      <div className="key-stats">
        <h4>Files</h4>
        <ul style={{ padding: 0 }}>
          {files.map(f => (
            <li key={f.id} className="stat-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{width: '100%', display: 'flex', justifyContent: 'space-between'}}>
                <span>{f.filename} ({Math.round(f.size/1024)}KB)</span>
                <span style={{fontSize: '0.8em', color: '#666'}}>
                  {f.isSender ? 'Sent' : `From ${f.uploader}`}
                </span>
              </div>
              {!f.isSender && (
                <button onClick={() => handleDownload(f.id)} className="key-action-button primary" style={{marginTop: '5px', padding: '5px 10px', fontSize: '0.8em'}}>
                  Download & Decrypt
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default FileShare;