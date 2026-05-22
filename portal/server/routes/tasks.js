const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// Helper: save notification + emit socket if online
async function notifyUser(io, userId, type, message, link) {
  // Always save to DB (offline queue)
  await Notification.create({ recipient: userId, type, message, link });
  // Also emit via socket if online
  io?.to(userId.toString()).emit(type, { message });
}

// GET /api/tasks — HR: all | Employee: own tasks
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'employee' ? { assignedTo: req.user._id } : {};
    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName firstName lastName designation department profilePhoto employeeId')
      .populate('assignedBy', 'fullName')
      .sort({ createdAt: -1 });
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks — HR only: assign task(s)
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const io = req.app.get('io');
    
    if (Array.isArray(req.body)) {
      const createdTasks = [];
      for (const t of req.body) {
        const task = new Task({ ...t, assignedBy: req.user._id });
        await task.save();
        await task.populate('assignedTo', 'fullName firstName lastName employeeId');
        createdTasks.push(task);

        // Socket emit to employee
        io?.to(task.assignedTo._id.toString()).emit('task_assigned', { task });
        // Save notification for offline delivery
        await Notification.create({
          recipient: task.assignedTo._id,
          type: 'task_assigned',
          message: `HR assigned you a new task: "${task.title}"`,
          link: '/employee/tasks',
          icon: 'clipboard',
        });
      }
      return res.status(201).json({ message: 'Tasks assigned.', tasks: createdTasks });
    } else {
      const task = new Task({ ...req.body, assignedBy: req.user._id });
      await task.save();
      await task.populate('assignedTo', 'fullName firstName lastName employeeId');

      // Socket emit to employee
      io?.to(task.assignedTo._id.toString()).emit('task_assigned', { task });
      // Save notification for offline delivery
      await Notification.create({
        recipient: task.assignedTo._id,
        type: 'task_assigned',
        message: `HR assigned you a new task: "${task.title}"`,
        link: '/employee/tasks',
        icon: 'clipboard',
      });

      return res.status(201).json({ message: 'Task assigned.', task });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Failed to assign task.', error: err.message });
  }
});

// PUT /api/tasks/:id — HR: full edit | Employee: status only
router.put('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const io = req.app.get('io');

    if (req.user.role === 'employee') {
      // Employee data isolation
      if (task.assignedTo.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: 'Employees can only update task status.' });

      task.status = status;
      await task.save();

      // Notify HR in real-time
      io?.to(task.assignedBy.toString()).emit('task_status_change', {
        taskId: task._id,
        taskTitle: task.title,
        status,
        employeeId: req.user._id,
        employeeName: req.user.fullName,
      });
      // Save notification for HR
      await Notification.create({
        recipient: task.assignedBy,
        type: 'task_status_change',
        message: `${req.user.fullName} marked task "${task.title}" as ${status}`,
        link: '/hr/employees',
        icon: 'check-circle',
      });

      return res.json({ message: 'Status updated.', task });
    }

    // HR: full edit
    const allowedFields = ['title', 'description', 'priority', 'dueDate', 'status'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) task[field] = req.body[field];
    });
    task.isEdited = true;
    task.editedAt = new Date();
    await task.save();

    io?.to(task.assignedTo.toString()).emit('task_updated', { task });
    await Notification.create({
      recipient: task.assignedTo,
      type: 'task_updated',
      message: `Your task "${task.title}" was edited by HR`,
      link: '/employee/tasks',
      icon: 'edit',
    });

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
    io?.to(task.assignedTo.toString()).emit('task_deleted', {
      taskId: task._id,
      taskTitle: task.title,
    });
    await Notification.create({
      recipient: task.assignedTo,
      type: 'task_deleted',
      message: `Your task "${task.title}" was removed by HR`,
      link: '/employee/tasks',
      icon: 'trash',
    });

    return res.json({ message: 'Task deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete task.' });
  }
});

module.exports = router;
