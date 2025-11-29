const express = require('express');
const router = express.Router();

router.post('/upload', (req, res) => {
  res.json({ message: 'File upload endpoint - to be implemented' });
});

router.get('/download/:fileId', (req, res) => {
  res.json({ message: 'File download endpoint - to be implemented' });
});

module.exports = router;