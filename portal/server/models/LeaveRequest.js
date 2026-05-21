const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, trim: true }, // e.g. "Family Emergency"
  reason:      { type: String, required: true, trim: true },
  leaveType:   { type: String, enum: ['Casual', 'Sick', 'Earned', 'Unpaid'], required: true },
  fromDate:    { type: Date, required: true },
  toDate:      { type: Date, required: true },
  totalDays:   { type: Number, required: true, min: 1 }, // calculated on submission
  status:      { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote:  { type: String, trim: true }, // mandatory for rejection
  reviewedAt:  { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
