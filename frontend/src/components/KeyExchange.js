import React, { useState, useEffect } from 'react';
import keyService from '../services/keyService';
import keyExchangeService from '../services/keyExchangeService';
import { usersAPI, keyExchangeAPI } from '../services/api';
import { authService } from '../services/auth';
import './KeyExchange.css';

const KeyExchange = ({ onBack }) => { // ADDED onBack prop
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

  const checkSigningKeys = async () => {
    try {
      const signingKey = await keyService.getSigningPrivateKey(currentUser.id);
      setHasSigningKeys(!!signingKey);
    } catch (error) { setHasSigningKeys(false); }
  };

  const searchUsers = async () => {
    if (searchTerm.length < 2) return;
    try {
      setLoading(true);
      const response = await usersAPI.searchUsers(searchTerm);
      setUsers(response.data.users);
    } catch (error) { setError('Search failed'); } finally { setLoading(false); }
  };

  const getPendingExchanges = async () => {
    try {
      const response = await keyExchangeAPI.getPending();
      setPendingExchanges(response.data.exchanges);
    } catch (error) {}
  };

  const generateSigningKeys = async () => {
    setLoading(true);
    await keyService.generateAndStoreSigningKeys(currentUser.id);
    setHasSigningKeys(true);
    setLoading(false);
  };

  const initiateExchange = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      const result = await keyExchangeService.initiateKeyExchange(selectedUser, currentUser.id);
      setActiveExchange({ sessionId: result.sessionId, stage: 'initiated' });
      pollExchangeStatus(result.sessionId);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const respondToExchange = async (sessionId) => {
    setLoading(true);
    try {
      const result = await keyExchangeService.respondToKeyExchange(sessionId, currentUser.id);
      setActiveExchange({ sessionId, stage: 'responded' });
      setPendingExchanges(p => p.filter(e => e.sessionId !== sessionId));
      pollForCompletion(sessionId);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const completeExchange = async (sessionId) => {
    await keyExchangeService.completeKeyExchange(sessionId, currentUser.id);
    setActiveExchange(p => ({ ...p, stage: 'completed' }));
    setCompletedExchanges(p => [...p, { sessionId, completedAt: new Date().toISOString() }]);
  };

  const pollExchangeStatus = async (sessionId) => {
    const interval = setInterval(async () => {
      try {
        const res = await keyExchangeAPI.getStatus(sessionId);
        if (res.data.status === 'responded') {
          clearInterval(interval);
          await completeExchange(sessionId);
        }
      } catch (e) { clearInterval(interval); }
    }, 3000);
  };

  const pollForCompletion = async (sessionId) => {
    const interval = setInterval(async () => {
      try {
        const res = await keyExchangeAPI.getStatus(sessionId);
        if (res.data.status === 'completed' || res.data.status === 'confirmed') {
          clearInterval(interval);
          await keyExchangeService.verifyKeyConfirmation(sessionId, currentUser.id);
          setActiveExchange(p => ({ ...p, stage: 'completed' }));
        }
      } catch (e) { clearInterval(interval); }
    }, 3000);
  };

  useEffect(() => {
    checkSigningKeys();
    getPendingExchanges();
    const interval = setInterval(getPendingExchanges, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) searchUsers();
  }, [searchTerm]);

  return (
    <div className="key-exchange-container">
      {/* ADDED BACK BUTTON */}
      <div style={{marginBottom: '20px'}}>
        <button onClick={onBack} className="btn btn-secondary">← Back to Dashboard</button>
      </div>

      <h2>🔐 Secure Key Exchange</h2>
      
      {/* SIGNING KEYS */}
      {!hasSigningKeys ? (
        <div className="signing-keys-section">
          <p>Generate signing keys to continue.</p>
          <button onClick={generateSigningKeys} disabled={loading} className="btn btn-primary">
            {loading ? 'Generating...' : 'Generate Signing Keys'}
          </button>
        </div>
      ) : (
        <>
          {/* PENDING */}
          {pendingExchanges.length > 0 && (
            <div className="pending-section">
              <h3>Pending Requests</h3>
              {pendingExchanges.map(ex => (
                <div key={ex.sessionId} className="exchange-item">
                  <span>From: {ex.initiatorId?.username}</span>
                  <button onClick={() => respondToExchange(ex.sessionId)} className="btn btn-warning">Respond</button>
                </div>
              ))}
            </div>
          )}

          {/* INITIATE */}
          <div className="initiate-section">
            <h3>Start New Exchange</h3>
            <input 
              type="text" 
              placeholder="Search user..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="search-input"
            />
            {users.map(u => (
              <div key={u._id} className={`user-item ${selectedUser===u._id?'selected':''}`} onClick={() => setSelectedUser(u._id)}>
                {u.username}
              </div>
            ))}
            <button onClick={initiateExchange} disabled={!selectedUser || loading} className="btn btn-success">
              Initiate
            </button>
          </div>

          {/* STATUS */}
          {activeExchange && (
            <div className="active-exchange">
              <h4>Status: {activeExchange.stage}</h4>
              {activeExchange.stage === 'completed' && <p>✅ Secure Session Established!</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default KeyExchange;