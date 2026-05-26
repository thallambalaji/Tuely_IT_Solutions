const express = require('express');
const Notification = require('../models/Notification');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/notifications — own unread notifications (for bell + missed delivery)
router.get('/', authenticate, async (req, res) => {
  try {
    const { unread } = req.query;
    const query = { recipient: req.user._id };
    if (unread === 'true') query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    return res.json(notifications);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to count notifications.' });
  }
});

// PUT /api/notifications/mark-all-read — mark all as read
router.put('/mark-all-read', authenticate, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    return res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to mark notifications.' });
  }
});

// PUT /api/notifications/:id/read — mark single as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true }
    );
    return res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update notification.' });
  }
});

// DELETE /api/notifications/:id — delete single notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Notification not found.' });
    return res.json({ message: 'Notification deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete notification.' });
  }
});

module.exports = router;
