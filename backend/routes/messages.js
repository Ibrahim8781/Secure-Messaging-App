const express = require('express');
const router = express.Router();

router.post('/', (req, res) => {
  res.json({ message: 'Send message endpoint - to be implemented' });
});

router.get('/:userId', (req, res) => {
  res.json({ message: 'Get messages endpoint - to be implemented' });
});

module.exports = router;