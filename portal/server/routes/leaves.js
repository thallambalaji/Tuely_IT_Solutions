const express = require('express');
const LeaveRequest = require('../models/LeaveRequest');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/leaves — HR: all | Employee: own
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { employee: req.user._id } : {};
    const leaves = await LeaveRequest.find(query)
      .populate('employee', 'fullName department designation profilePhoto')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 });
    return res.json(leaves);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch leave requests.' });
  }
});

// POST /api/leaves — Employee: apply for leave
router.post('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'employee') {
      return res.status(403).json({ message: 'Only employees can apply for leave.' });
    }
    const leave = new LeaveRequest({ ...req.body, employee: req.user._id });
    await leave.save();
    return res.status(201).json({ message: 'Leave request submitted.', leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit leave request.', error: err.message });
  }
});

// PUT /api/leaves/:id/review — HR only: approve or reject
router.put('/:id/review', authenticate, requireHR, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    const leave = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, reviewNote, reviewedBy: req.user._id },
      { new: true }
    ).populate('employee', 'fullName');

    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });

    // Real-time notification to employee
    const io = req.app.get('io');
    io?.to(leave.employee._id.toString()).emit('leave_decision', {
      status,
      reviewNote,
      leaveId: leave._id,
    });

    return res.json({ message: `Leave ${status.toLowerCase()}.`, leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to review leave request.', error: err.message });
  }
});

module.exports = router;
