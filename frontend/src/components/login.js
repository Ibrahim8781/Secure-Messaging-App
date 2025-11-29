import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { authService } from '../services/auth';
import './Auth.css';

const Login = ({ onLogin, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.login(formData);
      
      if (response.data.code === 'LOGIN_SUCCESS') {
        // Store auth data
        authService.setAuthData(response.data.token, response.data.user);
        
        // Notify parent component
        onLogin(response.data.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(
        error.response?.data?.error || 
        'Login failed. Please check your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🔐 Login to Secure Messenger</h2>
        <p className="auth-subtitle">Enter your credentials to continue</p>

        {error && (
          <div className="auth-error">
            <strong>Error:</strong> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your password"
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading || !formData.username || !formData.password}
          >
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            Don't have an account?{' '}
            <button 
              type="button" 
              className="link-button"
              onClick={onSwitchToRegister}
              disabled={loading}
            >
              Register here
            </button>
          </p>
        </div>

        <div className="security-note">
          <h4>🔒 Security Features:</h4>
          <ul>
            <li>Passwords are hashed with bcrypt</li>
            <li>JWT tokens for secure sessions</li>
            <li>No plaintext passwords stored</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;