const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message:        { type: String, trim: true, default: '' },
  messageType:    { type: String, enum: ['text', 'image', 'pdf'], default: 'text' },
  attachmentUrl:  { type: String, default: '' },
  attachmentName: { type: String, default: '' },
  seenBy:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deliveredTo:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // ── 14-day TTL ─────────────────────────────────────────────────
  expiresAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

// TTL index created in server.js on startup
module.exports = mongoose.model('GroupMessage', groupMessageSchema);
