const express = require('express');
const router = express.Router();
const File = require('../models/File');
const authMiddleware = require('../middleware/auth');

// Upload encrypted file
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const { filename, mimeType, size, recipients, chunks } = req.body;
    const uploader = req.user._id;

    if (!filename || !chunks || !recipients || recipients.length === 0) {
      return res.status(400).json({ error: 'Missing required fields', code: 'MISSING_FIELDS' });
    }

    const fileDoc = new File({
      uploader,
      filename,
      mimeType,
      size,
      recipients,
      chunks
    });

    await fileDoc.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      fileId: fileDoc._id,
      code: 'UPLOAD_SUCCESS'
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      error: error.message.includes('userId') ? 'Recipient User ID missing' : 'Upload failed',
      details: error.message 
    });
  }
});

// List files
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const files = await File.find({
      $or: [{ uploader: userId }, { 'recipients.userId': userId }]
    })
    .select('-chunks') // Exclude chunks to keep list light
    .populate('uploader', 'username')
    .sort({ uploadedAt: -1 })
    .lean();

    const fileList = files.map(f => ({
      id: f._id,
      filename: f.filename,
      size: f.size,
      mimeType: f.mimeType,
      uploadedAt: f.uploadedAt,
      uploader: f.uploader.username,
      isSender: f.uploader._id.toString() === userId.toString()
    }));

    res.json({ files: fileList });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Download file
router.get('/download/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Access control
    const userId = req.user._id.toString();
    const isRecipient = file.recipients.some(r => r.userId.toString() === userId);
    const isUploader = file.uploader.toString() === userId;

    if (!isRecipient && !isUploader) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ file });
  } catch (error) {
    res.status(500).json({ error: 'Download failed' });
  }
});

module.exports = router;