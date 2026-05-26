const express = require('express');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/announcements — All authenticated users (filtered by audience)
router.get('/', authenticate, async (req, res) => {
  try {
    let audienceFilter = ['All'];
    if (req.user.role === 'employee') {
      // Employee sees All + their department
      audienceFilter = ['All', req.user.department];
    } else {
      // HR sees all announcements
      audienceFilter = ['All', 'IT', 'Non-IT'];
    }

    const announcements = await Announcement.find({
      isArchived: false,
      audience: { $in: audienceFilter },
    })
      .populate('createdBy', 'fullName')
      .sort({ isPinned: -1, createdAt: -1 }); // pinned first

    return res.json(announcements);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
});

// POST /api/announcements — HR only
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const { title, description, audience = 'All', isPinned = false } = req.body;
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required.' });
    }

    const announcement = await Announcement.create({
      title,
      description,
      audience,
      isPinned,
      createdBy: req.user._id,
    });

    // Determine target employees
    const userQuery = { role: 'employee', isActive: true };
    if (audience !== 'All') userQuery.department = audience;
    const targetEmployees = await User.find(userQuery).select('_id');

    const io = req.app.get('io');
    for (const emp of targetEmployees) {
      io?.to(emp._id.toString()).emit('announcement_posted', {
        announcement: { _id: announcement._id, title, isPinned },
      });
      await Notification.create({
        recipient: emp._id,
        type: 'announcement_posted',
        message: `New announcement: "${title}"`,
        link: '/employee/dashboard',
        icon: 'megaphone',
      });
    }

    return res.status(201).json({ message: 'Announcement created.', announcement });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create announcement.', error: err.message });
  }
});

// PUT /api/announcements/:id — HR only
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const { title, description, audience, isPinned } = req.body;
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title, description, audience, isPinned },
      { new: true, runValidators: true }
    ).populate('createdBy', 'fullName');
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    return res.json(announcement);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update announcement.', error: err.message });
  }
});

// DELETE /api/announcements/:id — HR only (soft delete / archive)
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { isArchived: true },
      { new: true }
    );
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    return res.json({ message: 'Announcement archived.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to archive announcement.', error: err.message });
  }
});

module.exports = router;
