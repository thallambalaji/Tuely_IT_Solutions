const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  employee:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromDate:    { type: Date, required: true },
  toDate:      { type: Date, required: true },
  leaveType:   { type: String, enum: ['Casual', 'Sick', 'Earned', 'Unpaid'], required: true },
  reason:      { type: String, required: true, trim: true },
  status:      { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote:  { type: String, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
