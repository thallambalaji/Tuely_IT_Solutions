import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, ClipboardList, Calendar, MessageCircle,
  FileText, Bell, BarChart3, LogOut, ChevronLeft, Megaphone,
  CheckSquare, Sun, Moon, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const HR_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',    to: '/hr/dashboard' },
  { icon: Users,           label: 'Employees',    to: '/hr/employees' },
  { icon: CheckSquare,     label: 'Tasks',        to: '/hr/tasks' },
  { icon: ClipboardList,   label: 'Work Logs',    to: '/hr/work-logs' },
  { icon: Calendar,        label: 'Attendance',   to: '/hr/attendance' },
  { icon: FileText,        label: 'Leave Mgmt',   to: '/hr/leaves' },
  { icon: Megaphone,       label: 'Announcements',to: '/hr/announcements' },
  { icon: BarChart3,       label: 'Reports',      to: '/hr/reports' },
  { icon: MessageCircle,   label: 'Messages',     to: '/hr/messages' },
];

const EMP_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard',    to: '/employee/dashboard' },
  { icon: CheckSquare,     label: 'My Tasks',     to: '/employee/tasks' },
  { icon: ClipboardList,   label: 'Work Log',     to: '/employee/work-log' },
  { icon: BarChart3,       label: 'My Reports',   to: '/employee/reports' },
  { icon: FileText,        label: 'Leave',        to: '/employee/leave' },
  { icon: MessageCircle,   label: 'Messages',     to: '/employee/messages' },
  { icon: Users,           label: 'My Profile',   to: '/employee/profile' },
];

export const Sidebar = () => {
  const { user, logout, darkMode, toggleDark } = useAuth();
  const { notifications } = useSocket();
  const [collapsed, setCollapsed] = useState(false);
  const nav = user?.role === 'hr' ? HR_NAV : EMP_NAV;

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-navy flex flex-col z-40 overflow-hidden shadow-2xl"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white border-opacity-10">
        <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="font-heading font-bold text-navy text-xl">T</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <p className="font-heading text-white font-semibold text-lg leading-tight">Teuly</p>
              <p className="text-gold text-xs font-medium tracking-widest uppercase">Connect</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 pt-4 pb-2">
          <span className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full ${user?.role === 'hr' ? 'bg-gold text-navy' : 'bg-white bg-opacity-10 text-white'}`}>
            {user?.role === 'hr' ? '👔 HR Portal' : '👤 Employee'}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ icon: Icon, label, to }) => (
          <NavLink key={to} to={to}>
            {({ isActive }) => (
              <motion.div
                whileHover={{ x: collapsed ? 0 : 4 }}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Controls */}
      <div className="px-3 py-4 border-t border-white border-opacity-10 space-y-2">
        {/* Dark mode toggle */}
        <button onClick={toggleDark} className="sidebar-link w-full">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          {!collapsed && <span className="text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* Back to main site */}
        <a href="/" target="_blank" rel="noopener noreferrer" className="sidebar-link">
          <ExternalLink size={20} />
          {!collapsed && <span className="text-sm">Main Website</span>}
        </a>

        {/* Logout */}
        <button onClick={logout} className="sidebar-link hover:bg-red-500 hover:bg-opacity-20 w-full">
          <LogOut size={20} />
          {!collapsed && <span className="text-sm">Sign Out</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gold rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
      >
        <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronLeft size={14} className="text-navy" />
        </motion.div>
      </button>
    </motion.aside>
  );
};

export default Sidebar;
