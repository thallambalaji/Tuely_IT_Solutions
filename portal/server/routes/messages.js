const express = require('express');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/messages/conversations — get all conversations for current user
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', 'fullName profilePhoto role lastSeen')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    return res.json(conversations);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch conversations.' });
  }
});

// POST /api/messages/conversations — start or get a direct conversation
router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { participantId, type = 'direct', groupName } = req.body;
    const participants = type === 'direct'
      ? [req.user._id, participantId]
      : req.body.participants;

    if (type === 'direct') {
      const existing = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [req.user._id, participantId], $size: 2 },
      }).populate('participants', 'fullName profilePhoto role');
      if (existing) return res.json(existing);
    }

    const conversation = await Conversation.create({
      type, participants, groupName, createdBy: req.user._id,
    });
    await conversation.populate('participants', 'fullName profilePhoto role');
    return res.status(201).json(conversation);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create conversation.', error: err.message });
  }
});

// GET /api/messages/:conversationId — get messages for a conversation
router.get('/:conversationId', authenticate, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user._id,
    });
    if (!conversation) return res.status(403).json({ message: 'Access denied.' });

    const messages = await Message.find({ conversationId: req.params.conversationId, isDeleted: false })
      .populate('sender', 'fullName profilePhoto role')
      .sort({ createdAt: 1 })
      .limit(100);

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch messages.' });
  }
});

module.exports = router;
