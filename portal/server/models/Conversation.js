const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type:           { type: String, enum: ['direct', 'group'], default: 'direct' },
  participants:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  groupName:      { type: String, trim: true },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastMessage:    { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  pinnedMessage:  { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
