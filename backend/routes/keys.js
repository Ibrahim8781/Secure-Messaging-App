const express = require('express');
const router = express.Router();
const KeyExchange = require('../models/KeyExchange');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const backendCrypto = require('../utils/crypto');

// Initiate key exchange
router.post('/exchange/initiate', authMiddleware, async (req, res) => {
  try {
    const { responderId, ephemeralPublic, nonce, timestamp, signature } = req.body;
    const initiatorId = req.user._id;

    // Validation
    if (!responderId || !ephemeralPublic || !nonce || !timestamp || !signature) {
      backendCrypto.logSecurityEvent('KEY_EXCHANGE_INIT_FAILED', null, initiatorId, {
        reason: 'Missing required fields'
      });
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    // Validate timestamp (5-minute window)
    if (!backendCrypto.validateTimestamp(parseInt(timestamp))) {
      backendCrypto.logSecurityEvent('KEY_EXCHANGE_INIT_FAILED', null, initiatorId, {
        reason: 'Timestamp outside valid window'
      });
      return res.status(400).json({ error: 'Timestamp expired', code: 'TIMESTAMP_EXPIRED' });
    }

    // Check if responder exists and has signing key
    const responder = await User.findById(responderId);
    if (!responder) {
      return res.status(404).json({ error: 'Responder not found', code: 'USER_NOT_FOUND' });
    }
    if (!responder.signingPublicKey) {
      return res.status(400).json({ 
        error: 'Responder has not generated signing keys', 
        code: 'NO_SIGNING_KEY' 
      });
    }

    // Get initiator's signing public key
    const initiator = await User.findById(initiatorId);
    if (!initiator.signingPublicKey) {
      return res.status(400).json({ 
        error: 'You must generate signing keys first', 
        code: 'NO_SIGNING_KEY' 
      });
    }

    // Verify signature
    const signatureData = JSON.stringify({
      responderId,
      ephemeralPublic,
      nonce,
      timestamp,
      type: 'key_exchange_init'
    });

    const signingPublicKeyPEM = backendCrypto.base64ToPEM(initiator.signingPublicKey);
    const isValidSignature = backendCrypto.verifySignature(
      signingPublicKeyPEM,
      signature,
      signatureData
    );

    if (!isValidSignature) {
      backendCrypto.logSecurityEvent('SIGNATURE_VERIFICATION_FAILED', null, initiatorId, {
        reason: 'Invalid initiator signature',
        responderId
      });
      return res.status(401).json({ 
        error: 'Invalid signature', 
        code: 'INVALID_SIGNATURE' 
      });
    }

    // Create session ID
    const sessionId = `${initiatorId}_${responderId}_${Date.now()}`;

    // Create key exchange record
    const keyExchange = new KeyExchange({
      sessionId,
      initiatorId,
      responderId,
      initiatorEphemeralPublic: ephemeralPublic,
      initiatorNonce: nonce,
      initiatorSignature: signature,
      status: 'initiated',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });

    await keyExchange.save();

    backendCrypto.logSecurityEvent('KEY_EXCHANGE_INITIATED', sessionId, initiatorId, {
      responderId,
      signatureValid: true
    });

    res.status(201).json({
      message: 'Key exchange initiated successfully',
      sessionId,
      code: 'EXCHANGE_INITIATED'
    });

  } catch (error) {
    console.error('Key exchange initiation error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate key exchange', 
      code: 'INITIATION_FAILED' 
    });
  }
});

