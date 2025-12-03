const express = require('express');
const router = express.Router();
const SecurityLog = require('../models/SecurityLog');
const authMiddleware = require('../middleware/auth');

// Get all security logs (admin view)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const logs = await SecurityLog.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('userId', 'username')
      .lean();

    res.json({ logs, code: 'LOGS_RETRIEVED' });
  } catch (error) {
    console.error('Log retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

module.exports = router;