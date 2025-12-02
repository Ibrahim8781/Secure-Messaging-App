
const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const authMiddleware = require('../middleware/auth');

// Size limit constants
const MAX_MESSAGE_SIZE = 256 * 1024; // 256 KiB

// Send encrypted message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { to, sessionId, ciphertext, iv, messageType, fileMetadata } = req.body;
    const from = req.user._id;

    // Validation
    if (!to || !sessionId || !ciphertext || !iv) {
      return res.status(400).json({
        error: 'Missing required fields: to, sessionId, ciphertext, iv',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate base64 encoding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(ciphertext) || !base64Regex.test(iv)) {
      return res.status(400).json({
        error: 'Invalid base64 encoding',
        code: 'INVALID_ENCODING'
      });
    }

    // Size validation
    const estimatedSize = ciphertext.length + iv.length;
    if (estimatedSize > MAX_MESSAGE_SIZE) {
      return res.status(400).json({
        error: 'Message exceeds maximum size of 256 KiB',
        code: 'MESSAGE_TOO_LARGE'
      });
    }

    // Validate IV length (12 bytes base64 encoded = 16 characters)
    const ivBuffer = Buffer.from(iv, 'base64');
    if (ivBuffer.length !== 12) {
      return res.status(400).json({
        error: 'Invalid IV length. Must be 12 bytes (96 bits)',
        code: 'INVALID_IV_LENGTH'
      });
    }

    // Create message record
    const message = new Message({
      from,
      to,
      sessionId,
      ciphertext,
      iv,
      messageType: messageType || 'text',
      fileMetadata: messageType === 'file' ? fileMetadata : undefined,
      timestamp: new Date()
    });

    await message.save();

    res.status(201).json({
      message: 'Message sent successfully',
      messageId: message._id,
      timestamp: message.timestamp,
      code: 'MESSAGE_SENT'
    });

  } catch (error) {
    console.error('Message send error:', error);
    
    if (error.message.includes('exceeds maximum size')) {
      return res.status(400).json({
        error: error.message,
        code: 'MESSAGE_TOO_LARGE'
      });
    }

    res.status(500).json({
      error: 'Failed to send message',
      code: 'SEND_FAILED'
    });
  }
});

// Get messages for a conversation
router.get('/conversation/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const { limit = 50, before } = req.query;

    // Build query for messages between current user and specified user
    const query = {
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId }
      ]
    };

    // Add timestamp filter if 'before' is specified (for pagination)
    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('from', 'username')
      .populate('to', 'username')
      .lean();

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    res.json({
      messages: messages.map(msg => ({
        id: msg._id,
        from: msg.from,
        to: msg.to,
        sessionId: msg.sessionId,
        ciphertext: msg.ciphertext,
        iv: msg.iv,
        timestamp: msg.timestamp,
        messageType: msg.messageType,
        fileMetadata: msg.fileMetadata
      })),
      count: messages.length,
      hasMore: messages.length === parseInt(limit),
      code: 'MESSAGES_RETRIEVED'
    });

  } catch (error) {
    console.error('Message retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve messages',
      code: 'RETRIEVAL_FAILED'
    });
  }
});

// Get recent conversations list
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate to get latest message per conversation partner
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: userId },
            { to: userId }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$from', userId] },
              '$to',
              '$from'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$to', userId] },
                  // In real app, track read status
                ] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      },
      {
        $limit: 20
      }
    ]);

    // Populate user details
    await Message.populate(conversations, {
      path: 'lastMessage.from lastMessage.to',
      select: 'username'
    });

    res.json({
      conversations: conversations.map(conv => ({
        userId: conv._id,
        lastMessage: {
          timestamp: conv.lastMessage.timestamp,
          from: conv.lastMessage.from,
          to: conv.lastMessage.to,
          messageType: conv.lastMessage.messageType
        },
        unreadCount: conv.unreadCount
      })),
      code: 'CONVERSATIONS_RETRIEVED'
    });

  } catch (error) {
    console.error('Conversations retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversations',
      code: 'RETRIEVAL_FAILED'
    });
  }
});

// Delete message (sender only)
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: messageId,
      from: userId // Only sender can delete
    });

    if (!message) {
      return res.status(404).json({
        error: 'Message not found or unauthorized',
        code: 'MESSAGE_NOT_FOUND'
      });
    }

    await message.deleteOne();

    res.json({
      message: 'Message deleted successfully',
      code: 'MESSAGE_DELETED'
    });

  } catch (error) {
    console.error('Message deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete message',
      code: 'DELETE_FAILED'
    });
  }
});

module.exports = router;