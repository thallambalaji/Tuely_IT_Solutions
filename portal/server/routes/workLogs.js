const express = require('express');
const WorkLog = require('../models/WorkLog');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/work-logs — HR: all for a date | Employee: own logs
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    const query = {};

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    if (req.user.role === 'employee') {
      query.employee = req.user._id; // Always filter by own ID
    } else if (employeeId) {
      query.employee = employeeId;
    }

    const logs = await WorkLog.find(query)
      .populate('employee', 'fullName designation department profilePhoto')
      .populate('lastEditedBy', 'fullName')
      .sort({ date: -1 });

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch work logs.' });
  }
});

// POST /api/work-logs — Employee: submit today's log
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Only employees can submit work logs.' });
    }

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const existing = await WorkLog.findOne({ employee: req.user._id, date: { $gte: today } });
    if (existing) {
      return res.status(409).json({ message: 'Work log already submitted for today. Only HR can edit submitted logs.' });
    }

    const log = new WorkLog({
      ...req.body,
      employee: req.user._id,
      date: new Date(),
      submittedAt: new Date(),
    });
    await log.save();

    return res.status(201).json({ message: 'Work log submitted successfully.', log });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit work log.', error: err.message });
  }
});

// PUT /api/work-logs/:id — HR only: edit submitted log
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const log = await WorkLog.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastEditedAt: new Date(), lastEditedBy: req.user._id },
      { new: true, runValidators: true }
    ).populate('employee', 'fullName');

    if (!log) return res.status(404).json({ message: 'Work log not found.' });

    return res.json({ message: 'Work log updated.', log });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update work log.', error: err.message });
  }
});

module.exports = router;
