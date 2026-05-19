const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * socketHandler.js
 * Manages all real-time Socket.IO connections.
 * Authenticates via JWT cookie on every connection.
 */
const socketHandler = (io) => {
  // Middleware: authenticate socket connection via JWT cookie
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.cookie
        ?.split(';')
        .find(c => c.trim().startsWith('token='))
        ?.split('=')[1];

      if (!token) return next(new Error('Authentication required.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found.'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`✅ Socket connected: ${socket.user.fullName} (${socket.user.role})`);

    // Join personal room (for direct notifications)
    socket.join(userId);

    // Update lastSeen and broadcast online status
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    socket.broadcast.emit('user_online', { userId });

    // ── Chat Events ─────────────────────────────────────────────
    socket.on('join_room', ({ conversationId }) => {
      socket.join(conversationId);
    });

    socket.on('send_message', async ({ conversationId, content, type = 'text' }) => {
      try {
        // XSS: validate content is plain text — no HTML tags
        const sanitized = String(content).replace(/<[^>]*>/g, '').trim();
        if (!sanitized) return;

        const message = await Message.create({
          conversationId,
          sender: socket.user._id,
          content: sanitized,
          type,
          readBy: [socket.user._id],
        });

        await message.populate('sender', 'fullName profilePhoto role');

        // Update conversation lastMessage
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        });

        io.to(conversationId).emit('receive_message', { message });

        // Notification badge for non-active participants
        const conversation = await Conversation.findById(conversationId);
        conversation.participants.forEach((participantId) => {
          if (participantId.toString() !== userId) {
            io.to(participantId.toString()).emit('notification', {
              type: 'message',
              conversationId,
              from: socket.user.fullName,
            });
          }
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    socket.on('typing_start', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', {
        userId,
        name: socket.user.fullName,
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', { userId, name: null });
    });

    socket.on('mark_read', async ({ conversationId }) => {
      await Message.updateMany(
        { conversationId, readBy: { $ne: socket.user._id } },
        { $addToSet: { readBy: socket.user._id } }
      );
      io.to(conversationId).emit('message_read', { userId, conversationId });
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      socket.broadcast.emit('user_offline', { userId, lastSeen: new Date() });
      console.log(`❌ Socket disconnected: ${socket.user.fullName}`);
    });
  });
};

module.exports = socketHandler;