// Respond to key exchange
router.post('/exchange/respond', authMiddleware, async (req, res) => {
  try {
    const { sessionId, ephemeralPublic, nonce, timestamp, signature } = req.body;
    const responderId = req.user._id;

    // Validation
    if (!sessionId || !ephemeralPublic || !nonce || !timestamp || !signature) {
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    // Validate timestamp
    if (!backendCrypto.validateTimestamp(parseInt(timestamp))) {
      backendCrypto.logSecurityEvent('KEY_EXCHANGE_RESPONSE_FAILED', sessionId, responderId, {
        reason: 'Timestamp expired'
      });
      return res.status(400).json({ error: 'Timestamp expired', code: 'TIMESTAMP_EXPIRED' });
    }

    // Find key exchange session
    const session = await KeyExchange.findOne({ sessionId })
      .populate('initiatorId', 'username signingPublicKey')
      .populate('responderId', 'username signingPublicKey');

    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Verify responder is correct user
    if (session.responderId._id.toString() !== responderId.toString()) {
      backendCrypto.logSecurityEvent('UNAUTHORIZED_RESPONSE', sessionId, responderId, {
        expectedResponderId: session.responderId._id
      });
      return res.status(403).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Check session status
    if (session.status !== 'initiated') {
      return res.status(400).json({ 
        error: 'Invalid session status', 
        code: 'INVALID_STATUS' 
      });
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      return res.status(400).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    // Get responder's signing public key
    const responder = await User.findById(responderId);
    if (!responder.signingPublicKey) {
      return res.status(400).json({ 
        error: 'You must generate signing keys first', 
        code: 'NO_SIGNING_KEY' 
      });
    }

    // Verify signature
    const signatureData = JSON.stringify({
      sessionId,
      ephemeralPublic,
      nonce,
      timestamp,
      type: 'key_exchange_response'
    });

    const signingPublicKeyPEM = backendCrypto.base64ToPEM(responder.signingPublicKey);
    const isValidSignature = backendCrypto.verifySignature(
      signingPublicKeyPEM,
      signature,
      signatureData
    );

    if (!isValidSignature) {
      backendCrypto.logSecurityEvent('SIGNATURE_VERIFICATION_FAILED', sessionId, responderId, {
        reason: 'Invalid responder signature'
      });
      return res.status(401).json({ 
        error: 'Invalid signature', 
        code: 'INVALID_SIGNATURE' 
      });
    }

    // Update session
    session.responderEphemeralPublic = ephemeralPublic;
    session.responderNonce = nonce;
    session.responderSignature = signature;
    session.status = 'responded';
    await session.save();

    backendCrypto.logSecurityEvent('KEY_EXCHANGE_RESPONDED', sessionId, responderId, {
      initiatorId: session.initiatorId._id,
      signatureValid: true
    });

    res.json({
      message: 'Response recorded successfully',
      sessionId,
      initiatorPublicKey: session.initiatorId.publicKey,
      code: 'RESPONSE_RECORDED'
    });

  } catch (error) {
    console.error('Key exchange response error:', error);
    res.status(500).json({ 
      error: 'Failed to respond to key exchange', 
      code: 'RESPONSE_FAILED' 
    });
  }
});

// Confirm key exchange
router.post('/exchange/confirm', authMiddleware, async (req, res) => {
  try {
    const { sessionId, confirmation, isInitiator } = req.body;
    const userId = req.user._id;

    // Validation
    if (!sessionId || !confirmation || isInitiator === undefined) {
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    // Find session
    const session = await KeyExchange.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Verify user authorization
    const expectedUserId = isInitiator ? session.initiatorId : session.responderId;
    if (expectedUserId.toString() !== userId.toString()) {
      backendCrypto.logSecurityEvent('UNAUTHORIZED_CONFIRMATION', sessionId, userId, {
        expectedUserId
      });
      return res.status(403).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    // Update confirmation
    if (isInitiator) {
      session.initiatorConfirmation = confirmation;
      
      // If responder already confirmed, mark as completed
      if (session.responderConfirmation) {
        session.status = 'completed';
        session.completedAt = new Date();
      } else {
        session.status = 'confirmed';
      }
    } else {
      session.responderConfirmation = confirmation;
      
      // If initiator already confirmed, mark as completed
      if (session.initiatorConfirmation) {
        session.status = 'completed';
        session.completedAt = new Date();
      } else {
        session.status = 'confirmed';
      }
    }

    await session.save();

    backendCrypto.logSecurityEvent('KEY_CONFIRMATION_RECEIVED', sessionId, userId, {
      isInitiator,
      status: session.status
    });

    res.json({
      message: 'Confirmation recorded',
      sessionId,
      status: session.status,
      code: 'CONFIRMATION_RECORDED'
    });

  } catch (error) {
    console.error('Key confirmation error:', error);
    res.status(500).json({ 
      error: 'Failed to confirm key exchange', 
      code: 'CONFIRMATION_FAILED' 
    });
  }
});

// Get session status
router.get('/exchange/status/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await KeyExchange.findOne({ sessionId })
      .populate('initiatorId', 'username')
      .populate('responderId', 'username');

    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Verify user is part of this exchange
    if (session.initiatorId._id.toString() !== userId.toString() && 
        session.responderId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      initiator: session.initiatorId.username,
      responder: session.responderId.username,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      completedAt: session.completedAt,
      code: 'STATUS_RETRIEVED'
    });

  } catch (error) {
    console.error('Status retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to get status', 
      code: 'STATUS_FAILED' 
    });
  }
});

// Get session details (for completing exchange)
router.get('/exchange/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const session = await KeyExchange.findOne({ sessionId })
      .populate('initiatorId', 'username publicKey signingPublicKey')
      .populate('responderId', 'username publicKey signingPublicKey');

    if (!session) {
      return res.status(404).json({ error: 'Session not found', code: 'SESSION_NOT_FOUND' });
    }

    // Verify user is part of this exchange
    if (session.initiatorId._id.toString() !== userId.toString() && 
        session.responderId._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    res.json({
      session: {
        sessionId: session.sessionId,
        status: session.status,
        initiatorId: session.initiatorId,
        responderId: session.responderId,
        initiatorEphemeralPublic: session.initiatorEphemeralPublic,
        responderEphemeralPublic: session.responderEphemeralPublic,
        initiatorNonce: session.initiatorNonce,
        responderNonce: session.responderNonce,
        // ✅ ADD THESE TWO LINES:
        initiatorConfirmation: session.initiatorConfirmation, 
        responderConfirmation: session.responderConfirmation,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      },
      code: 'SESSION_RETRIEVED'
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to get session', 
      code: 'SESSION_RETRIEVAL_FAILED' 
    });
  }
});

