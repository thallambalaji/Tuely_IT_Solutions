const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:        {
    type: String,
    enum: [
      'task_assigned', 'task_updated', 'task_deleted', 'task_status_change',
      'leave_requested', 'leave_decision',
      'announcement_posted',
      'worklog_submitted',
      'password_changed',
      'message',
      'account_deleted',
    ],
    required: true
  },
  message:     { type: String, required: true },
  link:        { type: String, default: '' }, // client-side route to navigate to
  icon:        { type: String, default: 'bell' }, // icon key for frontend
  isRead:      { type: Boolean, default: false },
  isDelivered: { type: Boolean, default: false }, // true once sent via socket
}, { timestamps: true });

// Index for fast unread queries per user
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
