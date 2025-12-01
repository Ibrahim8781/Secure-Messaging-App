import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/login';
import Register from './components/register';
import KeyManager from './components/KeyManager';
import { authService } from './services/auth';
import { authAPI } from './services/api';

// ### 11. Add KeyExchange to App
// Import KeyExchange component as suggested by peer
import KeyExchange from './components/KeyExchange';

import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [cryptoSupport, setCryptoSupport] = useState({ webCrypto: false, indexedDB: false });
const [currentView, setCurrentView] = useState('login'); // instead of 'status'
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkServerHealth();
    checkCryptoSupport();
    checkAuthentication();
  }, []);

  const checkServerHealth = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      if (response.data.status === 'OK') {
        setServerStatus('connected');
      } else {
        setServerStatus('error');
      }
    } catch (error) {
      console.error('Server health check failed:', error);
      setServerStatus('error');
    }
  };

  const checkCryptoSupport = () => {
    const webCryptoSupported =
      typeof window !== 'undefined' &&
      (window.crypto || window.msCrypto) &&
      window.crypto.subtle;

    const indexedDBSupported =
      typeof window !== 'undefined' &&
      ('indexedDB' in window);

    setCryptoSupport({
      webCrypto: !!webCryptoSupported,
      indexedDB: !!indexedDBSupported
    });
  };

  const checkAuthentication = async () => {
    if (authService.isAuthenticated()) {
      try {
        const response = await authAPI.verifyToken();
        if (response.data.valid) {
          setUser(response.data.user);
          setCurrentView('dashboard');
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        authService.clearAuthData();
      }
    }
    setAuthChecked(true);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleRegister = (userData) => {
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    authService.clearAuthData();
    setUser(null);
    setCurrentView('login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#28a745';
      case 'checking': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (!authChecked) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToRegister={() => setCurrentView('register')}
      />
    );
  }

  if (currentView === 'register') {
    return (
      <Register
        onRegister={handleRegister}
        onSwitchToLogin={() => setCurrentView('login')}
      />
    );
  }

  if (currentView === 'dashboard' && user) {
    return (
      <div className="App">
        <header className="app-header">
          <h1>🔒 Secure Messenger</h1>
          <p>Welcome, {user.username}!</p>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </header>

        <main className="app-main">
          <div className="dashboard-container">
            <div className="welcome-card">
              <h2>🎉 Authentication Successful!</h2>
              <p>Your user account has been created and you're ready to proceed.</p>

              <div className="user-info">
                <h3>User Information:</h3>
                <p><strong>Username:</strong> {user.username}</p>
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>Status:</strong> <span className="status-active">Active</span></p>
              </div>

              <KeyManager />

              <div className="next-module">
                <h3>Next Step: Module 4</h3>
                <p>We'll now implement the custom key exchange protocol for secure communication.</p>
                <div className="feature-preview">
                  <h4>Coming in Module 4:</h4>
                  <ul>
                    <li>✅ Elliptic Curve Diffie-Hellman (ECDH) key exchange</li>
                    <li>✅ Digital signatures for authentication</li>
                    <li>✅ Session key derivation using HKDF</li>
                    <li>✅ Key confirmation message flow</li>
                    <li>✅ Complete protocol diagram explanation</li>
                  </ul>
                </div>
              </div>
              <button
                onClick={() => setCurrentView('key-exchange')}
                className="auth-action-button"
                style={{ marginTop: '20px' }}
              >
                🔐 Open Key Exchange Module
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ### Peer Suggested Route for KeyExchange
  if (currentView === 'key-exchange') {
    return <KeyExchange user={user} onBack={() => setCurrentView('dashboard')} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <h1>🔒 Secure Messenger</h1>
        <p>End-to-End Encrypted Messaging & File Sharing</p>
      </header>

      <main className="app-main">
        {/* Rest of status page and features list */}
      </main>
    </div>
  );
}

export default App;
