const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');
const { sanitizeForEmployee, sanitizeUsersForEmployee } = require('../utils/sanitize');

const router = express.Router();

// Multer setup for profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user._id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files are allowed.'));
  },
});

// GET /api/users — HR: all employees | Employee: self only
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'hr') {
      const users = await User.find({ isActive: true }).sort({ fullName: 1 });
      return res.json(users); // HR gets full data including salary
    }
    // Employee: only their own data, sanitized
    const user = await User.findById(req.user._id);
    return res.json([sanitizeForEmployee(user)]);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/users/:id — HR: any user | Employee: self only
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Employee data isolation — employee can only view their own profile
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) return res.status(404).json({ message: 'User not found.' });

    if (req.user.role === 'hr') return res.json(user); // Full data for HR
    return res.json(sanitizeForEmployee(user)); // Sanitized for employee
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// POST /api/users — HR only: create new employee account
router.post('/', authenticate, requireHR, async (req, res) => {
  try {
    const { companyEmail, password, ...rest } = req.body;
    const existing = await User.findOne({ companyEmail: companyEmail.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

    const user = new User({ companyEmail, password, ...rest });
    await user.save();

    await AuditLog.create({
      action: 'created',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `Created employee account for ${user.fullName} (${user.companyEmail})`,
    });

    return res.status(201).json({ message: 'Employee account created.', user });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create user.', error: err.message });
  }
});

// PUT /api/users/:id — HR: edit any | Employee: edit self (limited fields)
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    // Prevent employees from changing role, isActive, or adding salary data
    if (req.user.role === 'employee') {
      delete req.body.role;
      delete req.body.isActive;
      if (req.body.previousCompanies) {
        req.body.previousCompanies = req.body.previousCompanies.map(c => {
          const { lastDrawnSalary, ...safe } = c;
          return safe;
        });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (req.user.role === 'hr') {
      await AuditLog.create({
        action: 'edited',
        performedBy: req.user._id,
        targetUser: user._id,
        details: `HR edited profile of ${user.fullName}`,
      });
      return res.json(user);
    }

    return res.json(sanitizeForEmployee(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update user.', error: err.message });
  }
});

// PUT /api/users/:id/change-password — HR only
router.put('/:id/change-password', authenticate, requireHR, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    await AuditLog.create({
      action: 'password_changed',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `HR changed password for ${user.fullName}`,
    });

    // Notify via Socket.IO (emitted from socket handler — user receives password_changed event)
    const io = req.app.get('io');
    io?.to(user._id.toString()).emit('password_changed', {
      message: 'Your password has been changed by HR.',
    });

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to change password.', error: err.message });
  }
});

// DELETE /api/users/:id — HR only (soft delete + Socket.IO force_logout)
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Soft delete — disable account immediately
    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({
      action: 'deleted',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `HR deleted account of ${user.fullName} (${user.companyEmail}). Soft-deleted; hard-delete scheduled.`,
    });

    // Force logout via Socket.IO
    const io = req.app.get('io');
    io?.to(user._id.toString()).emit('force_logout', {
      message: 'Your account has been deactivated.',
    });

    return res.json({ message: `${user.fullName}'s account has been deactivated.` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
});

// POST /api/users/:id/photo — upload profile photo
router.post('/:id/photo', authenticate, upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const photoPath = `/uploads/${req.file.filename}`;
    await User.findByIdAndUpdate(req.params.id, { profilePhoto: photoPath });
    return res.json({ photoPath });
  } catch (err) {
    return res.status(500).json({ message: 'Photo upload failed.', error: err.message });
  }
});

module.exports = router;
