import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon, Clock, CheckCircle2, AlertTriangle, Info,
  TrendingUp, Award, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import api from '../../utils/api';

export default function EmployeeReports() {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [workLogs, setWorkLogs] = useState([]);
  
  // Date state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1); // 1-indexed

  const fetchReports = async () => {
    setLoading(true);
    try {
      const start = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
      const end = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      // Fetch logs
      const [attRes, logsRes] = await Promise.all([
        api.get(`/attendance?from=${start}&to=${end}`),
        api.get(`/work-logs?from=${start}&to=${end}`)
      ]);

      setAttendance(attRes.data);
      setWorkLogs(logsRes.data);
    } catch (err) {
      console.error('Error fetching employee report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedMonth, selectedYear]);

  // Generate calendar grid variables
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const startDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 = Sunday
  
  const calendarDays = [];
  // Fill empty slots before start of month
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Fill actual days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  // Helper: Find attendance record for a specific day
  const getDayRecord = (dayNum) => {
    if (!dayNum) return null;
    const dateStr = new Date(selectedYear, selectedMonth - 1, dayNum).toISOString().split('T')[0];
    return attendance.find(r => new Date(r.date).toISOString().split('T')[0] === dateStr);
  };

  // Stats calculation
  const totalMarkedDays = attendance.length;
  const presentDays = attendance.filter(r => r.status === 'Present').length;
  const halfDays = attendance.filter(r => r.status === 'Half-day').length;
  const leaveDays = attendance.filter(r => r.status === 'Leave').length;
  const absentDays = attendance.filter(r => r.status === 'Absent').length;

  const attendanceScore = totalMarkedDays > 0 
    ? Math.round(((presentDays + (halfDays * 0.5)) / totalMarkedDays) * 100) 
    : 100;

  const totalLoggedHours = workLogs.reduce((acc, curr) => acc + (curr.totalHours || 0), 0);

  const prevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <Header title="My Reports & Attendance" />

        {/* Month Selector Controls */}
        <div className="flex items-center justify-between mb-8 bg-white px-5 py-3 rounded-2xl shadow-card border border-navy border-opacity-5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="text-gold" size={20} />
            <h2 className="font-heading text-navy text-xl font-bold">
              {new Date(selectedYear, selectedMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="btn-secondary p-2 hover:bg-cream rounded-xl">
              <ChevronLeft size={16} />
            </button>
            <button onClick={nextMonth} className="btn-secondary p-2 hover:bg-cream rounded-xl">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Retrieving your logs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ─── Left & Center: Calendar Matrix ─────────────────── */}
            <div className="lg:col-span-2 card">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-heading text-navy text-xl font-bold">Monthly Registry</h3>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Half-day</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gold" /> Leave</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-navy text-opacity-40 mb-3 uppercase tracking-wider">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} className="aspect-square bg-navy bg-opacity-[0.02] rounded-xl" />;
                  
                  const record = getDayRecord(day);
                  let cellClass = 'bg-cream text-navy hover:scale-105';
                  let badge = null;

                  if (record) {
                    if (record.status === 'Present') {
                      cellClass = 'bg-green-50 border-2 border-green-500 text-green-800';
                      badge = <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-green-500" />;
                    } else if (record.status === 'Absent') {
                      cellClass = 'bg-red-50 border-2 border-red-500 text-red-800';
                      badge = <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />;
                    } else if (record.status === 'Half-day') {
                      cellClass = 'bg-orange-50 border-2 border-orange-500 text-orange-800';
                      badge = <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-orange-500" />;
                    } else if (record.status === 'Leave') {
                      cellClass = 'bg-amber-50 border-2 border-gold text-amber-800';
                      badge = <span className="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-gold" />;
                    }
                  }

                  const isWeekend = new Date(selectedYear, selectedMonth - 1, day).getDay() === 0 || 
                                    new Date(selectedYear, selectedMonth - 1, day).getDay() === 6;

                  return (
                    <div
                      key={`day-${day}`}
                      className={`relative aspect-square rounded-xl flex flex-col items-center justify-center font-heading font-bold text-base transition-all cursor-pointer ${cellClass} ${
                        isWeekend && !record ? 'text-navy text-opacity-35' : ''
                      }`}
                      title={record?.notes ? `Notes: ${record.notes}` : undefined}
                    >
                      <span>{day}</span>
                      {badge}

                      {/* Tooltip Memo if note exists */}
                      {record?.notes && (
                        <div className="absolute top-1 right-1 group-hover:block">
                          <Info size={10} className="text-navy text-opacity-35" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Attendance memo text list */}
              {attendance.some(r => r.notes) && (
                <div className="mt-8 border-t border-navy border-opacity-5 pt-5 text-left">
                  <h4 className="font-heading text-navy text-sm font-bold mb-3">Audit Notes / Memos</h4>
                  <div className="space-y-2">
                    {attendance.filter(r => r.notes).map(r => (
                      <div key={r._id} className="flex gap-2 items-start text-xs bg-cream p-2.5 rounded-xl border border-navy border-opacity-5">
                        <span className="font-semibold text-gold tracking-widest min-w-[70px] uppercase">
                          Day {new Date(r.date).getDate()}:
                        </span>
                        <p className="text-navy text-opacity-70 leading-normal">
                          <span className="font-bold">{r.status}</span> · {r.notes}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Right Sidebar: Progress & Analytics ──────────────── */}
            <div className="space-y-6">
              
              {/* Circular Gauge Card */}
              <div className="card text-center flex flex-col items-center">
                <h3 className="font-heading text-navy text-base font-bold mb-4">Monthly Health Score</h3>
                <div className="relative w-36 h-36 flex items-center justify-center mb-4">
                  {/* Gauge Ring */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="72" cy="72" r="64" stroke="rgba(13,27,62,0.06)" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="72"
                      cy="72"
                      r="64"
                      stroke={attendanceScore > 85 ? '#10B981' : attendanceScore > 70 ? '#F59E0B' : '#EF4444'}
                      strokeWidth="10"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 64}
                      strokeDashoffset={2 * Math.PI * 64 * (1 - attendanceScore / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="font-heading text-navy font-bold text-3xl">{attendanceScore}%</span>
                    <span className="text-[10px] text-navy text-opacity-45 uppercase font-bold tracking-wider">Attendance</span>
                  </div>
                </div>
                <p className="text-xs text-navy text-opacity-50 leading-relaxed px-4">
                  Maintaining above 90% is highly recommended for ideal operations compliance.
                </p>
              </div>

              {/* Stat breakdowns */}
              <div className="card space-y-4 text-left">
                <h3 className="font-heading text-navy text-base font-bold pb-2 border-b border-navy border-opacity-5">Metrics Breakdown</h3>
                
                {[
                  { label: 'Present Days', value: presentDays, color: 'text-green-600', icon: CheckCircle2 },
                  { label: 'Half-days Marked', value: halfDays, color: 'text-orange-500', icon: AlertTriangle },
                  { label: 'Approved Leaves', value: leaveDays, color: 'text-gold', icon: CalendarIcon },
                  { label: 'Absent Days', value: absentDays, color: 'text-red-500', icon: AlertTriangle },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="flex justify-between items-center text-xs">
                    <span className="text-navy text-opacity-65 flex items-center gap-1.5">
                      <Icon size={14} className={color} /> {label}
                    </span>
                    <span className="font-heading font-bold text-navy text-sm">{value}</span>
                  </div>
                ))}
              </div>

              {/* Work log overview */}
              <div className="card text-left bg-navy text-white relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-gold rounded-full opacity-10 translate-x-1/3 translate-y-1/3" />
                <h3 className="font-heading text-gold text-base font-bold mb-4">Work Hours Summary</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white bg-opacity-10 flex items-center justify-center text-gold">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-heading">{totalLoggedHours.toFixed(1)}h</p>
                    <p className="text-[10px] text-white text-opacity-60 uppercase font-semibold">Total Hours Logged</p>
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
