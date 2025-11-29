import React, { useState } from 'react';
import { authAPI } from '../services/api';
import { authService } from '../services/auth';
import './Auth.css';

const Register = ({ onRegister, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');

  const checkPasswordStrength = (password) => {
    if (password.length === 0) return '';
    if (password.length < 8) return 'weak';
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    
    if (strength >= 4) return 'strong';
    if (strength >= 3) return 'medium';
    return 'weak';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
    setError('');
  };

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 'strong': return { text: 'Strong password', className: 'password-strong' };
      case 'medium': return { text: 'Medium password', className: 'password-medium' };
      case 'weak': return { text: 'Weak password', className: 'password-weak' };
      default: return { text: '', className: '' };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.register({
        username: formData.username,
        password: formData.password
      });

      if (response.data.code === 'REGISTRATION_SUCCESS') {
        // Store auth data
        authService.setAuthData(response.data.token, response.data.user);
        
        // Notify parent component
        onRegister(response.data.user);
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(
        error.response?.data?.error || 
        'Registration failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const passwordStrengthInfo = getPasswordStrengthText();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>🚀 Create Your Account</h2>
        <p className="auth-subtitle">Join the secure messaging platform</p>

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
              placeholder="Choose a username (letters, numbers, _)"
              pattern="[a-zA-Z0-9_]+"
              title="Username can only contain letters, numbers, and underscores"
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
              placeholder="Create a strong password (min 8 characters)"
            />
            {passwordStrength && (
              <div className={`password-strength ${passwordStrengthInfo.className}`}>
                {passwordStrengthInfo.text}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Confirm your password"
            />
          </div>

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading || !formData.username || !formData.password || !formData.confirmPassword}
          >
            {loading ? (
              <>
                <div className="loading-spinner-small"></div>
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            Already have an account?{' '}
            <button 
              type="button" 
              className="link-button"
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Login here
            </button>
          </p>
        </div>

        <div className="security-note">
          <h4>🔒 Your Security Matters:</h4>
          <ul>
            <li>Passwords are hashed with bcrypt (salt + hash)</li>
            <li>No plaintext passwords stored on server</li>
            <li>Secure JWT token authentication</li>
            <li>End-to-end encryption ready (next module)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Register;