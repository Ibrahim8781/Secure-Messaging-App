const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  ciphertext: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'file'],
    default: 'text'
  },
  fileMetadata: {
    filename: String,
    size: Number,
    mimeType: String
  }
});

// Compound indexes for efficient queries
messageSchema.index({ to: 1, timestamp: -1 });
messageSchema.index({ from: 1, timestamp: -1 });
messageSchema.index({ sessionId: 1, timestamp: -1 });

// Size validation
messageSchema.pre('save', function(next) {
  const MAX_SIZE = 256 * 1024;
  const estimatedSize = this.ciphertext.length + this.iv.length;
  
  if (estimatedSize > MAX_SIZE) {
    return next(new Error('Message exceeds maximum size of 256 KiB'));
  }
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);