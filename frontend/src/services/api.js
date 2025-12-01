import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  verifyToken: () => api.get('/auth/verify'),
};

// Users API calls
export const usersAPI = {
  getPublicKey: (userId) => api.get(`/users/${userId}/public-key`),
  updatePublicKey: (publicKeyData) => api.put('/users/public-key', publicKeyData),
  searchUsers: (username) => api.get(`/users/search/${username}`),
};

// Key Exchange API calls (ADD THIS)
export const keyExchangeAPI = {
  initiate: (data) => api.post('/keys/exchange/initiate', data),
  respond: (data) => api.post('/keys/exchange/respond', data),
  confirm: (data) => api.post('/keys/exchange/confirm', data),
  getStatus: (sessionId) => api.get(`/keys/exchange/status/${sessionId}`),
  getSession: (sessionId) => api.get(`/keys/exchange/session/${sessionId}`),
  getPending: () => api.get('/keys/exchange/pending'),
};
export default api;