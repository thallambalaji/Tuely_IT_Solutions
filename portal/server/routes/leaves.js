const express = require('express');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// Leave type limits
const LEAVE_LIMITS = { Casual: 12, Sick: 10, Earned: 15 };

// GET /api/leaves/balance/:id — compute leave balance dynamically
router.get('/balance/:id', authenticate, async (req, res) => {
  try {
    // Employee can only see own balance
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    // Only count APPROVED leaves in the current calendar year
    const approvedLeaves = await LeaveRequest.find({
      employee: req.params.id,
      status: 'Approved',
      fromDate: { $gte: startOfYear, $lte: endOfYear },
    });

    const used = { Casual: 0, Sick: 0, Earned: 0, Unpaid: 0 };
    approvedLeaves.forEach(l => { used[l.leaveType] = (used[l.leaveType] || 0) + l.totalDays; });

    const balance = {
      Casual:  { total: 12, used: used.Casual,  remaining: Math.max(0, 12 - used.Casual) },
      Sick:    { total: 10, used: used.Sick,    remaining: Math.max(0, 10 - used.Sick) },
      Earned:  { total: 15, used: used.Earned,  remaining: Math.max(0, 15 - used.Earned) },
      Unpaid:  { total: null, used: used.Unpaid, remaining: null }, // unlimited
    };

    return res.json(balance);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to compute leave balance.' });
  }
});

// GET /api/leaves — HR: all | Employee: own
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, leaveType, employeeId } = req.query;
    const query = req.user.role === 'employee' ? { employee: req.user._id } : {};
    if (status && status !== 'all') query.status = status;
    if (leaveType && leaveType !== 'all') query.leaveType = leaveType;
    if (req.user.role === 'hr' && employeeId && employeeId !== 'all') query.employee = employeeId;

    const leaves = await LeaveRequest.find(query)
      .populate('employee', 'fullName firstName lastName employeeId designation department profilePhoto')
      .populate('reviewedBy', 'fullName')
      .sort({ createdAt: -1 });

    return res.json(leaves);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch leave requests.' });
  }
});

// POST /api/leaves — Employee only: submit leave request
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, reason, leaveType, fromDate, toDate } = req.body;
    if (!title || !reason || !leaveType || !fromDate || !toDate) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to < from) return res.status(400).json({ message: 'To Date must be on or after From Date.' });

    // Calculate total days (inclusive, weekdays only for simplicity — or all days)
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((to - from) / msPerDay) + 1;

    // Balance check for non-Unpaid types
    if (leaveType !== 'Unpaid' && LEAVE_LIMITS[leaveType]) {
      const currentYear = new Date().getFullYear();
      const startOfYear = new Date(currentYear, 0, 1);
      const approvedLeaves = await LeaveRequest.find({
        employee: req.user._id,
        leaveType,
        status: 'Approved',
        fromDate: { $gte: startOfYear },
      });
      const usedDays = approvedLeaves.reduce((sum, l) => sum + l.totalDays, 0);
      const remaining = LEAVE_LIMITS[leaveType] - usedDays;
      if (totalDays > remaining) {
        return res.status(400).json({
          message: `Insufficient ${leaveType} leave balance. You have ${remaining} day(s) remaining.`,
          remaining,
          requested: totalDays,
        });
      }
    }

    const leave = await LeaveRequest.create({
      employee: req.user._id,
      title,
      reason,
      leaveType,
      fromDate: from,
      toDate: to,
      totalDays,
      status: 'Pending',
    });

    // Notify all HR
    const hrUsers = await User.find({ role: 'hr', isActive: true }).select('_id');
    const io = req.app.get('io');
    for (const hr of hrUsers) {
      io?.to(hr._id.toString()).emit('leave_requested', {
        employeeName: req.user.fullName,
        leaveType,
        totalDays,
        title,
      });
      await Notification.create({
        recipient: hr._id,
        type: 'leave_requested',
        message: `${req.user.fullName} requested ${totalDays} day(s) ${leaveType} leave: "${title}"`,
        link: '/hr/leaves',
        icon: 'calendar',
      });
    }

    return res.status(201).json({ message: 'Leave request submitted.', leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to submit leave request.', error: err.message });
  }
});

// PUT /api/leaves/:id/review — HR only: approve or reject
router.put('/:id/review', authenticate, requireHR, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected.' });
    }
    if (status === 'Rejected' && (!reviewNote || !reviewNote.trim())) {
      return res.status(400).json({ message: 'A rejection reason (reviewNote) is mandatory.' });
    }

    const leave = await LeaveRequest.findById(req.params.id).populate('employee', 'fullName _id');
    if (!leave) return res.status(404).json({ message: 'Leave request not found.' });
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'This leave request has already been reviewed.' });
    }

    leave.status = status;
    leave.reviewNote = reviewNote || '';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = new Date();
    await leave.save();

    // Notify employee
    const io = req.app.get('io');
    const empId = leave.employee._id.toString();
    const msg = status === 'Approved'
      ? `Your leave request "${leave.title}" was Approved ✓`
      : `Your leave request "${leave.title}" was Declined ✗. Reason: ${reviewNote}`;

    io?.to(empId).emit('leave_decision', { status, leaveId: leave._id, message: msg });
    await Notification.create({
      recipient: leave.employee._id,
      type: 'leave_decision',
      message: msg,
      link: '/employee/leave',
      icon: status === 'Approved' ? 'check' : 'x',
    });

    return res.json({ message: `Leave request ${status}.`, leave });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to review leave.', error: err.message });
  }
});

module.exports = router;
