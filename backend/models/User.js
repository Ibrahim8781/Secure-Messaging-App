const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  // Encryption public key
  publicKey: {
    type: String,
    required: false // Will be set after client-side key generation
  },
  // Signing public key (NEW)
  signingPublicKey: {
    type: String,
    required: false
  },
  // Encryption key info (RSA-OAEP)
  keyInfo: {
    algorithm: { type: String, default: 'RSA-OAEP' },
    modulusLength: { type: Number, default: 2048 },
    hash: { type: String, default: 'SHA-256' },
    publicExponent: { type: Array, default: [1, 0, 1] },
    keyUsages: { type: Array, default: ['encrypt', 'wrapKey'] }
  },
  // Signing key info (NEW - RSA-PSS)
  signingKeyInfo: {
    algorithm: { type: String, default: 'RSA-PSS' },
    modulusLength: { type: Number, default: 2048 },
    hash: { type: String, default: 'SHA-256' },
    publicExponent: { type: Array, default: [1, 0, 1] },
    keyUsages: { type: Array, default: ['verify'] }
  },
  keyGeneratedAt: {
    type: Date,
    default: null
  },
  keyFingerprint: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);