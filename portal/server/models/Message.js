const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  sender:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:          { type: String, trim: true, default: '' },
  type:             { type: String, enum: ['text', 'image', 'pdf'], default: 'text' },
  attachmentUrl:    { type: String, default: '' },   // path for image/pdf
  attachmentName:   { type: String, default: '' },   // original filename

  // ── Delivery/Seen tick system ──────────────────────────────────
  deliveredStatus:  { type: Boolean, default: false }, // delivered to recipient device (✓✓ gray)
  seenStatus:       { type: Boolean, default: false }, // read/seen by recipient (✓✓ blue)
  seenAt:           { type: Date },

  readBy:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // legacy + group support
  isDeleted:        { type: Boolean, default: false },

  // ── 14-day TTL ────────────────────────────────────────────────
  expiresAt:        { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

// TTL index — MongoDB auto-deletes documents when expiresAt is reached
// Created in server.js on startup after mongoose.connect()

module.exports = mongoose.model('Message', messageSchema);
