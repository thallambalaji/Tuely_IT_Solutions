const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { companyEmail, password } = req.body;

    if (!companyEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ companyEmail: companyEmail.toLowerCase().trim() });

    // Generic error — never specify which field is wrong (security best practice)
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Update lastSeen
    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Set httpOnly cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    // Audit log
    await AuditLog.create({
      action: 'login',
      performedBy: user._id,
      targetUser: user._id,
      details: `${user.role} logged in from ${req.ip}`,
    });

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        _id: user._id,
        fullName: user.fullName,
        companyEmail: user.companyEmail,
        role: user.role,
        designation: user.designation,
        department: user.department,
        profilePhoto: user.profilePhoto,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await AuditLog.create({
      action: 'logout',
      performedBy: req.user._id,
      targetUser: req.user._id,
      details: `${req.user.role} logged out`,
    });

    res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error during logout.' });
  }
});

// GET /api/auth/me — verify session and return current user
router.get('/me', authenticate, async (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
