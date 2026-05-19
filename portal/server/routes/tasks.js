const express = require('express');
const Task = require('../models/Task');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/tasks — HR: all | Employee: own tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { assignedTo: req.user._id } : {};
    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName designation department profilePhoto')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks — HR only: assign task
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const task = new Task({ ...req.body, assignedBy: req.user._id });
    await task.save();

    // Socket.IO: notify employee
    const io = req.app.get('io');
    io?.to(task.assignedTo.toString()).emit('task_assigned', { task });

    return res.status(201).json({ message: 'Task assigned.', task });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to assign task.', error: err.message });
  }
});

// PUT /api/tasks/:id — HR: full edit | Employee: status only
router.put('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Employee data isolation
    if (req.user.role === 'employee') {
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      // Employees can only change status
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: 'Employees can only update task status.' });

      task.status = status;
      await task.save();

      // Notify HR in real-time
      const io = req.app.get('io');
      io?.to(task.assignedBy.toString()).emit('task_status_change', {
        taskId: task._id,
        status,
        employeeId: req.user._id,
      });

      return res.json({ message: 'Status updated.', task });
    }

    // HR: full edit
    Object.assign(task, req.body);
    task.isEdited = true;
    task.editedAt = new Date();
    await task.save();

    const io = req.app.get('io');
    io?.to(task.assignedTo.toString()).emit('task_updated', { task });

    return res.json({ message: 'Task updated.', task });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update task.', error: err.message });
  }
});

// DELETE /api/tasks/:id — HR only
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const io = req.app.get('io');
    io?.to(task.assignedTo.toString()).emit('task_deleted', { taskId: task._id });

    return res.json({ message: 'Task deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete task.' });
  }
});

module.exports = router;
