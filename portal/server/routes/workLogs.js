const express = require('express');
const WorkLog = require('../models/WorkLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/work-logs — HR: all (with optional date/employee filters) | Employee: own logs
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, employeeId, month, year } = req.query;
    let query = {};

    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    } else if (employeeId && employeeId !== 'all') {
      query.employee = employeeId;
    }

    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      query.date = { $gte: start, $lte: end };
    } else if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    const logs = await WorkLog.find(query)
      .populate('employee', 'fullName firstName lastName employeeId designation department profilePhoto')
      .populate('lastEditedBy', 'fullName')
      .sort({ date: -1 });

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch work logs.' });
  }
});

// GET /api/work-logs/employee/:id — HR: any employee | Employee: own only
router.get('/employee/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const logs = await WorkLog.find({ employee: req.params.id })
      .populate('lastEditedBy', 'fullName')
      .sort({ date: -1 });
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch logs.' });
  }
});

// POST /api/work-logs — Employee: submit today's log
router.post('/', authenticate, async (req, res) => {
  try {
    const { tasks, notes, date } = req.body;
    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ message: 'At least one task is required.' });
    }

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    // Check if log already exists for today
    const existing = await WorkLog.findOne({
      employee: req.user._id,
      date: { $gte: logDate, $lt: new Date(logDate.getTime() + 86400000) }
    });
    if (existing && existing.isLocked) {
      return res.status(400).json({ message: 'Work log already submitted for today. Only HR can edit submitted logs.' });
    }

    const totalHours = tasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);
    const now = new Date();

    let workLog;
    if (existing) {
      Object.assign(existing, { tasks, notes, totalHours, isLocked: true, submittedAt: now });
      workLog = await existing.save();
    } else {
      workLog = await WorkLog.create({
        employee: req.user._id,
        date: logDate,
        tasks,
        notes,
        totalHours,
        isLocked: true,
        submittedAt: now,
      });
    }

    // Notify all HR users
    const hrUsers = await User.find({ role: 'hr', isActive: true }).select('_id');
    const io = req.app.get('io');
    for (const hr of hrUsers) {
      io?.to(hr._id.toString()).emit('worklog_submitted', {
        employeeId: req.user._id,
        employeeName: req.user.fullName,
        date: logDate,
        totalHours,
      });
      await Notification.create({
        recipient: hr._id,
        type: 'worklog_submitted',
        message: `${req.user.fullName} submitted their work log for ${logDate.toLocaleDateString('en-IN')}`,
        link: '/hr/work-logs',
        icon: 'clock',
      });
    }

    return res.status(201).json({ message: 'Work log submitted and locked.', workLog });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit work log.', error: err.message });
  }
});

// PUT /api/work-logs/:id — HR only: edit any locked log
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const log = await WorkLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Work log not found.' });

    const { tasks, notes } = req.body;
    if (tasks) log.tasks = tasks;
    if (notes !== undefined) log.notes = notes;
    log.isEditedByHR = true;
    log.lastEditedBy = req.user._id;
    log.lastEditedAt = new Date();
    await log.save();

    // Notify employee
    const io = req.app.get('io');
    io?.to(log.employee.toString()).emit('worklog_edited_by_hr', {
      date: log.date,
      message: `Your work log was edited by HR`,
    });

    return res.json({ message: 'Work log updated by HR.', workLog: log });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update work log.', error: err.message });
  }
});

module.exports = router;
