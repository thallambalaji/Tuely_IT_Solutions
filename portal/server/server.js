require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// ── Route imports ───────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const workLogRoutes      = require('./routes/workLogs');
const taskRoutes         = require('./routes/tasks');
const attendanceRoutes   = require('./routes/attendance');
const leaveRoutes        = require('./routes/leaves');
const announcementRoutes = require('./routes/announcements');
const messageRoutes      = require('./routes/messages');
const groupRoutes        = require('./routes/groups');
const notificationRoutes = require('./routes/notifications');
const fileRoutes         = require('./routes/files');
const socketHandler      = require('./socket/socketHandler');
const { startWeeklyReporterCron } = require('./utils/emailReporter');
const attachmentRoutes   = require('./routes/attachments');
const { startAttachmentCleanup } = require('./utils/attachmentCleanup');

// ── Model imports (for index creation) ─────────────────────────
const User         = require('./models/User');
const Message      = require('./models/Message');
const Attachment   = require('./models/Attachment');
const GroupMessage = require('./models/GroupMessage');
const WorkLog      = require('./models/WorkLog');
const Task         = require('./models/Task');
const Attendance   = require('./models/Attendance');
const LeaveRequest = require('./models/LeaveRequest');
const Announcement = require('./models/Announcement');
const Notification = require('./models/Notification');

const app = express();
const server = http.createServer(app);

// ── Ensure all upload directories exist ─────────────────────────
const uploadsBase = path.join(__dirname, 'uploads');
['profiles', 'resumes', 'attachments'].forEach(dir => {
  const dirPath = path.join(uploadsBase, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

const allowedOrigins = [
  'http://localhost:5173',
  'https://tuely.netlify.app'
];
if (process.env.CLIENT_URL) {
  const sanitizedClientUrl = process.env.CLIENT_URL.replace(/\/$/, '');
  allowedOrigins.push(sanitizedClientUrl);
}

// ── Socket.IO ───────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
socketHandler(io);
app.set('io', io);

// ── Middleware ──────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── IMPORTANT: Do NOT serve /uploads/ as static (security) ─────
// All file access goes through the authenticated /api/files/ route

// ── Routes ─────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/work-logs',     workLogRoutes);
app.use('/api/tasks',         taskRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/leaves',        leaveRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/groups',        groupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/files',         fileRoutes); // protected file serving
app.use('/api/attachments',   attachmentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Background job: hard-delete soft-deleted accounts after 24h ─
setInterval(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await User.deleteMany({
        isActive: false,
        updatedAt: { $lt: twentyFourHoursAgo }
      });
      if (result.deletedCount > 0) {
        console.log(`🧹 Hard-deleted ${result.deletedCount} soft-deleted accounts older than 24 hours.`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to clean up soft-deleted users:', err.message);
  }
}, 60 * 60 * 1000); // Check every hour

// ── MongoDB Indexes: created on startup after connect ───────────
async function createIndexes() {
  try {
    console.log('📊 Creating MongoDB indexes...');

    // TTL indexes — auto-delete messages after 14 days
    await Message.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    await GroupMessage.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
    await Attachment.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });

    // Attachment performance indexes
    await Attachment.collection.createIndex({ senderId: 1 }, { background: true });
    await Attachment.collection.createIndex({ receiverId: 1 }, { background: true });
    await Attachment.collection.createIndex({ groupId: 1 }, { background: true });
    await Attachment.collection.createIndex({ channelId: 1 }, { background: true });

    // Performance indexes
    await User.collection.createIndex({ employeeId: 1 }, { unique: true, sparse: true, background: true });
    await User.collection.createIndex({ companyEmail: 1 }, { unique: true, background: true });
    await WorkLog.collection.createIndex({ employee: 1, date: -1 }, { background: true });
    await Task.collection.createIndex({ assignedTo: 1, status: 1 }, { background: true });
    await Attendance.collection.createIndex({ employee: 1, date: -1 }, { background: true });
    await LeaveRequest.collection.createIndex({ employee: 1, status: 1 }, { background: true });
    await Message.collection.createIndex({ conversationId: 1, createdAt: -1 }, { background: true });
    await GroupMessage.collection.createIndex({ groupId: 1, createdAt: -1 }, { background: true });
    await Announcement.collection.createIndex({ audience: 1, createdAt: -1 }, { background: true });
    await Notification.collection.createIndex({ recipient: 1, isRead: 1, createdAt: -1 }, { background: true });

    console.log('✅ All MongoDB indexes created/verified.');
  } catch (err) {
    console.error('⚠️  Index creation warning:', err.message);
    // Non-fatal — server continues even if index creation fails
  }
}

// ── MongoDB + Server Start ──────────────────────────────────────
const startServer = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI not set. Running without DB.');
  } else {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('✅ MongoDB connected');
      await createIndexes();
      startWeeklyReporterCron();
      startAttachmentCleanup();
    } catch (err) {
      console.error('❌ MongoDB connection failed:', err.message);
      if (process.env.NODE_ENV === 'production') process.exit(1);
      else console.warn('⚠️  Running in development without DB.');
    }
  }

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Teuly Connect Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
};

startServer();
