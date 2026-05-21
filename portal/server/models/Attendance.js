const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:      { type: Date, required: true },
  status:    { type: String, enum: ['Present', 'Absent', 'Half Day', 'Leave', 'Not Marked'], required: true },
  markedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // HR ref
  notes:     { type: String, trim: true, default: '' },
}, { timestamps: true });

// Compound unique index — one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
