import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, Calendar, MessageSquare, AlertCircle, Sparkles, Clock, Megaphone, Key } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Header = ({ title }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllAsRead, markOneAsRead, clearNotifications } = useSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const ICON_MAP = {
    task_assigned: <Sparkles size={16} className="text-gold" />,
    task_updated: <Sparkles size={16} className="text-gold" />,
    task_deleted: <AlertCircle size={16} className="text-error" />,
    task_status_change: <Check size={16} className="text-success" />,
    leave_requested: <Calendar size={16} className="text-blue-500" />,
    leave_decision: <Calendar size={16} className="text-blue-500" />,
    announcement_posted: <Megaphone size={16} className="text-gold" />,
    worklog_submitted: <Clock size={16} className="text-navy" />,
    password_changed: <Key size={16} className="text-error" />,
    message: <MessageSquare size={16} className="text-navy" />,
    default: <Bell size={16} className="text-navy/60" />,
  };

  const getNotificationIcon = (notif) => {
    return ICON_MAP[notif.type] || ICON_MAP.default;
  };

  return (
    <header className="flex justify-between items-center mb-8 pb-4 border-b border-navy border-opacity-5">
      <div>
        <p className="text-gold text-xs font-semibold tracking-widest uppercase mb-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="font-heading text-navy text-3xl font-bold leading-none">{title}</h1>
      </div>

      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
        {/* Notification Bell */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2.5 bg-white text-navy hover:text-gold rounded-xl shadow-card hover:shadow-card-hover transition-all duration-200"
          title="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-error text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce shadow-md">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Popover */}
        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 top-12 w-80 bg-white border border-navy border-opacity-10 rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <div className="flex justify-between items-center px-4 py-3 border-b border-navy border-opacity-10 bg-navy bg-opacity-5">
                <p className="font-heading font-bold text-navy text-sm">Notifications</p>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-gold hover:text-gold-light text-xs font-bold flex items-center gap-1"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-navy text-opacity-40 text-xs">
                    <Bell size={32} className="mx-auto mb-2 opacity-25" />
                    No recent notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => {
                        markOneAsRead && markOneAsRead(notif.id);
                        if (notif.link) navigate(notif.link);
                        setShowDropdown(false);
                      }}
                      className={`w-full flex gap-3 px-4 py-3 border-b border-navy border-opacity-5 hover:bg-cream transition-colors text-left relative ${
                        !notif.isRead ? 'bg-gold bg-opacity-[0.03]' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-cream flex items-center justify-center flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notif)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs text-navy leading-normal ${!notif.isRead ? 'font-bold' : ''}`}>
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-navy text-opacity-45 mt-1">
                          {notif.timestamp ? new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <span className="absolute top-4 right-4 w-2 h-2 bg-gold rounded-full" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-2 border-t border-navy border-opacity-5 text-center">
                  <button
                    onClick={clearNotifications}
                    className="w-full py-2 hover:bg-red-50 text-error font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={12} /> Clear all history
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Profile Summary Bubble */}
        <div className="flex items-center gap-2 border-l border-navy border-opacity-10 pl-4">
          <div className="w-10 h-10 rounded-full bg-navy text-gold font-bold flex items-center justify-center flex-shrink-0 text-sm overflow-hidden">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              user?.fullName?.[0] || '?'
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="font-heading font-bold text-navy text-xs leading-none">{user?.fullName}</p>
            <span className="text-[10px] text-navy text-opacity-50 font-semibold uppercase mt-1 inline-block">
              {user?.role === 'hr' ? '👔 HR Manager' : '👤 Employee'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
