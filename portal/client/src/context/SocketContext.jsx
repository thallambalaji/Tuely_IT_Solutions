import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../socket/socket';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef(new Map());
  const socket = getSocket();

  // Add a notification to state (max 10, no duplicates)
  const addNotification = useCallback((item) => {
    setNotifications(prev => {
      if (prev.some(n => n.id === item.id)) return prev;
      setUnreadCount(c => c + 1);
      return [item, ...prev].slice(0, 10);
    });
  }, []);

  // On mount: load missed notifications from DB
  useEffect(() => {
    if (!user) return;
    const loadMissedNotifications = async () => {
      try {
        const { data } = await api.get('/notifications?unread=true');
        if (data.length > 0) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newOnes = data
              .filter(n => !existingIds.has(n._id))
              .map(n => ({
                id: n._id,
                type: n.type,
                message: n.message,
                link: n.link,
                icon: n.icon,
                timestamp: new Date(n.createdAt),
                isRead: n.isRead,
              }));
            return [...newOnes, ...prev].slice(0, 10);
          });
          setUnreadCount(data.filter(n => !n.isRead).length);
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };
    loadMissedNotifications();
  }, [user?._id]);

  useEffect(() => {
    if (!user) return;

    // ── Online/Offline ────────────────────────────────────────────
    socket.on('user_online',  ({ userId }) => setOnlineUsers(s => new Set([...s, userId])));
    socket.on('user_offline', ({ userId }) => setOnlineUsers(s => { const n = new Set(s); n.delete(userId); return n; }));
    socket.on('online_users_list', ({ onlineUsers }) => setOnlineUsers(new Set(onlineUsers)));

    // ── Missed notifications delivered on reconnect ───────────────
    socket.on('missed_notifications', ({ notifications: missed }) => {
      missed.forEach(n => {
        addNotification({
          id: n._id || Math.random().toString(),
          type: n.type,
          message: n.message,
          link: n.link || '',
          icon: n.icon || 'bell',
          timestamp: new Date(n.createdAt),
          isRead: n.isRead,
        });
      });
    });

    // ── Chat Message Notification ─────────────────────────────────
    socket.on('notification', (notif) => {
      if (notif.type === 'message') {
        addNotification({
          id: Math.random().toString(),
          type: 'message',
          message: `New message from ${notif.from}`,
          link: '/messages',
          icon: 'message',
          timestamp: new Date(),
          isRead: false,
        });
      }
    });

    // ── Task Events ───────────────────────────────────────────────
    socket.on('task_assigned', ({ task }) => {
      addNotification({
        id: Math.random().toString(),
        type: 'task_assigned',
        message: `HR assigned you a new task: "${task?.title || 'New Task'}"`,
        link: '/employee/tasks',
        icon: 'clipboard',
        timestamp: new Date(),
        isRead: false,
      });
    });

    socket.on('task_updated', ({ task }) => {
      addNotification({
        id: Math.random().toString(),
        type: 'task_updated',
        message: `Your task "${task?.title}" was edited by HR`,
        link: '/employee/tasks',
        icon: 'edit',
        timestamp: new Date(),
        isRead: false,
      });
    });

    socket.on('task_deleted', ({ taskTitle }) => {
      addNotification({
        id: Math.random().toString(),
        type: 'task_deleted',
        message: `Your task "${taskTitle || ''}" was removed by HR`,
        link: '/employee/tasks',
        icon: 'trash',
        timestamp: new Date(),
        isRead: false,
      });
    });

    socket.on('task_status_change', ({ taskTitle, status, employeeName }) => {
      if (user.role === 'hr') {
        addNotification({
          id: Math.random().toString(),
          type: 'task_status_change',
          message: `${employeeName} updated "${taskTitle}" to ${status}`,
          link: '/hr/tasks',
          icon: 'check-circle',
          timestamp: new Date(),
          isRead: false,
        });
      }
    });

    // ── Leave Events ──────────────────────────────────────────────
    socket.on('leave_requested', ({ employeeName, leaveType, totalDays, title }) => {
      if (user.role === 'hr') {
        addNotification({
          id: Math.random().toString(),
          type: 'leave_requested',
          message: `${employeeName} requested ${totalDays}d ${leaveType} leave: "${title}"`,
          link: '/hr/leaves',
          icon: 'calendar',
          timestamp: new Date(),
          isRead: false,
        });
      }
    });

    socket.on('leave_decision', ({ status, message }) => {
      addNotification({
        id: Math.random().toString(),
        type: 'leave_decision',
        message: message || `Your leave request was ${status}`,
        link: '/employee/leave',
        icon: status === 'Approved' ? 'check' : 'x',
        timestamp: new Date(),
        isRead: false,
      });
    });

    // ── Announcement Events ───────────────────────────────────────
    socket.on('announcement_posted', ({ announcement }) => {
      if (user.role === 'employee') {
        addNotification({
          id: Math.random().toString(),
          type: 'announcement_posted',
          message: `New announcement: "${announcement?.title}"`,
          link: '/employee/dashboard',
          icon: 'megaphone',
          timestamp: new Date(),
          isRead: false,
        });
      }
    });

    // ── Work Log Events ───────────────────────────────────────────
    socket.on('worklog_submitted', ({ employeeName, date }) => {
      if (user.role === 'hr') {
        addNotification({
          id: Math.random().toString(),
          type: 'worklog_submitted',
          message: `${employeeName} submitted their work log`,
          link: '/hr/work-logs',
          icon: 'clock',
          timestamp: new Date(),
          isRead: false,
        });
      }
    });

    // ── System Events ─────────────────────────────────────────────
    socket.on('force_logout', () => { window.location.href = '/login?reason=deactivated'; });
    socket.on('password_changed', ({ message }) => {
      alert(message || 'Your password has been changed by HR.');
    });

    return () => {
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('online_users_list');
      socket.off('missed_notifications');
      socket.off('notification');
      socket.off('task_assigned');
      socket.off('task_updated');
      socket.off('task_deleted');
      socket.off('task_status_change');
      socket.off('leave_requested');
      socket.off('leave_decision');
      socket.off('announcement_posted');
      socket.off('worklog_submitted');
      socket.off('force_logout');
      socket.off('password_changed');
    };
  }, [user, addNotification]);

  const on = (event, handler) => {
    socket.on(event, handler);
    listenersRef.current.set(`${event}_${Date.now()}`, { event, handler });
  };

  const off = (event, handler) => {
    socket.off(event, handler);
  };

  const emit = (event, data) => socket.emit(event, data);

  const deleteNotification = async (id) => {
    setNotifications(prev => {
      const item = prev.find(n => n.id === id);
      if (item && !item.isRead) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter(n => n.id !== id);
    });
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const clearNotifications = () => { setNotifications([]); setUnreadCount(0); };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await api.put('/notifications/mark-all-read'); } catch (_) {}
  };

  const markOneAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
    try { await api.put(`/notifications/${id}/read`); } catch (_) {}
  };

  return (
    <SocketContext.Provider value={{
      socket, onlineUsers, notifications, unreadCount,
      on, off, emit, clearNotifications, markAllAsRead, markOneAsRead, addNotification, deleteNotification
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
