/**
 * sanitize.js
 * Backend utility for stripping sensitive fields from user objects
 * before sending to client. Uses manual object transformation — NOT
 * Mongoose .select() — because nested array field exclusion via .select()
 * is unreliable for subdocument arrays.
 */

/**
 * Strips lastDrawnSalary from each entry in previousCompanies.
 * Safe to call on any user object or populated user ref.
 * @param {Object} user - Mongoose document or plain object
 * @returns {Object} sanitized plain object safe to send to employee clients
 */
const sanitizeForEmployee = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };

  if (userObj.previousCompanies && Array.isArray(userObj.previousCompanies)) {
    userObj.previousCompanies = userObj.previousCompanies.map((company) => {
      const { lastDrawnSalary, ...safeCompany } = company;
      return safeCompany;
    });
  }

  // Also strip password just in case toJSON wasn't called
  delete userObj.password;

  return userObj;
};

/**
 * Sanitizes an array of users for employee-facing responses.
 * @param {Array} users
 * @returns {Array}
 */
const sanitizeUsersForEmployee = (users) => users.map(sanitizeForEmployee);

module.exports = { sanitizeForEmployee, sanitizeUsersForEmployee };
