const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const https = require('https');
const http = require('http');
require('dotenv').config();

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100 
});

if (process.env.NODE_ENV === 'production') {
  app.use(limiter);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/secure_messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Secure Messaging API is running', timestamp: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/files', require('./routes/files'));
app.use('/api/keys', require('./routes/keys'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 5000;

// HTTPS Setup with Fallback
let server;
try {
  if (fs.existsSync('server.key') && fs.existsSync('server.cert')) {
    const httpsOptions = {
      key: fs.readFileSync('server.key'),
      cert: fs.readFileSync('server.cert')
    };
    server = https.createServer(httpsOptions, app);
    console.log('🔒 HTTPS Enabled');
  } else {
    throw new Error('Certificates not found');
  }
} catch (e) {
  console.log('⚠️ SSL Certificates not found or invalid. Falling back to HTTP.');
  server = http.createServer(app);
}

server.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});