// Get pending exchanges for current user
router.get('/exchange/pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const pendingExchanges = await KeyExchange.find({
      responderId: userId,
      status: 'initiated',
      expiresAt: { $gt: new Date() }
    })
    .populate('initiatorId', 'username')
    .sort({ createdAt: -1 });

    res.json({
      exchanges: pendingExchanges,
      count: pendingExchanges.length,
      code: 'PENDING_RETRIEVED'
    });

  } catch (error) {
    console.error('Pending exchanges retrieval error:', error);
    res.status(500).json({ 
      error: 'Failed to get pending exchanges', 
      code: 'PENDING_FAILED' 
    });
  }
});
// =========================================================
// VULNERABLE ROUTES (FOR DEMO ONLY - COPY THIS EXACTLY)
// =========================================================

// Vulnerable Initiate (No Signature Check)
router.post('/exchange/initiate-vulnerable', authMiddleware, async (req, res) => {
  try {
    const { responderId, ephemeralPublic, nonce, timestamp } = req.body; 
    const initiatorId = req.user._id;

    // Create session ID with VULN tag
    const sessionId = `${initiatorId}_${responderId}_${Date.now()}_VULN`;

    // Create key exchange record WITHOUT verifying signature
    const KeyExchange = require('../models/KeyExchange'); // Ensure model is imported
    const keyExchange = new KeyExchange({
      sessionId,
      initiatorId,
      responderId,
      initiatorEphemeralPublic: ephemeralPublic,
      initiatorNonce: nonce,
      initiatorSignature: "skipped_for_demo", 
      status: 'initiated'
    });

    await keyExchange.save();

    res.status(201).json({
      message: 'VULNERABLE Exchange initiated',
      sessionId,
      code: 'EXCHANGE_INITIATED'
    });
  } catch (error) {
    console.error("Vuln Init Error:", error);
    res.status(500).json({ error: 'Vulnerable init failed' });
  }
});

// Vulnerable Respond (No Signature Check)
router.post('/exchange/respond-vulnerable', authMiddleware, async (req, res) => {
  try {
    const { sessionId, ephemeralPublic, nonce } = req.body;
    const KeyExchange = require('../models/KeyExchange'); // Ensure model is imported
    
    const session = await KeyExchange.findOne({ sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Update session WITHOUT verifying signature
    session.responderEphemeralPublic = ephemeralPublic;
    session.responderNonce = nonce;
    session.responderSignature = "skipped_for_demo";
    session.status = 'responded';
    await session.save();

    res.json({
      message: 'VULNERABLE Response recorded',
      sessionId,
      // In a real attack, the attacker would capture the initiator's key here
      initiatorPublicKey: session.initiatorEphemeralPublic, 
      code: 'RESPONSE_RECORDED'
    });
  } catch (error) {
    console.error("Vuln Respond Error:", error);
    res.status(500).json({ error: 'Vulnerable respond failed' });
  }
});
module.exports = router;