/**
 * emailReporter.js — Phase 3 feature
 * Weekly email report sent every Monday via Nodemailer.
 * Placeholder implementation for Phase 1; fully implemented in Phase 3.
 */

const sendWeeklyReport = async (employeeData, recipientEmail) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[EmailReporter] Weekly report would be sent to ${recipientEmail}`);
    return;
  }
  // Phase 3: full Nodemailer implementation
};

module.exports = { sendWeeklyReport };
