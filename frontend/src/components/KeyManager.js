import React, { useState, useEffect } from 'react';
import keyService from '../services/keyService';
import { authService } from '../services/auth';
import './KeyManager.css';

const KeyManager = () => {
  const [keyStatus, setKeyStatus] = useState('checking'); // checking, generating, exists, error, none
  const [keyStats, setKeyStats] = useState(null);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    setUser(currentUser);
    checkKeyStatus(currentUser.id);
  }, []);

  const checkKeyStatus = async (userId) => {
    try {
      setKeyStatus('checking');
      setError('');

      const hasKeys = await keyService.hasKeys(userId);
      if (hasKeys) {
        const stats = await keyService.getKeyStats(userId);
        setKeyStats(stats);
        setKeyStatus('exists');
      } else {
        setKeyStatus('none');
      }
    } catch (error) {
      console.error('Error checking key status:', error);
      setKeyStatus('error');
      setError('Failed to check key status: ' + error.message);
    }
  };

  const generateKeys = async () => {
    if (!user) return;

    try {
      setKeyStatus('generating');
      setError('');

      const result = await keyService.generateAndStoreKeys(user.id);
      
      if (result.success) {
        const stats = await keyService.getKeyStats(user.id);
        setKeyStats(stats);
        setKeyStatus('exists');
      }
    } catch (error) {
      console.error('Key generation failed:', error);
      setKeyStatus('error');
      setError('Key generation failed: ' + error.message);
    }
  };

  const regenerateKeys = async () => {
    if (!user) return;

    if (!window.confirm('Are you sure you want to regenerate your encryption keys? This action cannot be undone and you may lose access to old messages.')) {
      return;
    }

    try {
      setKeyStatus('generating');
      setError('');

      const result = await keyService.regenerateKeys(user.id);
      
      if (result.success) {
        const stats = await keyService.getKeyStats(user.id);
        setKeyStats(stats);
        setKeyStatus('exists');
      }
    } catch (error) {
      console.error('Key regeneration failed:', error);
      setKeyStatus('error');
      setError('Key regeneration failed: ' + error.message);
    }
  };

  const getStatusMessage = () => {
    switch (keyStatus) {
      case 'checking':
        return {
          message: '🔍 Checking key status...',
          className: 'key-status-checking'
        };
      case 'generating':
        return {
          message: '⚙️ Generating encryption keys... This may take a few seconds.',
          className: 'key-status-generating'
        };
      case 'exists':
        return {
          message: '✅ Your encryption keys are set up and ready!',
          className: 'key-status-exists'
        };
      case 'none':
        return {
          message: '🔐 You need to generate encryption keys to start secure messaging.',
          className: 'key-status-none'
        };
      case 'error':
        return {
          message: `❌ Error: ${error}`,
          className: 'key-status-error'
        };
      default:
        return {
          message: 'Unknown status',
          className: 'key-status-checking'
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <div className="key-manager">
      <h3>🔑 Encryption Key Management</h3>
      
      <div className={`key-status ${statusInfo.className}`}>
        <div className="status-message">{statusInfo.message}</div>
        
        {keyStatus === 'generating' && (
          <div className="loading-spinner-small"></div>
        )}
      </div>

      {keyStats && keyStatus === 'exists' && (
        <div className="key-stats">
          <h4>Key Information:</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Key Type:</span>
              <span className="stat-value">RSA-2048</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Algorithm:</span>
              <span className="stat-value">RSA-OAEP</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Hash:</span>
              <span className="stat-value">SHA-256</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Keys:</span>
              <span className="stat-value">{keyStats.totalKeys}</span>
            </div>
            {keyStats.latestAccess && (
              <div className="stat-item">
                <span className="stat-label">Last Accessed:</span>
                <span className="stat-value">
                  {new Date(keyStats.latestAccess).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="key-actions">
        {keyStatus === 'none' && (
          <button 
            onClick={generateKeys}
            className="key-action-button primary"
            disabled={keyStatus === 'generating'}
          >
            Generate Encryption Keys
          </button>
        )}

        {keyStatus === 'exists' && (
          <button 
            onClick={regenerateKeys}
            className="key-action-button warning"
            disabled={keyStatus === 'generating'}
          >
            Regenerate Keys
          </button>
        )}

        {keyStatus === 'error' && (
          <button 
            onClick={() => checkKeyStatus(user?.id)}
            className="key-action-button secondary"
          >
            Retry
          </button>
        )}
      </div>

      <div className="key-security-info">
        <h4>🔒 Security Details:</h4>
        <ul>
          <li><strong>Private Key:</strong> Stored securely in your browser's IndexedDB</li>
          <li><strong>Public Key:</strong> Uploaded to server for other users to encrypt messages</li>
          <li><strong>Encryption:</strong> RSA-2048 (asymmetric) + AES-256-GCM (symmetric)</li>
          <li><strong>Key Storage:</strong> Private keys NEVER leave your device</li>
        </ul>
      </div>

      {keyStatus === 'exists' && (
        <div className="next-step">
          <h4>🎉 Ready for Module 4!</h4>
          <p>Your encryption keys are set up. Next, we'll implement the custom key exchange protocol for secure communication.</p>
        </div>
      )}
    </div>
  );
};

export default KeyManager;