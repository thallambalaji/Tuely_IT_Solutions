const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const authenticate = require('../middleware/authenticate');
const requireHR = require('../middleware/requireHR');
const { sanitizeForEmployee, sanitizeUsersForEmployee } = require('../utils/sanitize');

const router = express.Router();

// ── Ensure upload subdirectories exist ────────────────────────────
const uploadsBase = path.join(__dirname, '../uploads');
['profiles', 'resumes', 'attachments'].forEach(dir => {
  const dirPath = path.join(uploadsBase, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// ── Multer setup for profile photos ───────────────────────────────
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadsBase, 'profiles')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id || req.user._id}_profile_${Date.now()}${ext}`);
  },
});
const uploadPhoto = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext) && /image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or WEBP images are allowed for profile photos.'));
    }
  },
});

// ── Multer setup for resumes (PDF + DOCX) ─────────────────────────
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(uploadsBase, 'resumes')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id || req.user._id}_resume_${Date.now()}${ext}`);
  },
});
const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExts = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or Word (.docx) format is accepted for resume.'));
    }
  },
});

// ── Helper: auto-generate employee ID ─────────────────────────────
async function generateEmployeeId() {
  const last = await User.findOne({ role: 'employee', employeeId: { $exists: true, $ne: '' } })
    .sort({ createdAt: -1 })
    .select('employeeId');
  if (!last || !last.employeeId) return 'TIS_001';
  const num = parseInt(last.employeeId.split('_')[1]) || 0;
  return `TIS_${String(num + 1).padStart(3, '0')}`;
}

// ── GET /api/users — HR: all employees | Employee: self only ──────
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'hr') {
      const users = await User.find({ isActive: true }).sort({ createdAt: -1 });
      return res.json(users); // HR gets full data including salary
    }
    const user = await User.findById(req.user._id);
    return res.json([sanitizeForEmployee(user)]);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ── GET /api/users/next-id ────────────────────────────────────────
// Returns the next available Employee ID without creating anything
router.get('/next-id', authenticate, requireHR, async (req, res) => {
  try {
    const lastEmployee = await User.findOne({ role: 'employee', employeeId: { $exists: true } })
      .sort({ createdAt: -1 })
      .select('employeeId');
    const lastNum = lastEmployee && lastEmployee.employeeId
      ? parseInt(lastEmployee.employeeId.split('_')[1], 10)
      : 0;
    const nextId = `TIS_${String(lastNum + 1).padStart(3, '0')}`;
    res.json({ employeeId: nextId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate ID' });
  }
});

// ── GET /api/users/:id ────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const user = await User.findById(req.params.id);
    if (!user || !user.isActive) return res.status(404).json({ message: 'User not found.' });
    if (req.user.role === 'hr') return res.json(user);
    return res.json(sanitizeForEmployee(user));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

// ── POST /api/users — HR only: create employee ────────────────────
router.post('/', authenticate, requireHR, (req, res, next) => {
  uploadPhoto.single('profilePhoto')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const { companyEmail, password } = req.body;
    let rest = { ...req.body };

    // Parse JSON stringified fields from FormData
    if (typeof rest.address === 'string') {
      try { rest.address = JSON.parse(rest.address); } catch (e) {}
    }
    if (typeof rest.previousCompanies === 'string') {
      try { rest.previousCompanies = JSON.parse(rest.previousCompanies); } catch (e) {}
    }
    if (typeof rest.totalExperience === 'string') {
      try { rest.totalExperience = JSON.parse(rest.totalExperience); } catch (e) {}
    }

    // Compose fullName from firstName + lastName if provided
    if (rest.firstName || rest.lastName) {
      const parts = [rest.firstName, rest.middleName, rest.lastName].filter(Boolean);
      rest.fullName = parts.join(' ') || rest.fullName || 'Employee';
    }

    // Check for existing email before saving:
    const existingUser = await User.findOne({ companyEmail: companyEmail.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ error: 'An employee with this company email already exists.' });
    }

    // Handle employeeId uniqueness and generation
    let finalEmployeeId = req.body.employeeId;
    if (!finalEmployeeId) {
      finalEmployeeId = await generateEmployeeId();
    } else {
      const existingId = await User.findOne({ employeeId: finalEmployeeId });
      if (existingId) {
        // If duplicate: generate next available ID and save with that
        finalEmployeeId = await generateEmployeeId();
      }
    }

    // Handle profile photo path
    let profilePhotoPath = '';
    if (req.file) {
      profilePhotoPath = `/api/files/profiles/${req.file.filename}`;
    }

    const user = new User({
      companyEmail,
      password,
      role: 'employee',
      employeeId: finalEmployeeId,
      profilePhoto: profilePhotoPath,
      ...rest
    });
    await user.save();

    await AuditLog.create({
      action: 'created',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `Created employee account for ${user.fullName} (${user.companyEmail}) — ID: ${finalEmployeeId}`,
    });

    return res.status(201).json({ message: 'Employee account created.', user });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    return res.status(500).json({ error: 'Failed to create user.', errorDetails: err.message });
  }
});

