const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const KeyExchange = require('../models/KeyExchange');
const authMiddleware = require('../middleware/auth');
const backendCrypto = require('../utils/crypto');

const MAX_MESSAGE_SIZE = 256 * 1024; // 256 KiB

// ✅ POST Route: Send encrypted message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      to, sessionId, ciphertext, iv, messageType, fileMetadata,
      sequenceNumber, nonce, timestamp 
    } = req.body;
    const from = req.user._id;

    // 1. Basic Validation
    if (!to || !sessionId || !ciphertext || !iv) {
      return res.status(400).json({ error: 'Missing fields', code: 'MISSING_FIELDS' });
    }

    // 2. Replay Protection (Module 7)
    if (sequenceNumber === undefined || !nonce || !timestamp) {
      return res.status(400).json({ error: 'Missing security fields', code: 'SECURITY_ERROR' });
    }

    // 3. Timestamp Check (5 mins)
    if (!backendCrypto.validateTimestamp(timestamp)) {
      return res.status(400).json({ error: 'Timestamp expired', code: 'REPLAY_DETECTED' });
    }

    // 4. Sequence Check
    const session = await KeyExchange.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let expectedSeq = 0;
    let isInitiator = false;

    if (session.initiatorId.toString() === from.toString()) {
      expectedSeq = session.initiatorLastSequence + 1;
      isInitiator = true;
    } else if (session.responderId.toString() === from.toString()) {
      expectedSeq = session.responderLastSequence + 1;
      isInitiator = false;
    } else {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (sequenceNumber !== expectedSeq) {
      console.warn(`[SECURITY] Replay/Order mismatch. Expected ${expectedSeq}, got ${sequenceNumber}`);
      return res.status(409).json({ error: 'Message out of sequence', code: 'REPLAY_DETECTED' });
    }

    // 5. Update Sequence
    if (isInitiator) session.initiatorLastSequence = sequenceNumber;
    else session.responderLastSequence = sequenceNumber;
    await session.save();

    // 6. Save Message
    const message = new Message({
      from, to, sessionId, ciphertext, iv,
      messageType: messageType || 'text',
      fileMetadata: messageType === 'file' ? fileMetadata : undefined,
      timestamp: new Date()
    });

    await message.save();

    res.status(201).json({
      message: 'Sent',
      messageId: message._id,
      timestamp: message.timestamp
    });

  } catch (error) {
    console.error('Send error:', error);
    res.status(500).json({ error: 'Send failed' });
  }
});

// GET Route: Fetch messages
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const { limit = 50 } = req.query;

    const messages = await Message.find({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId }
      ]
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate('from', 'username')
    .populate('to', 'username')
    .lean();

    res.json({ messages: messages.reverse(), code: 'MESSAGES_RETRIEVED' });
  } catch (error) {
    res.status(500).json({ error: 'Retrieval failed' });
  }
});

module.exports = router;