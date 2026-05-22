const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const GroupMessage = require('../models/GroupMessage');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// ── Multer for attachments ──────────────────────────────────────
const uploadsBase = path.join(__dirname, '../uploads');
const attachDir = path.join(uploadsBase, 'attachments');
if (!fs.existsSync(attachDir)) fs.mkdirSync(attachDir, { recursive: true });

const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, attachDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}_${Date.now()}${ext}`);
  },
});
const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images (JPG, PNG, WEBP) and PDFs are allowed as attachments.'));
  },
});

// GET /api/messages/conversations — own conversations (all roles)
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const query = { participants: req.user._id };

    const conversations = await Conversation.find(query)
      .populate('participants', 'fullName firstName lastName profilePhoto designation department lastSeen')
      .populate({ path: 'lastMessage', select: 'content type createdAt' })
      .sort({ updatedAt: -1 });

    return res.json(conversations);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch conversations.' });
  }
});

// POST /api/messages/conversations — start or get direct/group conversation
router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { type, participantId, groupName, participants } = req.body;

    if (type === 'direct') {
      // Find existing or create
      let conv = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, participantId], $size: 2 },
      }).populate('participants', 'fullName firstName lastName profilePhoto designation department lastSeen');

      if (!conv) {
        conv = await Conversation.create({
          type: 'direct',
          participants: [req.user._id, participantId],
        });
        conv = await conv.populate('participants', 'fullName firstName lastName profilePhoto designation department lastSeen');
      }
      return res.json(conv);
    }

    if (type === 'group') {
      if (req.user.role !== 'hr') {
        return res.status(403).json({ message: 'Only HR can create group conversations.' });
      }
      const conv = await Conversation.create({
        type: 'group',
        groupName,
        participants,
        createdBy: req.user._id,
      });
      await conv.populate('participants', 'fullName firstName lastName profilePhoto');
      return res.json(conv);
    }

    return res.status(400).json({ message: 'Invalid conversation type.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create conversation.', error: err.message });
  }
});

// GET /api/messages/:conversationId — messages with pagination
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ message: 'Conversation not found.' });

    // HR can read any; employees only their own
    if (req.user.role !== 'hr' && !conv.participants.some(p => p.equals(req.user._id))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const messages = await Message.find({ conversationId: req.params.conversationId, isDeleted: false })
      .populate('sender', 'fullName firstName lastName profilePhoto role')
      .populate('attachmentId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.json(messages.reverse()); // chronological order
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch messages.' });
  }
});

// GET /api/messages/monitor — HR only: list all conversations for monitoring
router.get('/monitor/all', authenticate, requireHR, async (req, res) => {
  try {
    const conversations = await Conversation.find({})
      .populate('participants', 'fullName firstName lastName profilePhoto designation department')
      .populate({ path: 'lastMessage', select: 'content type createdAt sender' })
      .sort({ updatedAt: -1 });
    return res.json(conversations);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch conversations for monitoring.' });
  }
});

// POST /api/messages/attachment — upload attachment
router.post('/attachment', authenticate, (req, res, next) => {
  uploadAttachment.single('file')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const isImage = req.file.mimetype.startsWith('image/');
    const fileType = isImage ? 'image' : 'pdf';
    const url = `/api/files/attachments/${req.file.filename}`;
    return res.json({ url, filename: req.file.originalname, type: fileType });
  } catch (err) {
    return res.status(500).json({ message: 'Attachment upload failed.', error: err.message });
  }
});

module.exports = router;
