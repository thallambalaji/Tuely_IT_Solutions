import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users, UserCheck, Clock, AlertTriangle, Plus,
  Megaphone, CheckSquare, TrendingUp, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { Sidebar } from '../../components/common/Sidebar';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const StatCard = ({ icon: Icon, label, value, color, bg, trend }) => (
  <motion.div variants={item} className="card-hover">
    <div className="flex items-start justify-between mb-4">
      <div className={`stat-icon ${bg}`}>
        <Icon size={22} className={color} />
      </div>
      {trend && (
        <span className="text-xs font-semibold text-success bg-green-50 px-2 py-1 rounded-lg flex items-center gap-1">
          <TrendingUp size={12} /> {trend}
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-navy font-heading">{value}</p>
    <p className="text-sm text-navy text-opacity-50 font-medium mt-1">{label}</p>
  </motion.div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy text-white px-4 py-3 rounded-xl shadow-xl text-sm">
      <p className="text-gold font-semibold mb-1">{label}</p>
      <p>{payload[0].value} hrs avg</p>
    </div>
  );
};

export default function HRDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, present: 0, pendingLeaves: 0, tasksDue: 0 });
  const [missedLogs, setMissedLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [usersRes, workLogsRes, leavesRes, tasksRes, attendanceRes] = await Promise.all([
          api.get('/users'),
          api.get(`/work-logs?date=${today}`),
          api.get('/leaves'),
          api.get('/tasks'),
          api.get(`/attendance?from=${today}&to=${today}`),
        ]);

        const employees = usersRes.data.filter(u => u.role === 'employee');
        const submittedIds = new Set(workLogsRes.data.map(l => l.employee?._id || l.employee));
        const missing = employees.filter(e => !submittedIds.has(e._id));
        const present = attendanceRes.data.filter(a => a.status === 'Present').length;
        const pendingLeaves = leavesRes.data.filter(l => l.status === 'Pending').length;
        const tasksDue = tasksRes.data.filter(t => {
          const due = new Date(t.dueDate);
          const now = new Date();
          return due <= new Date(now.setDate(now.getDate() + 1)) && t.status !== 'Completed';
        }).length;

        setStats({ total: employees.length, present, pendingLeaves, tasksDue });
        setMissedLogs(missing);
        setRecentLeaves(leavesRes.data.filter(l => l.status === 'Pending').slice(0, 4));

        // Mock weekly chart data (replace with real aggregation in Phase 3)
        setChartData([
          { day: 'Mon', hours: 7.2 }, { day: 'Tue', hours: 8.1 },
          { day: 'Wed', hours: 6.8 }, { day: 'Thu', hours: 8.5 },
          { day: 'Fri', hours: 7.9 }, { day: 'Sat', hours: 4.2 },
        ]);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-navy text-opacity-60 font-medium">Loading dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 min-h-screen bg-cream p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="font-heading text-navy text-4xl font-bold">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="text-gold">{user?.fullName?.split(' ')[0]}</span>
          </h1>
          <p className="text-navy text-opacity-50 mt-1">Here's your team overview for today.</p>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
        >
          <StatCard icon={Users}        label="Total Employees"   value={stats.total}        color="text-navy"    bg="bg-navy bg-opacity-10" trend="+2 this month" />
          <StatCard icon={UserCheck}    label="Present Today"     value={stats.present}      color="text-success" bg="bg-green-50" />
          <StatCard icon={Clock}        label="Pending Leaves"    value={stats.pendingLeaves} color="text-warning"  bg="bg-orange-50" />
          <StatCard icon={CheckSquare}  label="Tasks Due Today"   value={stats.tasksDue}     color="text-error"   bg="bg-red-50" />
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Weekly Productivity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card xl:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-navy text-xl font-bold">Team Productivity</h2>
                <p className="text-navy text-opacity-50 text-sm mt-0.5">Average hours per employee this week</p>
              </div>
              <span className="badge-gold">This Week</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(13,27,62,0.06)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#0D1B3E', opacity: 0.5 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#0D1B3E', opacity: 0.5 }} unit="h" />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(201,168,76,0.06)' }} />
                <Bar dataKey="hours" fill="#C9A84C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pending Leaves */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-navy text-xl font-bold">Pending Leaves</h2>
              <button onClick={() => navigate('/hr/leaves')} className="text-gold text-xs font-semibold hover:underline">View All</button>
            </div>
            {recentLeaves.length === 0 ? (
              <div className="text-center py-8 text-navy text-opacity-40">
                <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLeaves.map((leave) => (
                  <div key={leave._id} className="flex items-start gap-3 p-3 bg-cream rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center text-gold font-bold text-xs flex-shrink-0">
                      {leave.employee?.fullName?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy text-sm truncate">{leave.employee?.fullName}</p>
                      <p className="text-xs text-navy text-opacity-50">{leave.leaveType} · {new Date(leave.fromDate).toLocaleDateString()}</p>
                    </div>
                    <span className="badge-warning text-xs">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Employees Without Work Log */}
        {missedLogs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="card border-l-4 border-error mb-8"
          >
            <div className="flex items-center gap-3 mb-5">
              <AlertTriangle size={20} className="text-error" />
              <div>
                <h2 className="font-heading text-navy text-xl font-bold">No Work Log Submitted Today</h2>
                <p className="text-navy text-opacity-50 text-sm">{missedLogs.length} employee{missedLogs.length !== 1 ? 's' : ''} haven't submitted yet</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {missedLogs.map((emp) => (
                <div key={emp._id} className="flex flex-col items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="w-10 h-10 rounded-full bg-error flex items-center justify-center text-white font-bold text-sm">
                    {emp.fullName?.[0]}
                  </div>
                  <p className="text-navy text-xs font-semibold text-center leading-tight">{emp.fullName}</p>
                  <p className="text-navy text-opacity-40 text-xs">{emp.designation || emp.department}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="font-heading text-navy text-xl font-bold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Add Employee',       icon: Plus,        to: '/hr/employees',    cls: 'btn-primary' },
              { label: 'Post Announcement',  icon: Megaphone,   to: '/hr/announcements', cls: 'btn-secondary' },
              { label: 'Assign Task',        icon: CheckSquare, to: '/hr/tasks',         cls: 'btn-gold' },
              { label: 'Mark Attendance',    icon: Calendar,    to: '/hr/attendance',    cls: 'btn-ghost border border-navy border-opacity-20' },
            ].map(({ label, icon: Icon, to, cls }) => (
              <button key={label} onClick={() => navigate(to)} className={cls}>
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
