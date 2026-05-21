const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action:      { type: String, enum: ['created', 'edited', 'deleted', 'password_changed', 'login', 'logout', 'security_violation', 'hr_monitor_joined'], required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details:     { type: String, trim: true },
  timestamp:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
