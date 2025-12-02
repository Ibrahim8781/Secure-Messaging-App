const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  filename: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  recipients: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    encryptedKey: {
      type: String, // Base64 wrapped file key
      required: true
    },
    sessionId: {
      type: String,
      required: true
    }
  }],
  chunks: [{
    index: Number,
    ciphertext: String, // Base64
    iv: String // Base64
  }]
});

// Limit document size (MongoDB limit is 16MB)
fileSchema.pre('save', function(next) {
  const size = JSON.stringify(this).length;
  if (size > 16 * 1024 * 1024) {
    return next(new Error('Document exceeds MongoDB 16MB limit'));
  }
  next();
});

module.exports = mongoose.model('File', fileSchema);