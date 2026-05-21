const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, required: true, trim: true },
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audience:    { type: String, enum: ['All', 'IT', 'Non-IT'], default: 'All' },
  isPinned:    { type: Boolean, default: false },
  isArchived:  { type: Boolean, default: false }, // HR can manually archive/delete
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
