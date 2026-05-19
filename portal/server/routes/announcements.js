const express = require('express');
const Announcement = require('../models/Announcement');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/announcements — All authenticated users, filtered by audience and expiry
router.get('/', authenticate, async (req, res) => {
  try {
    const { department } = req.user;
    const query = {
      $or: [
        { audience: 'All' },
        { audience: department === 'IT' ? 'IT' : 'Non-IT' },
      ],
      $or: [{ expiresAt: { $gt: new Date() } }, { expiresAt: null }],
    };

    const announcements = await Announcement.find({
      $or: [{ audience: 'All' }, { audience: department }],
    })
      .populate('postedBy', 'fullName')
      .sort({ isPinned: -1, createdAt: -1 });

    return res.json(announcements);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch announcements.' });
  }
});

// POST /api/announcements — HR only
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const announcement = new Announcement({ ...req.body, postedBy: req.user._id });
    await announcement.save();
    return res.status(201).json({ message: 'Announcement posted.', announcement });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to post announcement.', error: err.message });
  }
});

// PUT /api/announcements/:id — HR only
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!announcement) return res.status(404).json({ message: 'Announcement not found.' });
    return res.json({ message: 'Announcement updated.', announcement });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update announcement.' });
  }
});

// DELETE /api/announcements/:id — HR only
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Announcement deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete announcement.' });
  }
});

module.exports = router;
