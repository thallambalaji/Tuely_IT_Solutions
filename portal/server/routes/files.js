const express = require('express');
const path = require('path');
const fs = require('fs');
const authenticate = require('../middleware/authenticate');
const User = require('../models/User');

const router = express.Router();

const ALLOWED_FOLDERS = ['profiles', 'resumes', 'attachments'];
const uploadsBase = path.join(__dirname, '../uploads');

/**
 * GET /api/files/:folder/:filename
 * Protected file serving — authenticates user and verifies file access rights.
 * Employees can only access their own profile/resume files.
 * Attachments (chat files) are accessible to authenticated users.
 * HR can access all files.
 */
router.get('/:folder/:filename', authenticate, async (req, res) => {
  try {
    const { folder, filename } = req.params;

    // Security: only allow whitelisted folders
    if (!ALLOWED_FOLDERS.includes(folder)) {
      return res.status(403).json({ error: 'Access denied. Invalid folder.' });
    }

    const filePath = path.join(uploadsBase, folder, filename);

    // Security: prevent path traversal
    if (!filePath.startsWith(uploadsBase)) {
      return res.status(403).json({ error: 'Access denied. Invalid path.' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Employee file access rules
    if (req.user.role === 'employee') {
      if (folder === 'profiles' || folder === 'resumes') {
        // Employees can access files that start with their own userId OR are their own
        const fileOwnerPrefix = req.user._id.toString();
        if (!filename.startsWith(fileOwnerPrefix)) {
          // Check if the file belongs to this employee in the DB
          const user = await User.findById(req.user._id).select('profilePhoto resumeUrl');
          const allowedPaths = [user.profilePhoto, user.resumeUrl]
            .filter(Boolean)
            .map(p => path.basename(p));
          if (!allowedPaths.includes(filename)) {
            return res.status(403).json({ error: 'Access denied. You can only access your own files.' });
          }
        }
      }
      // Attachments: any authenticated user can access (for chat messages)
    }

    return res.sendFile(filePath);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to serve file.', details: err.message });
  }
});

module.exports = router;
