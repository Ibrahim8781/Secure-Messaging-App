import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/login';
import Register from './components/register';
import KeyManager from './components/KeyManager';
import KeyExchange from './components/KeyExchange';
import Chat from './components/Chat';
import FileShare from './components/FileShare';
import { authService } from '../src/services/auth';
import { authAPI } from './services/api';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [serverStatus, setServerStatus] = useState('checking');
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [chatContext, setChatContext] = useState(null);

  useEffect(() => {
    checkServerHealth();
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

  // ✅ This function is passed to FileShare and KeyExchange
  const openChat = (recipientId, sessionId) => {
    console.log('✅ Opening chat:', { recipientId, sessionId });
    setChatContext({ recipientId, sessionId });
    setCurrentView('chat');
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

  if (currentView === 'chat' && chatContext) {
    return (
      <Chat
        recipientId={chatContext.recipientId}
        sessionId={chatContext.sessionId}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  if (currentView === 'key-exchange') {
    return (
      <KeyExchange
        user={user}
        onBack={() => setCurrentView('dashboard')}
        onStartChat={openChat}
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
              <h2>🎉 Dashboard</h2>

              <div className="user-info">
                <p><strong>Status:</strong> <span className="status-active">Active</span></p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
                 <button 
                   onClick={() => document.getElementById('tab-keys').scrollIntoView({behavior: 'smooth'})}
                   className="auth-action-button secondary"
                 >
                   Keys
                 </button>
                 <button 
                   onClick={() => setCurrentView('key-exchange')}
                   className="auth-action-button"
                 >
                   New Exchange
                 </button>
                 <button 
                   onClick={() => document.getElementById('tab-files').scrollIntoView({behavior: 'smooth'})}
                   className="auth-action-button secondary"
                 >
                   Files & Chat
                 </button>
              </div>

              <div id="tab-keys">
                <KeyManager />
              </div>

              <hr style={{ margin: '30px 0', border: '0', borderTop: '1px solid #eee' }} />

              <div id="tab-files">
                {/* ✅ Passing openChat here */}
                <FileShare onStartChat={openChat} />
              </div>

            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

export default App;