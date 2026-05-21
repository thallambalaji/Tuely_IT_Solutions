const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  groupName:        { type: String, required: true, trim: true },
  groupDescription: { type: String, trim: true, default: '' },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // HR only
  members:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedAt:        { type: Date, default: null }, // soft delete
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
