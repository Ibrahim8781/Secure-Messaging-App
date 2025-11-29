import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/login';
import Register from './components/register';
import KeyManager from './components/KeyManager';
import { authService } from './services/auth';
import { authAPI } from './services/api';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [cryptoSupport, setCryptoSupport] = useState({ webCrypto: false, indexedDB: false });
  const [currentView, setCurrentView] = useState('status'); // 'status', 'login', 'register', 'dashboard'
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if server is running and Web Crypto API is supported
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

  // Show loading while checking authentication
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

  // Show login/register if not authenticated
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

  // Show dashboard if authenticated
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

              {/* Added KeyManager component here */}
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
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show status page (default view)
  return (
    <div className="App">
      <header className="app-header">
        <h1>🔒 Secure Messenger</h1>
        <p>End-to-End Encrypted Messaging & File Sharing</p>
      </header>

      <main className="app-main">
        <div className="status-container">
          <div className="status-card">
            <h2>System Status</h2>
            
            <div className="status-item">
              <span className="status-label">Backend Server:</span>
              <span 
                className="status-value" 
                style={{ color: getStatusColor(serverStatus) }}
              >
                {serverStatus === 'connected' ? '✅ Connected' : 
                  serverStatus === 'checking' ? '🔄 Checking...' : '❌ Disconnected'}
              </span>
            </div>

            <div className="status-item">
              <span className="status-label">Web Crypto API:</span>
              <span className="status-value" style={{ color: cryptoSupport.webCrypto ? '#28a745' : '#dc3545' }}>
                {cryptoSupport.webCrypto ? '✅ Supported' : '❌ Not Supported'}
              </span>
            </div>

            <div className="status-item">
              <span className="status-label">IndexedDB:</span>
              <span className="status-value" style={{ color: cryptoSupport.indexedDB ? '#28a745' : '#dc3545' }}>
                {cryptoSupport.indexedDB ? '✅ Supported' : '❌ Not Supported'}
              </span>
            </div>
          </div>

          {!cryptoSupport.webCrypto && (
            <div className="security-warning">
              <strong>Warning:</strong> Your browser doesn't support Web Crypto API. 
              This app requires a modern browser for encryption operations.
            </div>
          )}

          {serverStatus === 'error' && (
            <div className="security-warning">
              <strong>Backend Connection Failed:</strong> Make sure the backend server is running on port 5000.
            </div>
          )}

          {cryptoSupport.webCrypto && cryptoSupport.indexedDB && serverStatus === 'connected' && (
            <div className="security-success">
              <strong>All Systems Ready!</strong> Your environment supports all required security features.
              <div style={{ marginTop: '10px' }}>
                <button 
                  onClick={() => setCurrentView('login')}
                  className="auth-action-button"
                >
                  Proceed to Login
                </button>
                <button 
                  onClick={() => setCurrentView('register')}
                  className="auth-action-button secondary"
                >
                  Create New Account
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="features-list">
          <h3>Project Features:</h3>
          <ul>
            <li>✅ User Authentication (Module 2 - Current)</li>
            <li>✅ Client-Side Key Generation & Storage (Module 3 - Completed)</li>
            <li>🔲 Custom Key Exchange Protocol</li>
            <li>🔲 End-to-End Message Encryption</li>
            <li>🔲 Encrypted File Sharing</li>
            <li>🔲 Attack Protection & Demonstration</li>
            <li>🔲 Security Logging & Auditing</li>
          </ul>
        </div>

        <div className="next-steps">
          <h3>Module 2: User Authentication System</h3>
          <p>This module implements secure user registration and login with password hashing and JWT tokens.</p>
          <div className="module-features">
            <h4>Implemented Features:</h4>
            <ul>
              <li>✅ Secure password hashing with bcrypt</li>
              <li>✅ JWT token authentication</li>
              <li>✅ User registration with validation</li>
              <li>✅ Password strength checking</li>
              <li>✅ Protected routes middleware</li>
              <li>✅ Error handling and security codes</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;