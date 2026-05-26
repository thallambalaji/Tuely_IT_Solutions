import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Download, FileText, CheckSquare, Users, Calendar, Clock, Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import api from '../../utils/api';

const COLORS = ['#0D1B3E', '#D4AF37', '#10B981', '#EF4444']; // Navy, Gold, Green, Red

export default function HRReports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingLeaves: 0,
  });

  // Recharts Data States
  const [departmentData, setDepartmentData] = useState([]);
  const [attendancePieData, setAttendancePieData] = useState([]);
  const [weeklyWorklogsData, setWeeklyWorklogsData] = useState([]);

  const dashboardRef = useRef(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const getLocalDateString = (d = new Date()) => {
        const pad = (num) => String(num).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const todayStr = getLocalDateString();

      const [usersRes, tasksRes, leavesRes, attendanceRes, logsRes] = await Promise.all([
        api.get('/users'),
        api.get('/tasks'),
        api.get('/leaves'),
        api.get(`/attendance?from=${todayStr}&to=${todayStr}`),
        api.get('/work-logs')
      ]);

      const employees = usersRes.data.filter(u => u.role === 'employee');
      const totalEmp = employees.length;

      const completedT = tasksRes.data.filter(t => t.status === 'Completed').length;
      const activeT = tasksRes.data.length - completedT;
      const pendingL = leavesRes.data.filter(l => l.status === 'Pending').length;

      setStats({
        totalEmployees: totalEmp,
        activeTasks: activeT,
        completedTasks: completedT,
        pendingLeaves: pendingL
      });

      // Calculate department counts
      const deptCounts = { IT: 0, 'Non-IT': 0, Management: 0, Operations: 0 };
      employees.forEach(emp => {
        if (deptCounts.hasOwnProperty(emp.department)) {
          deptCounts[emp.department]++;
        }
      });
      setDepartmentData(Object.entries(deptCounts).map(([name, value]) => ({ name, count: value })));

      // Calculate today's attendance stats
      const attStats = { Present: 0, Absent: 0, 'Half Day': 0, Leave: 0 };
      attendanceRes.data.forEach(r => {
        if (attStats.hasOwnProperty(r.status)) {
          attStats[r.status]++;
        }
      });
      // Filter out zero entries
      const pieData = Object.entries(attStats)
        .map(([name, value]) => ({ name, value }))
        .filter(entry => entry.value > 0);
      
      // Fallback if no records today
      setAttendancePieData(pieData.length > 0 ? pieData : [
        { name: 'Present', value: 0 },
        { name: 'Absent', value: 0 },
        { name: 'Half Day', value: 0 },
        { name: 'Leave', value: 0 }
      ]);

      // Calculate last 7 days daily worklogs sum
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      const dailyHours = last7Days.map(dateStr => {
        const dayLogs = logsRes.data.filter(log => new Date(log.date).toISOString().split('T')[0] === dateStr);
        const hours = dayLogs.reduce((sum, current) => sum + (current.totalHours || 0), 0);
        return {
          date: new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
          hours: Number(hours.toFixed(1))
        };
      });
      setWeeklyWorklogsData(dailyHours);

    } catch (err) {
      console.error('Failed to load analytical reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Export Dashboard container to PDF
  const handleExportPDF = async () => {
    const element = dashboardRef.current;
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const getLocalDateString = (d = new Date()) => {
        const pad = (num) => String(num).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      pdf.save(`HR_Performance_Report_${getLocalDateString()}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden flex flex-col min-h-screen">
        
        {/* Header bar */}
        <Header title="HR Performance & Analytics" />

        {/* Action Trigger Bar */}
        <div className="flex justify-between items-center mb-8">
          <p className="text-navy text-opacity-50 text-sm">Visualize department headcount, system logs, and task completions.</p>
          <button
            onClick={handleExportPDF}
            className="btn-gold flex items-center gap-2"
          >
            <Download size={16} /> Download PDF Report
          </button>
        </div>

        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center flex-1">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Compiling analytical metrics...</p>
          </div>
        ) : (
          <div ref={dashboardRef} className="space-y-8 bg-cream bg-opacity-40 p-4 rounded-3xl">
            
            {/* ─── Metric summary rows ─────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Employees', value: stats.totalEmployees, icon: Users, color: 'text-navy', bg: 'bg-navy bg-opacity-5' },
                { label: 'Pending Leave Applications', value: stats.pendingLeaves, icon: Calendar, color: 'text-gold', bg: 'bg-gold-soft bg-opacity-25' },
                { label: 'Completed Tasks', value: stats.completedTasks, icon: CheckSquare, color: 'text-success', bg: 'bg-green-50' },
                { label: 'Active Work Tasks', value: stats.activeTasks, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="card flex items-center justify-between shadow-card">
                  <div>
                    <span className="text-[10px] text-navy text-opacity-45 uppercase font-bold tracking-wider">{label}</span>
                    <p className="text-3xl font-bold font-heading text-navy mt-1">{value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center ${color}`}>
                    <Icon size={20} />
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Recharts Grid ───────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
              
              {/* Department Headcount Bar Chart */}
              <div className="card">
                <h3 className="font-heading text-navy text-base font-bold mb-6 flex items-center gap-1.5">
                  <Users size={16} className="text-gold" /> Headcount by Department
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                      <XAxis dataKey="name" stroke="#0D1B3E" strokeOpacity={0.5} fontSize={11} />
                      <YAxis stroke="#0D1B3E" strokeOpacity={0.5} fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#0D1B3E', color: '#fff', borderRadius: '12px' }} />
                      <Bar dataKey="count" fill="#0D1B3E" radius={[6, 6, 0, 0]}>
                        {departmentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'IT' ? '#0D1B3E' : '#D4AF37'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly Work Hours Line Chart */}
              <div className="card">
                <h3 className="font-heading text-navy text-base font-bold mb-6 flex items-center gap-1.5">
                  <Clock size={16} className="text-gold" /> Weekly Sum of Work Hours Logged
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyWorklogsData}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                      <XAxis dataKey="date" stroke="#0D1B3E" strokeOpacity={0.5} fontSize={11} />
                      <YAxis stroke="#0D1B3E" strokeOpacity={0.5} fontSize={11} />
                      <Tooltip contentStyle={{ background: '#0D1B3E', color: '#fff', borderRadius: '12px' }} />
                      <Line type="monotone" dataKey="hours" stroke="#D4AF37" strokeWidth={3} dot={{ fill: '#0D1B3E', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Today's Attendance breakdown Pie Chart */}
              <div className="card lg:col-span-2">
                <h3 className="font-heading text-navy text-base font-bold mb-6 flex items-center gap-1.5">
                  <Calendar size={16} className="text-gold" /> Daily Attendance Breakdown
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={attendancePieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {attendancePieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0D1B3E', color: '#fff', borderRadius: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Legend list */}
                  <div className="space-y-4">
                    {attendancePieData.map((entry, index) => (
                      <div key={entry.name} className="flex justify-between items-center text-sm border-b border-navy border-opacity-5 pb-2">
                        <span className="flex items-center gap-2">
                          <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="font-semibold text-navy">{entry.name}</span>
                        </span>
                        <span className="font-heading font-bold text-navy text-base">{entry.value} Employees</span>
                      </div>
                    ))}
                    {attendancePieData.every(e => e.value === 0) && (
                      <p className="text-xs text-navy text-opacity-40 italic">No attendance records submitted today.</p>
                    )}
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
