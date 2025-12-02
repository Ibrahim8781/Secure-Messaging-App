const mongoose = require('mongoose');

const keyExchangeSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  responderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Keys & Nonces
  initiatorEphemeralPublic: { type: String, required: true },
  responderEphemeralPublic: { type: String, default: null },
  initiatorNonce: { type: String, required: true },
  responderNonce: { type: String, default: null },
  
  // Signatures
  initiatorSignature: { type: String, required: true },
  responderSignature: { type: String, default: null },
  initiatorConfirmation: { type: String, default: null },
  responderConfirmation: { type: String, default: null },

  // ✅ MODULE 7: Replay Protection Counters
  initiatorLastSequence: { type: Number, default: 0 },
  responderLastSequence: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['initiated', 'responded', 'confirmed', 'completed', 'failed'],
    default: 'initiated'
  },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60 * 1000) }, // 5 mins
  createdAt: { type: Date, default: Date.now }
});

keyExchangeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('KeyExchange', keyExchangeSchema);