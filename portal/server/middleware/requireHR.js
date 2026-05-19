/**
 * requireHR.js
 * Must be used AFTER authenticate middleware.
 * Blocks access if authenticated user is not HR.
 */
const requireHR = (req, res, next) => {
  if (req.user && req.user.role === 'hr') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. HR role required.' });
};

module.exports = requireHR;
