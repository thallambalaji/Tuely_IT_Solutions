const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  assignedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // HR
  title:        { type: String, required: true, trim: true },
  description:  { type: String, trim: true },
  dueDate:      { type: Date },
  priority:     { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status:       { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  isEdited:     { type: Boolean, default: false },
  editedAt:     { type: Date },
  completedAt:  { type: Date },
}, { timestamps: true });

// Auto-set completedAt when status changes to Completed
taskSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'Completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);
