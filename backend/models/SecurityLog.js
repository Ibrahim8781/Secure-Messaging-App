const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('SecurityLog', securityLogSchema);