// ── PUT /api/users/:id — HR: edit any | Employee: limited fields ──
router.put('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) return res.status(404).json({ message: 'User not found.' });

    if (req.user.role === 'employee') {
      // Strip HR-only fields
      delete req.body.role;
      delete req.body.isActive;
      delete req.body.salary;
      delete req.body.designation;
      delete req.body.department;
      delete req.body.joiningDate;
      delete req.body.employeeId;
      delete req.body.companyEmail;
      // Keep salary from existing for previousCompanies
      if (req.body.previousCompanies) {
        req.body.previousCompanies = req.body.previousCompanies.map(c => {
          const dbCompany = existingUser.previousCompanies.find(dbC => dbC.companyName === c.companyName);
          return { ...c, lastDrawnSalary: dbCompany ? dbCompany.lastDrawnSalary : undefined };
        });
      }
    }

    // Compose fullName if names changed
    if (req.body.firstName || req.body.lastName) {
      const first = req.body.firstName || existingUser.firstName || '';
      const mid = req.body.middleName !== undefined ? req.body.middleName : (existingUser.middleName || '');
      const last = req.body.lastName || existingUser.lastName || '';
      req.body.fullName = [first, mid, last].filter(Boolean).join(' ');
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

// ── PUT /api/users/:id/change-password — HR or Self ─────────────────
router.put('/:id/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const isHR = req.user.role === 'hr';
    const isSelf = req.user._id.toString() === req.params.id;

    if (!isHR && !isSelf) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (!isHR) {
      // Must verify current password
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required.' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password.' });
      }
    }

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    await AuditLog.create({
      action: 'password_changed',
      performedBy: req.user._id,
      targetUser: user._id,
      details: isHR
        ? `HR changed password for ${user.fullName}`
        : `User changed their own password`,
    });

    if (isHR) {
      // Notify via Socket.IO (if online)
      const io = req.app.get('io');
      io?.to(user._id.toString()).emit('password_changed', {
        message: 'Your login password was changed by HR. Please use your new password next time you log in.',
      });

      // Save notification for offline delivery
      const Notification = require('../models/Notification');
      await Notification.create({
        recipient: user._id,
        type: 'password_changed',
        message: 'Your login password was changed by HR.',
        link: '/login',
        icon: 'key',
      });
    }

    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to change password.', error: err.message });
  }
});

// ── DELETE /api/users/:id — HR only (soft delete) ─────────────────
router.delete('/:id', authenticate, requireHR, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    await AuditLog.create({
      action: 'deleted',
      performedBy: req.user._id,
      targetUser: user._id,
      details: `HR deleted account of ${user.fullName} (${user.companyEmail}). Soft-deleted; hard-delete scheduled in 24h.`,
    });

    const io = req.app.get('io');
    io?.to(user._id.toString()).emit('force_logout', {
      message: 'Your account has been deactivated by HR.',
    });

    return res.json({ message: `${user.fullName}'s account has been deactivated.` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
});

// ── POST /api/users/:id/photo — upload profile photo ─────────────
router.post('/:id/photo', authenticate, (req, res, next) => {
  uploadPhoto.single('photo')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded.' });
    const photoPath = `/api/files/profiles/${req.file.filename}`;
    await User.findByIdAndUpdate(req.params.id, { profilePhoto: photoPath });
    return res.json({ photoPath });
  } catch (err) {
    return res.status(500).json({ message: 'Photo upload failed.', error: err.message });
  }
});

// ── POST /api/users/:id/resume — upload resume ────────────────────
router.post('/:id/resume', authenticate, (req, res, next) => {
  uploadResume.single('resume')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (req.user.role === 'employee' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (!req.file) return res.status(400).json({ message: 'No resume file uploaded.' });
    const ext = path.extname(req.file.originalname).toLowerCase();
    const resumePath = `/api/files/resumes/${req.file.filename}`;
    await User.findByIdAndUpdate(req.params.id, {
      resumeUrl: resumePath,
      resumeFilename: req.file.originalname,
    });
    return res.json({ resumePath, filename: req.file.originalname, fileType: ext === '.pdf' ? 'pdf' : 'docx' });
  } catch (err) {
    return res.status(500).json({ message: 'Resume upload failed.', error: err.message });
  }
});

module.exports = router;
