const express = require('express');
const Attendance = require('../models/Attendance');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/attendance — HR: all for date range | Employee: own
router.get('/', authenticate, async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    const query = {};

    if (from && to) {
      query.date = { $gte: new Date(from), $lte: new Date(to) };
    }

    if (req.user.role === 'employee') {
      query.employee = req.user._id;
    } else if (employeeId) {
      query.employee = employeeId;
    }

    const records = await Attendance.find(query)
      .populate('employee', 'fullName department designation')
      .populate('markedBy', 'fullName')
      .sort({ date: -1 });

    return res.json(records);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch attendance.' });
  }
});

// POST /api/attendance — HR only: mark attendance
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const { employee, date, status, notes } = req.body;
    const record = await Attendance.findOneAndUpdate(
      { employee, date: new Date(date) },
      { employee, date, status, notes, markedBy: req.user._id },
      { upsert: true, new: true, runValidators: true }
    );
    return res.status(201).json({ message: 'Attendance marked.', record });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to mark attendance.', error: err.message });
  }
});

module.exports = router;
