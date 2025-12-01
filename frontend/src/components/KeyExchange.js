import React, { useState, useEffect } from 'react';
import keyService from '../services/keyService';
import keyExchangeService from '../services/keyExchangeService';
import { usersAPI, keyExchangeAPI } from '../services/api';
import { authService } from '../services/auth';
import './KeyExchange.css';

const KeyExchange = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeExchange, setActiveExchange] = useState(null);
  const [pendingExchanges, setPendingExchanges] = useState([]);
  const [completedExchanges, setCompletedExchanges] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSigningKeys, setHasSigningKeys] = useState(false);

  const currentUser = authService.getCurrentUser();

  // Check if user has signing keys
  const checkSigningKeys = async () => {
    try {
      const signingKey = await keyService.getSigningPrivateKey(currentUser.id);
      setHasSigningKeys(!!signingKey);
    } catch (error) {
      console.error('Failed to check signing keys:', error);
      setHasSigningKeys(false);
    }
  };

  // Search users
  const searchUsers = async () => {
    if (searchTerm.length < 2) return;

    try {
      setLoading(true);
      const response = await usersAPI.searchUsers(searchTerm);
      setUsers(response.data.users);
    } catch (error) {
      console.error('User search failed:', error);
      setError('Failed to search users: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Get pending exchanges
  const getPendingExchanges = async () => {
    try {
      const response = await keyExchangeAPI.getPending();
      setPendingExchanges(response.data.exchanges);
    } catch (error) {
      console.error('Failed to get pending exchanges:', error);
    }
  };

  // Generate signing keys
  const generateSigningKeys = async () => {
    try {
      setLoading(true);
      setError('');
      setStatus('Generating RSA-PSS signing keys...');

      await keyService.generateAndStoreSigningKeys(currentUser.id);
      setHasSigningKeys(true);
      setStatus('✅ Signing keys generated successfully!');
    } catch (error) {
      console.error('Signing key generation failed:', error);
      setError('Failed to generate signing keys: ' + error.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Initiate key exchange
  const initiateExchange = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStatus('Step 1: Generating ephemeral ECDH key pair...');

      const result = await keyExchangeService.initiateKeyExchange(selectedUser, currentUser.id);

      setActiveExchange({
        sessionId: result.sessionId,
        stage: 'initiated',
        responderId: selectedUser
      });

      setStatus('✅ Key exchange initiated. Waiting for response from other user...');

      // Start polling for response
      pollExchangeStatus(result.sessionId);

    } catch (error) {
      console.error('Key exchange initiation failed:', error);
      setError('Initiation failed: ' + error.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Respond to key exchange
const respondToExchange = async (sessionId) => {
  try {
    setLoading(true);
    setError('');
    setStatus('Step 1: Verifying initiator signature...');

    const result = await keyExchangeService.respondToKeyExchange(sessionId, currentUser.id);
    
    setActiveExchange({
      sessionId: sessionId,
      stage: 'responded',
      sessionKey: result.sessionKey
    });
    
    setStatus('✅ Response sent! Exchange will complete when initiator confirms. You can close this page.');
    
    // Remove from pending
    setPendingExchanges(pending => pending.filter(ex => ex.sessionId !== sessionId));
    
    // Add to completed (since our part is done)
    setCompletedExchanges(prev => [...prev, {
      sessionId,
      completedAt: new Date().toISOString()
    }]);
    
  } catch (error) {
    console.error('Key exchange response failed:', error);
    setError('Response failed: ' + error.message);
    setStatus('');
  } finally {
    setLoading(false);
  }
};
  // Complete exchange (initiator)
  const completeExchange = async (sessionId) => {
    try {
      setLoading(true);
      setError('');
      setStatus('Step 3: Verifying responder signature and deriving session key...');

      const result = await keyExchangeService.completeKeyExchange(sessionId, currentUser.id);

      setActiveExchange({
        sessionId: sessionId,
        stage: 'completed',
        sessionKey: result.sessionKey
      });

      setStatus('✅ Key exchange completed! Secure session established.');

      // Add to completed
      setCompletedExchanges(prev => [
        ...prev,
        {
          sessionId,
          completedAt: new Date().toISOString()
        }
      ]);

    } catch (error) {
      console.error('Key exchange completion failed:', error);
      setError('Completion failed: ' + error.message);
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  // Poll for exchange status
  const pollExchangeStatus = async (sessionId) => {
    const maxAttempts = 40;
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setStatus('⚠️ Response timeout. The other user may not be online.');
        return;
      }

      try {
        const response = await keyExchangeAPI.getStatus(sessionId);
        console.log('Polling status:', response.data.status);

        if (response.data.status === 'responded') {
          setStatus('Step 2: Responder has responded. Completing exchange...');
          await completeExchange(sessionId);
        } else {
          attempts++;
          setTimeout(poll, 3000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        setTimeout(poll, 3000);
      }
    };

    poll();
  };

  // Poll completion (responder)
// Poll for completion (responder side)
const pollForCompletion = async (sessionId) => {
  const maxAttempts = 40; // 2 minutes
  let attempts = 0;

  const poll = async () => {
    if (attempts >= maxAttempts) {
      setStatus('⚠️ Completion timeout.');
      return;
    }

    try {
      const response = await keyExchangeAPI.getStatus(sessionId);
      console.log('Responder polling status:', response.data.status);
      
      // Check if initiator has sent confirmation
      if (response.data.status === 'confirmed' || response.data.status === 'completed') {
        // Wait a bit to ensure confirmation is in DB
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          await keyExchangeService.verifyKeyConfirmation(sessionId, currentUser.id);
          setActiveExchange(prev => ({ ...prev, stage: 'completed' }));
          setStatus('✅ Key exchange completed successfully!');
          
          setCompletedExchanges(prev => [...prev, {
            sessionId,
            completedAt: new Date().toISOString()
          }]);
          
          return; // Exit polling
        } catch (verifyError) {
          console.log('Confirmation not ready yet, continuing to poll...', verifyError.message);
          // If confirmation not ready, continue polling
          attempts++;
          setTimeout(poll, 3000);
        }
      } else {
        attempts++;
        setTimeout(poll, 3000);
      }
    } catch (error) {
      console.error('Polling error:', error);
      attempts++;
      setTimeout(poll, 3000);
    }
  };

  // Wait 2 seconds before starting to poll (give initiator time to complete)
  setTimeout(poll, 2000);
};

  // Init
  useEffect(() => {
    checkSigningKeys();
    getPendingExchanges();

    const interval = setInterval(getPendingExchanges, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      const debounceTimer = setTimeout(searchUsers, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  return (
    <div className="key-exchange-container">
      <h2>🔐 Secure Key Exchange Protocol</h2>
      <p className="subtitle">Establish secure sessions using ECDH + RSA-PSS signatures</p>

      {/* Signing Keys Section */}
      <div className="signing-keys-section">
        <h3>Step 1: Generate Signing Keys</h3>
        <p>You need RSA-PSS signing keys to authenticate key exchanges.</p>

        {hasSigningKeys ? (
          <div className="success-message">
            <p>✅ You have signing keys ready!</p>
          </div>
        ) : (
          <button
            onClick={generateSigningKeys}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Generating RSA-PSS Keys...' : 'Generate Signing Keys'}
          </button>
        )}
      </div>

      {/* Initiate Exchange */}
      {hasSigningKeys && (
        <div className="initiate-section">
          <h3>Step 2: Initiate Key Exchange</h3>

          <div className="user-search">
            <input
              type="text"
              placeholder="Search users by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              disabled={loading}
            />
            {loading && <div className="loading-small">Searching...</div>}
          </div>

          {users.length > 0 && (
            <div className="user-list">
              <h4>Select a user to exchange keys with:</h4>
              {users.map(user => (
                <div
                  key={user._id}
                  className={`user-item ${selectedUser === user._id ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(user._id)}
                >
                  <span className="username">{user.username}</span>
                  <span className="key-info">
                    {user.signingPublicKey ? '🔐 Has signing keys' : '❌ No signing keys'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {selectedUser && (
            <button
              onClick={initiateExchange}
              disabled={loading}
              className="btn btn-success"
            >
              {loading ? 'Initiating Protocol...' : 'Initiate Secure Key Exchange'}
            </button>
          )}
        </div>
      )}

      {/* Pending Exchanges */}
      {pendingExchanges.length > 0 && (
        <div className="pending-section">
          <h3>📨 Pending Key Exchange Requests</h3>
          {pendingExchanges.map(exchange => (
            <div key={exchange.sessionId} className="exchange-item">
              <div className="exchange-info">
                <strong>From:</strong> {exchange.initiatorId?.username || 'Unknown User'}<br />
                <strong>Session ID:</strong> {exchange.sessionId}<br />
                <strong>Initiated:</strong> {new Date(exchange.createdAt).toLocaleString()}
              </div>
              <button
                onClick={() => respondToExchange(exchange.sessionId)}
                disabled={loading}
                className="btn btn-warning"
              >
                {loading ? 'Responding...' : 'Respond to Exchange'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active Exchange */}
      {activeExchange && (
        <div className="active-exchange">
          <h3>🔄 Active Key Exchange</h3>
          <div className="exchange-status">
            <p><strong>Session ID:</strong> {activeExchange.sessionId}</p>
            <p>
              <strong>Stage:</strong>
              <span className={`stage stage-${activeExchange.stage}`}>
                {activeExchange.stage.toUpperCase()}
              </span>
            </p>
            <p><strong>Status:</strong> {status}</p>

            {activeExchange.stage === 'completed' && (
              <div className="success-message">
                <h4>✅ Key Exchange Successful!</h4>
                <p>Secure session established using AES-256-GCM.</p>
                <p><strong>Session Key:</strong> Derived via HKDF</p>
                <p><strong>Ready for:</strong> End-to-end encrypted messaging</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completed Exchanges */}
      {completedExchanges.length > 0 && (
        <div className="completed-section">
          <h3>✅ Completed Exchanges</h3>
          {completedExchanges.map(exchange => (
            <div key={exchange.sessionId} className="exchange-item completed">
              <strong>Session:</strong> {exchange.sessionId} |
              <strong> Completed:</strong> {new Date(exchange.completedAt).toLocaleString()}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Protocol Explanation */}
      <div className="protocol-explanation">
        <h3>🔍 Protocol Steps</h3>

        <div className="steps">
          <div className="step">
            <strong>Step 1:</strong> Initiator generates ephemeral ECDH key pair and signs the exchange data with RSA-PSS
          </div>
          <div className="step">
            <strong>Step 2:</strong> Responder verifies signature and responds with their ephemeral key
          </div>
          <div className="step">
            <strong>Step 3:</strong> Both parties continue to compute shared secret using ECDH
          </div>
          <div className="step">
            <strong>Step 4:</strong> Session key derived using HKDF with both nonces
          </div>
          <div className="step">
            <strong>Step 5:</strong> Key confirmation via HMAC to prevent MITM attacks
          </div>
        </div>

        <div className="security-features">
          <h4>🛡️ Security Features</h4>
          <ul>
            <li>✅ Ephemeral ECDH keys (P-256) for perfect forward secrecy</li>
            <li>✅ RSA-PSS signatures for authentication</li>
            <li>✅ HKDF key derivation with both nonces</li>
            <li>✅ Timestamp protection (5-minute window)</li>
            <li>✅ Key confirmation to prevent MITM</li>
            <li>✅ Session keys never transmitted over network</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default KeyExchange;
