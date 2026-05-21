const Message = require('../models/Message');
const GroupMessage = require('../models/GroupMessage');
const Conversation = require('../models/Conversation');
const Group = require('../models/Group');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

/**
 * socketHandler.js — Complete Socket.IO event handler
 * All events authenticated via JWT. HR monitoring is invisible to employees.
 * Offline notifications saved to MongoDB when target user is offline.
 */
const socketHandler = (io) => {
  // Track connected users: userId -> Set of socketIds
  const connectedUsers = new Map();

  const isUserOnline = (userId) => connectedUsers.has(userId.toString()) &&
    connectedUsers.get(userId.toString()).size > 0;

  // ── Middleware: authenticate every socket connection ────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split(';')
          .find(c => c.trim().startsWith('token='))
          ?.split('=')[1];

      if (!token) return next(new Error('Authentication required.'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user || !user.isActive) return next(new Error('User not found or inactive.'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`✅ Socket connected: ${socket.user.fullName} [${socket.user.role}] (${socket.id})`);

    // ── Track connection ──────────────────────────────────────────
    if (!connectedUsers.has(userId)) connectedUsers.set(userId, new Set());
    connectedUsers.get(userId).add(socket.id);

    // Join personal room
    socket.join(userId);

    // Update lastSeen + broadcast online status
    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    socket.broadcast.emit('user_online', { userId });

    // ── Deliver missed notifications on connect ───────────────────
    try {
      const missed = await Notification.find({ recipient: userId, isDelivered: false })
        .sort({ createdAt: -1 })
        .limit(50);
      if (missed.length > 0) {
        socket.emit('missed_notifications', { notifications: missed });
        await Notification.updateMany(
          { _id: { $in: missed.map(n => n._id) } },
          { isDelivered: true }
        );
      }
    } catch (err) {
      console.error('Failed to deliver missed notifications:', err.message);
    }

    // ── Direct Chat Events ────────────────────────────────────────
    socket.on('join_room', ({ conversationId }) => {
      if (conversationId) socket.join(conversationId);
    });

    socket.on('send_message', async ({ conversationId, content, type = 'text', attachmentUrl = '', attachmentName = '' }) => {
      try {
        // XSS: strip HTML tags from text content
        const sanitized = type === 'text' ? String(content).replace(/<[^>]*>/g, '').trim() : content;
        if (!sanitized && !attachmentUrl) return;

        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const message = await Message.create({
          conversationId,
          sender: socket.user._id,
          content: sanitized,
          type,
          attachmentUrl,
          attachmentName,
          readBy: [socket.user._id],
          expiresAt,
        });

        await message.populate('sender', 'fullName firstName lastName profilePhoto role');

        // Update conversation lastMessage
        const conv = await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: message._id,
          updatedAt: new Date(),
        }).select('participants');

        // Emit to all in room (sender gets sent status)
        io.to(conversationId).emit('receive_message', { message });

        // Notify non-sender participants
        if (conv) {
          conv.participants.forEach(async (participantId) => {
            const pid = participantId.toString();
            if (pid !== userId) {
              // Mark as delivered if online
              if (isUserOnline(pid)) {
                await Message.findByIdAndUpdate(message._id, { deliveredStatus: true });
                socket.emit('message_delivered', { messageId: message._id });
              }
              // Send notification
              io.to(pid).emit('notification', {
                type: 'message',
                conversationId,
                from: socket.user.fullName,
                messageId: message._id,
              });
              // Save notification for offline delivery
              await Notification.create({
                recipient: participantId,
                type: 'message',
                message: `New message from ${socket.user.fullName}`,
                link: '/messages',
                icon: 'message',
              });
            }
          });
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message.' });
        console.error('send_message error:', err.message);
      }
    });

    // ── Mark message as seen ─────────────────────────────────────
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        const updated = await Message.updateMany(
          { conversationId, readBy: { $ne: socket.user._id }, isDeleted: false },
          { $addToSet: { readBy: socket.user._id }, seenStatus: true, seenAt: new Date() }
        );

        io.to(conversationId).emit('message_seen', { userId, conversationId });
      } catch (err) {
        console.error('mark_read error:', err.message);
      }
    });

    // ── Typing Indicators ─────────────────────────────────────────
    socket.on('typing_start', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', { userId, name: socket.user.fullName, conversationId });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      socket.to(conversationId).emit('user_typing', { userId, name: null, conversationId });
    });

    // ── Group Chat Events ─────────────────────────────────────────
    socket.on('join_group', ({ groupId }) => {
      if (groupId) socket.join(`group_${groupId}`);
    });

    socket.on('create_group', async ({ groupName, members }) => {
      // Security: HR only at socket level
      if (socket.user.role !== 'hr') return; // silently ignore non-HR

      try {
        const allMembers = [...new Set([userId, ...members])];
        const group = await Group.create({
          groupName,
          createdBy: socket.user._id,
          members: allMembers,
          admins: [socket.user._id],
        });

        allMembers.forEach(memberId => {
          io.to(memberId.toString()).emit('group_created', {
            group: { _id: group._id, groupName },
          });
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to create group.' });
      }
    });

    socket.on('send_group_message', async ({ groupId, content, type = 'text', attachmentUrl = '', attachmentName = '' }) => {
      try {
        const group = await Group.findById(groupId);
        if (!group || group.deletedAt) return;

        // Verify membership (HR can always send)
        if (socket.user.role !== 'hr' && !group.members.includes(socket.user._id)) {
          return socket.emit('error', { message: 'You are not a member of this group.' });
        }

        const sanitized = type === 'text' ? String(content).replace(/<[^>]*>/g, '').trim() : content;
        const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const groupMessage = await GroupMessage.create({
          groupId,
          senderId: socket.user._id,
          message: sanitized,
          messageType: type,
          attachmentUrl,
          attachmentName,
          seenBy: [socket.user._id],
          deliveredTo: [socket.user._id],
          expiresAt,
        });

        await groupMessage.populate('senderId', 'fullName firstName lastName profilePhoto');

        io.to(`group_${groupId}`).emit('receive_group_message', { message: groupMessage, groupId });
      } catch (err) {
        socket.emit('error', { message: 'Failed to send group message.' });
      }
    });

    socket.on('leave_group', ({ groupId }) => {
      socket.leave(`group_${groupId}`);
    });

    // ── HR Silent Monitoring — Security Critical ──────────────────
    socket.on('hr_monitor_chat', async ({ conversationId }) => {
      // MANDATORY: verify HR role at socket level
      if (socket.user.role !== 'hr') {
        console.warn(`⚠️ Non-HR user ${socket.user.fullName} attempted hr_monitor_chat — disconnecting.`);
        socket.disconnect(true);
        // Log security violation
        try {
          await AuditLog.create({
            action: 'security_violation',
            performedBy: socket.user._id,
            details: `Non-HR user attempted hr_monitor_chat event for conversation ${conversationId}`,
          });
        } catch (_) {}
        return;
      }

      // Join silently — DO NOT emit any event to room members
      socket.join(conversationId);

      // Log HR monitoring action (audit trail)
      try {
        await AuditLog.create({
          action: 'hr_monitor_joined',
          performedBy: socket.user._id,
          details: `HR joined conversation ${conversationId} as silent monitor`,
        });
      } catch (_) {}
    });

    // ── Disconnect ────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      // Remove this socket from connected set
      if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socket.id);
        if (connectedUsers.get(userId).size === 0) {
          connectedUsers.delete(userId);
          // Only broadcast offline if no other sockets for this user
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { lastSeen });
          socket.broadcast.emit('user_offline', { userId, lastSeen });
        }
      }
      console.log(`❌ Socket disconnected: ${socket.user.fullName}`);
    });
  });
};

module.exports = socketHandler;
