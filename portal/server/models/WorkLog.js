const mongoose = require('mongoose');

const taskEntrySchema = new mongoose.Schema({
  taskName:    { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  timeSpent:   { type: Number, required: true, min: 0 }, // in hours
  status:      { type: String, enum: ['Completed', 'In Progress', 'Blocked'], default: 'In Progress' },
  category:    { type: String, trim: true },
}, { _id: false });

const workLogSchema = new mongoose.Schema({
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:         { type: Date, required: true },
  tasks:        { type: [taskEntrySchema], validate: [v => v.length <= 10, 'Maximum 10 tasks per log'] },
  totalHours:   { type: Number, default: 0 }, // auto-summed from tasks
  notes:        { type: String, trim: true },
  submittedAt:  { type: Date },
  lastEditedAt: { type: Date },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HR who edited
}, { timestamps: true });

// Auto-calculate totalHours before save
workLogSchema.pre('save', function (next) {
  if (this.tasks && this.tasks.length > 0) {
    this.totalHours = this.tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);
  }
  next();
});

module.exports = mongoose.model('WorkLog', workLogSchema);
