const express = require('express');
const router = express.Router();

router.post('/exchange', (req, res) => {
  res.json({ message: 'Key exchange endpoint - to be implemented' });
});

module.exports = router;