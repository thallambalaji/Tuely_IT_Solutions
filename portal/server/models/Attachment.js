const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  senderId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  groupId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  channelId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
  senderRole:       { type: String, enum: ['hr', 'employee'], required: true },
  fileName:         { type: String, required: true },
  originalFileName: { type: String, required: true },
  fileType:         { type: String, required: true }, // e.g. 'image', 'pdf', 'audio', 'xml', 'document'
  fileSize:         { type: Number, required: true }, // in bytes
  filePath:         { type: String, required: true },
  downloadUrl:      { type: String, required: true },
  messageType:      { type: String, enum: ['image', 'pdf', 'audio', 'xml', 'document'], default: 'document' },
  deliveredStatus:  { type: Boolean, default: false },
  seenStatus:       { type: Boolean, default: false },
  seenAt:           { type: Date },
  expiresAt:        { type: Date, required: true }
}, { timestamps: true });

// TTL index is explicitly registered in server.js, but also declared here for completeness
attachmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
attachmentSchema.index({ senderId: 1 });
attachmentSchema.index({ receiverId: 1 });
attachmentSchema.index({ groupId: 1 });
attachmentSchema.index({ channelId: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
