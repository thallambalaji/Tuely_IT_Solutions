const cron = require('node-cron');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const WorkLog = require('../models/WorkLog');

// Configure mail transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const sendWeeklyReport = async () => {
  console.log('Generating weekly HR email report...');
  try {
    // 1. Gather stats
    const activeEmployees = await User.countDocuments({ role: 'employee', isActive: true });
    
    // Tasks stats
    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'Completed' });
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Leaves stats
    const pendingLeaves = await LeaveRequest.countDocuments({ status: 'Pending' });

    // Last 7 days total logged work hours
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogs = await WorkLog.find({ date: { $gte: sevenDaysAgo } });
    const totalHoursLogged = recentLogs.reduce((sum, curr) => sum + (curr.totalHours || 0), 0);

    // 2. Fetch HR emails
    const hrUsers = await User.find({ role: 'hr', isActive: true });
    const recipientEmails = hrUsers.map(u => u.companyEmail);

    if (recipientEmails.length === 0) {
      console.log('No active HR recipient emails found to send weekly report.');
      return;
    }

    // 3. Construct HTML email body
    const emailHtml = `
      <div style="font-family: 'DM Sans', sans-serif; color: #0D1B3E; background-color: #FDFBF7; padding: 30px; border-radius: 16px; border: 1px solid #D4AF37;">
        <h2 style="font-family: 'Playfair Display', serif; color: #0D1B3E; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;">
          Weekly Performance Operations Report
        </h2>
        <p style="font-size: 14px; color: rgba(13, 27, 62, 0.7); line-height: 1.6;">
          Here is your summary of internal portal operations for the week ending today, ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
        </p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0;">
          <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid rgba(13, 27, 62, 0.08);">
            <span style="font-size: 10px; color: rgba(13, 27, 62, 0.45); font-weight: bold; text-transform: uppercase;">Active Headcount</span>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px; color: #0D1B3E;">${activeEmployees} Employees</div>
          </div>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid rgba(13, 27, 62, 0.08);">
            <span style="font-size: 10px; color: rgba(13, 27, 62, 0.45); font-weight: bold; text-transform: uppercase;">Task Completion Rate</span>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px; color: #10B981;">${completionRate}% (${completedTasks}/${totalTasks})</div>
          </div>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid rgba(13, 27, 62, 0.08);">
            <span style="font-size: 10px; color: rgba(13, 27, 62, 0.45); font-weight: bold; text-transform: uppercase;">Pending Leaves Queue</span>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px; color: #D4AF37;">${pendingLeaves} Applications</div>
          </div>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid rgba(13, 27, 62, 0.08);">
            <span style="font-size: 10px; color: rgba(13, 27, 62, 0.45); font-weight: bold; text-transform: uppercase;">Total Weekly Logged Hours</span>
            <div style="font-size: 24px; font-weight: bold; margin-top: 5px; color: #3B82F6;">${totalHoursLogged.toFixed(1)} Hours</div>
          </div>
        </div>

        <p style="font-size: 11px; color: rgba(13, 27, 62, 0.4); text-align: center; margin-top: 30px; border-top: 1px solid rgba(13, 27, 62, 0.05); padding-top: 15px;">
          This is an automated system broadcast from Teuly Connect Server.
        </p>
      </div>
    `;

    // 4. Send email
    await transporter.sendMail({
      from: '"Teuly Connect" <no-reply@tuely.com>',
      to: recipientEmails.join(','),
      subject: `Weekly Portal Operations Summary - ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
      html: emailHtml,
    });

    console.log(`Weekly operations report email successfully sent to ${recipientEmails.length} HR recipient(s).`);
  } catch (err) {
    console.error('Failed to compile or dispatch weekly HR report:', err);
  }
};

// Cron: Schedule task every Monday at 8:00 AM (0 8 * * 1)
const startWeeklyReporterCron = () => {
  cron.schedule('0 8 * * 1', sendWeeklyReport);
  console.log('⏰ Weekly HR report cron job scheduled to run Mondays at 8:00 AM.');
};

module.exports = {
  startWeeklyReporterCron,
  sendWeeklyReport, // exported for trigger testing if needed
};
