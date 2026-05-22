const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * authenticate.js
 * Verifies JWT from httpOnly cookie on every protected route.
 * Attaches full user document to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Check Authorization Header
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // Check query parameters (for file downloads and media tags)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: 'User not found. Please log in again.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account has been deactivated. Contact HR.' });
    }

    req.user = user;
    req.token = token; // Attach token for downstream use
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ message: 'Invalid session. Please log in again.' });
  }
};

module.exports = authenticate;
