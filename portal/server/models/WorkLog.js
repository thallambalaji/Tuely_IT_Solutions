const mongoose = require('mongoose');

const taskEntrySchema = new mongoose.Schema({
  taskName:    { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  timeSpent:   { type: Number, required: true, min: 0 }, // in hours (decimals allowed)
  status:      { type: String, enum: ['Completed', 'In Progress', 'Blocked'], default: 'In Progress' },
  category:    {
    type: String,
    enum: ['Development', 'Meeting', 'Review', 'Research', 'Support', 'Design', 'Testing', 'Other'],
    default: 'Other'
  },
}, { _id: false });

const workLogSchema = new mongoose.Schema({
  employee:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:           { type: Date, required: true },
  tasks:          { type: [taskEntrySchema], validate: [v => v.length <= 10, 'Maximum 10 tasks per log'] },
  totalHours:     { type: Number, default: 0 }, // auto-summed from tasks
  notes:          { type: String, trim: true },
  submittedAt:    { type: Date },
  isLocked:       { type: Boolean, default: false }, // set to true after employee submission — only HR can edit
  isEditedByHR:   { type: Boolean, default: false }, // true when HR modifies a submitted log
  lastEditedAt:   { type: Date },
  lastEditedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // HR who edited
}, { timestamps: true });

// Auto-calculate totalHours before save
workLogSchema.pre('save', function (next) {
  if (this.tasks && this.tasks.length > 0) {
    this.totalHours = Math.round(this.tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0) * 100) / 100;
  }
  next();
});

// Compound unique index — one log per employee per day
workLogSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('WorkLog', workLogSchema);
