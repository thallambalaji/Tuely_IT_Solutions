const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  postedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // HR
  title:     { type: String, required: true, trim: true },
  content:   { type: String, required: true, trim: true },
  audience:  { type: String, enum: ['All', 'IT', 'Non-IT'], default: 'All' },
  isPinned:  { type: Boolean, default: false },
  expiresAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);
