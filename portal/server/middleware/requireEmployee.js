/**
 * requireEmployee.js
 * Must be used AFTER authenticate middleware.
 * Blocks access if authenticated user is not an employee.
 */
const requireEmployee = (req, res, next) => {
  if (req.user && req.user.role === 'employee') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Employee role required.' });
};

module.exports = requireEmployee;
