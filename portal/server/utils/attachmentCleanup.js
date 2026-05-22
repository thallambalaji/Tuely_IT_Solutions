const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const Attachment = require('../models/Attachment');

function startAttachmentCleanup() {
  console.log('⏰ Attachment Cleanup Scheduler started: Runs every 10 minutes.');

  // Run cleanup every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      const attachDir = path.join(__dirname, '../uploads/attachments');
      if (!fs.existsSync(attachDir)) return;

      const filesOnDisk = fs.readdirSync(attachDir);
      if (filesOnDisk.length === 0) return;

      // Query database for all attachments matching filenames on disk
      const activeAttachments = await Attachment.find({ fileName: { $in: filesOnDisk } }).select('fileName');
      const activeFileNames = new Set(activeAttachments.map(a => a.fileName));

      let deletedCount = 0;
      filesOnDisk.forEach(file => {
        // If file exists on disk but is no longer in the DB, it is an orphan (expired or deleted)
        if (!activeFileNames.has(file)) {
          const filePath = path.join(attachDir, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch (e) {
            console.error(`⚠️ Failed to delete orphan attachment file ${file}:`, e.message);
          }
        }
      });

      if (deletedCount > 0) {
        console.log(`🧹 Attachment Cleanup: Deleted ${deletedCount} orphan attachment files from disk.`);
      }
    } catch (err) {
      console.error('❌ Attachment Cleanup job error:', err.message);
    }
  });
}

module.exports = { startAttachmentCleanup };
