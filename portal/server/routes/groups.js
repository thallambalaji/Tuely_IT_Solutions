const express = require('express');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');

const router = express.Router();

// GET /api/groups — user's groups | HR: all
router.get('/', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'hr'
      ? { deletedAt: null }
      : { members: req.user._id, deletedAt: null };

    const groups = await Group.find(query)
      .populate('members', 'fullName firstName lastName profilePhoto designation')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    return res.json(groups);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch groups.' });
  }
});

// POST /api/groups — HR only: create group
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const { groupName, groupDescription, members } = req.body;
    if (!groupName || !members || members.length === 0) {
      return res.status(400).json({ message: 'Group name and at least one member required.' });
    }

    // Ensure HR is in the group
    const allMembers = [...new Set([req.user._id.toString(), ...members])];
    const group = await Group.create({
      groupName,
      groupDescription: groupDescription || '',
      createdBy: req.user._id,
      members: allMembers,
      admins: [req.user._id],
    });
    await group.populate('members', 'fullName firstName lastName profilePhoto');

    // Notify all members via socket
    const io = req.app.get('io');
    allMembers.forEach(memberId => {
      if (memberId.toString() !== req.user._id.toString()) {
        io?.to(memberId.toString()).emit('group_created', {
          group: { _id: group._id, groupName },
        });
      }
    });

    return res.status(201).json({ message: 'Group created.', group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create group.', error: err.message });
  }
});

// PUT /api/groups/:id — HR only: update name, members
router.put('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const { groupName, groupDescription, members } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group || group.deletedAt) return res.status(404).json({ message: 'Group not found.' });

    if (groupName) group.groupName = groupName;
    if (groupDescription !== undefined) group.groupDescription = groupDescription;
    if (members) group.members = members;
    await group.save();
    await group.populate('members', 'fullName firstName lastName profilePhoto');

    const io = req.app.get('io');
    group.members.forEach(m => {
      io?.to(m._id.toString()).emit('group_updated', { group: { _id: group._id, groupName: group.groupName } });
    });

    return res.json(group);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update group.', error: err.message });
  }
});

// DELETE /api/groups/:id — HR only: soft delete
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || group.deletedAt) return res.status(404).json({ message: 'Group not found.' });

    const io = req.app.get('io');
    group.members.forEach(memberId => {
      io?.to(memberId.toString()).emit('group_deleted', { groupId: group._id, groupName: group.groupName });
    });

    group.deletedAt = new Date();
    await group.save();

    return res.json({ message: 'Group deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete group.', error: err.message });
  }
});

// GET /api/groups/:id/messages — get group messages with pagination
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group || group.deletedAt) return res.status(404).json({ message: 'Group not found.' });

    if (req.user.role !== 'hr' && !group.members.some(m => m.equals(req.user._id))) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { page = 1, limit = 30 } = req.query;
    const messages = await GroupMessage.find({ groupId: req.params.id })
      .populate('senderId', 'fullName firstName lastName profilePhoto')
      .populate('attachmentId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    return res.json(messages.reverse());
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch group messages.' });
  }
});

module.exports = router;
