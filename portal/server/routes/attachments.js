const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticate = require('../middleware/authenticate');
const Attachment = require('../models/Attachment');
const Message = require('../models/Message');
const GroupMessage = require('../models/GroupMessage');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');

const router = express.Router();

const uploadsBase = path.join(__dirname, '../uploads');
const attachDir = path.join(uploadsBase, 'attachments');
if (!fs.existsSync(attachDir)) {
  fs.mkdirSync(attachDir, { recursive: true });
}

// Multer Storage Configuration
const attachStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, attachDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanOriginal = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${req.user._id}_${Date.now()}_${cleanOriginal}`);
  },
});

// Multer Upload Configuration with strict 10MB limit and whitelists
const uploadAttachment = multer({
  storage: attachStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // 1. Whitelist extension checks
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.pdf', '.xml', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.docx', '.xlsx'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Unsupported file extension. Only PDF, XML, JPG, JPEG, PNG, MP3, WAV, DOCX, XLSX are allowed.'));
    }

    // 2. Whitelist MIME checks
    const allowedMime = [
      'application/pdf',
      'application/xml',
      'text/xml',
      'image/jpeg',
      'image/png',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported MIME type. Only PDF, XML, JPG, JPEG, PNG, MP3, WAV, DOCX, XLSX are allowed.'));
    }
  }
});

/**
 * POST /api/attachments/upload
 * Handles attachment upload, validates request, updates database with metadata and message,
 * and emits real-time Socket.IO events.
 */
router.post('/upload', authenticate, (req, res, next) => {
  uploadAttachment.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 10MB limit.' });
      }
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { conversationId, groupId, isGroup } = req.body;
    const isGroupChat = isGroup === 'true';

    let receiverId = null;
    let channelId = null;
    let groupDocId = null;

    // ── Authorization & Room verification ─────────────────────────
    if (isGroupChat) {
      const group = await Group.findById(groupId);
      if (!group || group.deletedAt) {
        // Delete uploaded file if unauthorized/invalid
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Group not found.' });
      }

      if (req.user.role !== 'hr' && !group.members.some(m => m.equals(req.user._id))) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });
      }
      groupDocId = groupId;
    } else {
      const conv = await Conversation.findById(conversationId);
      if (!conv) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: 'Conversation not found.' });
      }

      if (req.user.role !== 'hr' && !conv.participants.some(p => p.equals(req.user._id))) {
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ message: 'Access denied.' });
      }

      channelId = conversationId;
      const other = conv.participants.find(p => !p.equals(req.user._id));
      receiverId = other ? other : null;
    }

    // Determine clean fileType mapping
    const ext = path.extname(req.file.originalname).toLowerCase();
    let fileType = 'document';
    if (['.jpg', '.jpeg', '.png'].includes(ext)) fileType = 'image';
    else if (ext === '.pdf') fileType = 'pdf';
    else if (['.mp3', '.wav'].includes(ext)) fileType = 'audio';
    else if (ext === '.xml') fileType = 'xml';

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days TTL

    // ── Create Attachment document ──────────────────────────────────
    const attachment = await Attachment.create({
      senderId: req.user._id,
      receiverId,
      groupId: groupDocId,
      channelId,
      senderRole: req.user.role,
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
      filePath: req.file.path,
      downloadUrl: `/api/attachments/download/placeholder`, // updated below
      messageType: fileType,
      expiresAt
    });

    const downloadUrl = `/api/attachments/download/${attachment._id}`;
    attachment.downloadUrl = downloadUrl;
    await attachment.save();

    let createdMessage = null;
    const io = req.app.get('io');

    // ── Create Message / GroupMessage document & emit sockets ───────
    if (isGroupChat) {
      const groupMessage = await GroupMessage.create({
        groupId,
        senderId: req.user._id,
        message: `Shared an attachment: ${req.file.originalname}`,
        messageType: fileType,
        attachmentUrl: downloadUrl,
        attachmentName: req.file.originalname,
        attachmentId: attachment._id,
        seenBy: [req.user._id],
        deliveredTo: [req.user._id],
        expiresAt
      });

      await groupMessage.populate('senderId', 'fullName firstName lastName profilePhoto role');
      createdMessage = groupMessage;

      // Broadcast Socket events
      io.to(`group_${groupId}`).emit('receive_group_message', { message: groupMessage, groupId });
      io.to(`group_${groupId}`).emit('receive_attachment', { attachment, groupId });
    } else {
      const message = await Message.create({
        conversationId,
        sender: req.user._id,
        content: `Shared an attachment: ${req.file.originalname}`,
        type: fileType,
        attachmentUrl: downloadUrl,
        attachmentName: req.file.originalname,
        attachmentId: attachment._id,
        readBy: [req.user._id],
        expiresAt
      });

      await message.populate('sender', 'fullName firstName lastName profilePhoto role');
      createdMessage = message;

      // Update Conversation lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        updatedAt: new Date()
      });

      // Broadcast Socket events
      io.to(conversationId).emit('receive_message', { message });
      io.to(conversationId).emit('receive_attachment', { attachment, conversationId });
    }

    return res.json({
      success: true,
      message: createdMessage,
      attachment
    });
  } catch (err) {
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return res.status(500).json({ message: 'Attachment upload failed.', error: err.message });
  }
});

/**
 * GET /api/attachments/download/:id
 * Secure download endpoint verifying user permissions and fetching original files.
 */
router.get('/download/:id', authenticate, async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment expired.' });
    }

    // Check if expired in memory (before TTL thread runs)
    if (attachment.expiresAt && new Date() > new Date(attachment.expiresAt)) {
      return res.status(410).json({ message: 'Attachment expired.' });
    }

    // ── Authorization checks ──────────────────────────────────────
    let isAuthorized = req.user.role === 'hr' || attachment.senderId.equals(req.user._id);

    if (!isAuthorized) {
      if (attachment.groupId) {
        const group = await Group.findById(attachment.groupId);
        if (group && group.members.some(m => m.equals(req.user._id))) {
          isAuthorized = true;
        }
      } else if (attachment.channelId) {
        const conv = await Conversation.findById(attachment.channelId);
        if (conv && conv.participants.some(p => p.equals(req.user._id))) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You do not have permission to access this file.' });
    }

    if (!fs.existsSync(attachment.filePath)) {
      return res.status(404).json({ message: 'File no longer exists.' });
    }

    // Emit attachment_downloaded event to room
    const io = req.app.get('io');
    const roomId = attachment.groupId ? `group_${attachment.groupId}` : attachment.channelId;
    if (roomId) {
      io.to(roomId.toString()).emit('attachment_downloaded', {
        attachmentId: attachment._id,
        userId: req.user._id,
        userName: req.user.fullName
      });
    }

    // Trigger download with original filename preserved
    return res.download(attachment.filePath, attachment.originalFileName);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to retrieve file.', error: err.message });
  }
});

module.exports = router;
