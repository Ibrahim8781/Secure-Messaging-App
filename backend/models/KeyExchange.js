const mongoose = require('mongoose');

const keyExchangeSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  initiatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  initiatorEphemeralPublic: {
    type: String, // Base64 encoded
    required: true
  },
  responderEphemeralPublic: {
    type: String, // Base64 encoded
    default: null
  },
  sharedSecret: {
    type: String, // Base64 encoded (for logging only, not used in production)
    default: null
  },
  sessionKey: {
    type: String, // Base64 encoded (for logging only)
    default: null
  },
  initiatorNonce: {
    type: String, // Base64 encoded
    required: true
  },
  responderNonce: {
    type: String, // Base64 encoded
    default: null
  },
  status: {
    type: String,
    enum: ['initiated', 'responded', 'confirmed', 'completed', 'failed'],
    default: 'initiated'
  },
  initiatorSignature: {
    type: String, // Base64 encoded
    required: true
  },
  responderSignature: {
    type: String, // Base64 encoded
    default: null
  },
  initiatorConfirmation: {
    type: String, // Base64 encoded
    default: null
  },
  responderConfirmation: {
    type: String, // Base64 encoded
    default: null
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

// Index for cleanup
keyExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('KeyExchange', keyExchangeSchema);