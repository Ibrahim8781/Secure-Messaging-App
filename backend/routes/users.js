const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get user public key
router.get('/:userId/public-key', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      userId: user._id,
      username: user.username,
      publicKey: user.publicKey,
      keyInfo: user.keyInfo,
      code: 'PUBLIC_KEY_RETRIEVED'
    });
  } catch (error) {
    console.error('Public key retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve public key',
      code: 'PUBLIC_KEY_ERROR'
    });
  }
});

// Update user public key (for key generation in next module)
router.put('/public-key', authMiddleware, async (req, res) => {
  try {
    const { publicKey, keyInfo } = req.body;

    if (!publicKey) {
      return res.status(400).json({ 
        error: 'Public key is required',
        code: 'MISSING_PUBLIC_KEY'
      });
    }

    const user = await User.findById(req.user._id);
    user.publicKey = publicKey;
    if (keyInfo) {
      user.keyInfo = { ...user.keyInfo, ...keyInfo };
    }
    
    await user.save();

    res.json({
      message: 'Public key updated successfully',
      code: 'PUBLIC_KEY_UPDATED'
    });
  } catch (error) {
    console.error('Public key update error:', error);
    res.status(500).json({ 
      error: 'Failed to update public key',
      code: 'PUBLIC_KEY_UPDATE_ERROR'
    });
  }
});

// Search users by username
router.get('/search/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.length < 2) {
      return res.status(400).json({ 
        error: 'Search term must be at least 2 characters',
        code: 'SEARCH_TERM_TOO_SHORT'
      });
    }

    const users = await User.find({
      username: { $regex: username, $options: 'i' },
      _id: { $ne: req.user._id } // Exclude current user
    }).select('username publicKey keyInfo');

    res.json({
      users,
      count: users.length,
      code: 'USERS_FOUND'
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      code: 'SEARCH_FAILED'
    });
  }
});

module.exports = router;