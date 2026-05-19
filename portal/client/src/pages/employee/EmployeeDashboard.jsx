import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Plus, CheckCircle, Clock, TrendingUp, Megaphone, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sidebar } from '../../components/common/Sidebar';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { notifications, onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [data, setData] = useState({ tasks: [], todayLog: null, announcements: [], weeklyHours: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [tasksRes, logsRes, annRes] = await Promise.all([
          api.get('/tasks'),
          api.get(`/work-logs?date=${today}`),
          api.get('/announcements'),
        ]);

        const todayLog = logsRes.data?.[0] || null;
        setData({
          tasks: tasksRes.data,
          todayLog,
          announcements: annRes.data,
          weeklyHours: [
            { day: 'Mon', hours: 0 }, { day: 'Tue', hours: 0 },
            { day: 'Wed', hours: 0 }, { day: 'Thu', hours: 0 },
            { day: 'Fri', hours: todayLog?.totalHours || 0 },
          ],
        });
      } catch (err) {
        console.error('Employee dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const isOnline = onlineUsers.has(user?._id);
  const pendingTasks = data.tasks.filter(t => t.status !== 'Completed').length;
  const completedTasks = data.tasks.filter(t => t.status === 'Completed').length;
  const pinnedAnn = data.announcements.filter(a => a.isPinned);

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 min-h-screen bg-cream p-8">

        {/* Pinned Announcements Banner */}
        {pinnedAnn.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-navy bg-opacity-5 border border-navy border-opacity-10 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3"
          >
            <Megaphone size={20} className="text-gold flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-navy text-sm">{pinnedAnn[0].title}</p>
              <p className="text-navy text-opacity-60 text-sm mt-0.5">{pinnedAnn[0].content}</p>
            </div>
          </motion.div>
        )}

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mb-8 relative overflow-hidden"
        >
          {/* Background pattern */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-navy rounded-full opacity-5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gold rounded-full opacity-5 translate-y-1/2 -translate-x-1/2" />

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-navy flex items-center justify-center text-gold font-heading font-bold text-4xl shadow-lg overflow-hidden">
                {user?.profilePhoto
                  ? <img src={user.profilePhoto} alt={user.fullName} className="w-full h-full object-cover" />
                  : user?.fullName?.[0]
                }
              </div>
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${isOnline ? 'bg-success animate-pulse-gold' : 'bg-gray-400'}`} />
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="font-heading text-navy text-3xl font-bold">{user?.fullName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className={user?.department === 'IT' ? 'badge-it' : 'badge-non-it'}>{user?.department}</span>
                <span className="text-navy text-opacity-60 text-sm font-medium">{user?.designation || 'Team Member'}</span>
                <span className="text-navy text-opacity-40 text-sm">·</span>
                <span className="text-navy text-opacity-60 text-sm">
                  Joined {user?.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
                <span className="text-navy text-opacity-50 text-sm flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded bg-navy bg-opacity-10 flex items-center justify-center text-xs">✉</span>
                  {user?.companyEmail}
                </span>
                {user?.phone && (
                  <span className="text-navy text-opacity-50 text-sm flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-navy bg-opacity-10 flex items-center justify-center text-xs">☎</span>
                    {user.phone}
                  </span>
                )}
              </div>
            </div>

            {/* Today's Log Status */}
            <div className="sm:text-right">
              {data.todayLog ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <CheckCircle size={24} className="text-success mx-auto mb-1" />
                  <p className="text-success font-bold text-sm">Log Submitted</p>
                  <p className="text-navy text-opacity-50 text-xs mt-1">{data.todayLog.totalHours}h logged today</p>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/employee/work-log')}
                  className="bg-gold text-navy font-bold px-5 py-3 rounded-xl text-sm shadow-gold flex items-center gap-2"
                >
                  <ClipboardList size={18} />
                  Log Today's Work
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {[
            { icon: Clock,         label: "Today's Hours", value: data.todayLog?.totalHours?.toFixed(1) || '—',  bg: 'bg-blue-50',   color: 'text-blue-600' },
            { icon: CheckCircle,   label: 'Tasks This Week', value: data.tasks.length,                            bg: 'bg-navy bg-opacity-10', color: 'text-navy' },
            { icon: TrendingUp,    label: 'Completed',      value: completedTasks,                                bg: 'bg-green-50',  color: 'text-success' },
            { icon: Calendar,      label: 'Pending',        value: pendingTasks,                                  bg: 'bg-orange-50', color: 'text-warning' },
          ].map(({ icon: Icon, label, value, bg, color }) => (
            <motion.div key={label} variants={item} className="card-hover">
              <div className={`stat-icon ${bg} mb-3`}><Icon size={20} className={color} /></div>
              <p className="text-3xl font-bold text-navy font-heading">{value}</p>
              <p className="text-sm text-navy text-opacity-50 mt-1">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Weekly Hours Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
          >
            <h2 className="font-heading text-navy text-xl font-bold mb-5">Weekly Hours</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weeklyHours} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,27,62,0.06)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#0D1B3E', opacity: 0.5 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#0D1B3E', opacity: 0.5 }} unit="h" />
                <Tooltip cursor={{ fill: 'rgba(201,168,76,0.06)' }} />
                <Bar dataKey="hours" fill="#0D1B3E" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Recent Tasks */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-navy text-xl font-bold">My Tasks</h2>
              <button onClick={() => navigate('/employee/tasks')} className="text-gold text-xs font-semibold hover:underline">View All</button>
            </div>
            {data.tasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle size={40} className="mx-auto mb-3 text-navy opacity-20" />
                <p className="text-navy text-opacity-40 text-sm">No tasks assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.tasks.slice(0, 4).map((task) => (
                  <div key={task._id} className="flex items-center gap-3 p-3 bg-cream rounded-xl">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'Urgent' ? 'bg-error' : task.priority === 'High' ? 'bg-warning' : 'bg-gold'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy text-sm truncate">{task.title}</p>
                      <p className="text-navy text-opacity-40 text-xs">Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg ${task.status === 'Completed' ? 'bg-green-100 text-success' : task.status === 'In Progress' ? 'bg-gold-soft text-navy' : 'bg-gray-100 text-gray-500'}`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

      </main>
    </div>
  );
}
