import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Calendar, Clock, ChevronDown, CheckCircle,
  Edit2, Save, X, Loader2, AlertCircle, Lock, Check,
  FileText, User as UserIcon, ChevronLeft, ChevronRight,
  Download, Filter
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import api from '../../utils/api';

const CATEGORY_COLORS = {
  Development: 'bg-blue-100 text-blue-700',
  Meeting: 'bg-purple-100 text-purple-700',
  Review: 'bg-yellow-100 text-yellow-700',
  Research: 'bg-green-100 text-green-700',
  Support: 'bg-orange-100 text-orange-700',
  Design: 'bg-pink-100 text-pink-700',
  Testing: 'bg-cyan-100 text-cyan-700',
  Other: 'bg-gray-100 text-gray-600',
};

const CATEGORIES = ['Development', 'Meeting', 'Review', 'Research', 'Support', 'Design', 'Testing', 'Other'];

function InitialsAvatar({ name, size = 36 }) {
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') : '?';
  return (
    <div className="rounded-full bg-navy text-gold font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function HRWorkLogs() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Detail panel
  const [activeLog, setActiveLog] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTasks, setEditTasks] = useState([]);
  const [editNotes, setEditNotes] = useState('');
  const [hasLoaded, setHasLoaded] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await api.get('/users');
        setEmployees(data.filter(u => u.role === 'employee'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    setHasLoaded(true);
    setActiveLog(null);
    try {
      const [year, month] = selectedDate.split('-');
      const params = new URLSearchParams({ month, year });
      if (selectedEmployee !== 'all') params.append('employeeId', selectedEmployee);
      const { data } = await api.get(`/work-logs?${params.toString()}`);
      setLogs(data);
    } catch (err) {
      setError('Failed to fetch work logs.');
    } finally {
      setLoading(false);
    }
  };

  const openLog = (log) => {
    setActiveLog(log);
    setIsEditing(false);
    setEditTasks(log.tasks.map(t => ({ ...t })));
    setEditNotes(log.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!activeLog) return;
    setActionLoading(true);
    try {
      const { data } = await api.put(`/work-logs/${activeLog._id}`, {
        tasks: editTasks,
        notes: editNotes,
      });
      setActiveLog(data.workLog);
      setIsEditing(false);
      setLogs(prev => prev.map(l => l._id === data.workLog._id ? data.workLog : l));
      showToast('Work log updated by HR.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const updateEditTask = (idx, field, value) => {
    setEditTasks(tasks => tasks.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  // Group logs by employee
  const logsByEmployee = {};
  logs.forEach(log => {
    const empId = log.employee?._id || 'unknown';
    if (!logsByEmployee[empId]) logsByEmployee[empId] = { employee: log.employee, logs: [] };
    logsByEmployee[empId].logs.push(log);
  });

  const totalHoursThisMonth = logs.reduce((sum, l) => sum + (l.totalHours || 0), 0);
  const submittedLogs = logs.filter(l => l.isLocked).length;
  const hrEditedLogs = logs.filter(l => l.isEditedByHR).length;

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}>
              <Check size={16} /> {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Human Resources</p>
          <h1 className="font-heading text-navy text-4xl font-bold">Work Logs</h1>
          <p className="text-navy/50 mt-1">Review, monitor, and edit employee daily work logs.</p>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <label className="label">Select Employee</label>
            <select className="input" value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)}>
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp._id} value={emp._id}>{emp.fullName} ({emp.employeeId || emp.companyEmail})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Month / Year</label>
            <input type="month" className="input w-48" value={selectedDate}
              max={new Date().toISOString().substring(0, 7)}
              onChange={e => setSelectedDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={fetchLogs} disabled={loading} className="btn-primary h-12 px-6">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <><Search size={18} /> Load Logs</>}
            </button>
          </div>
        </div>

        {/* Stats cards */}
        {hasLoaded && logs.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Logs', value: logs.length, icon: <FileText size={20} className="text-gold" />, bg: 'bg-gold/10' },
              { label: 'Total Hours', value: `${totalHoursThisMonth.toFixed(1)}h`, icon: <Clock size={20} className="text-blue-500" />, bg: 'bg-blue-50' },
              { label: 'HR Edited', value: hrEditedLogs, icon: <Edit2 size={20} className="text-purple-500" />, bg: 'bg-purple-50' },
            ].map(s => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg}`}>{s.icon}</div>
                <div>
                  <p className="text-3xl font-heading font-bold text-navy">{s.value}</p>
                  <p className="text-sm text-navy/50">{s.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Two-panel layout */}
        <div className="flex gap-6 h-[calc(100vh-320px)]">
          {/* Log list */}
          <div className="w-80 flex-shrink-0 card p-0 overflow-y-auto">
            {!hasLoaded ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-navy/40 py-20">
                <Search size={32} />
                <p className="text-sm font-medium text-center">Select filters and click<br />"Load Logs" to begin</p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gold" /></div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-navy/40 py-20">
                <FileText size={32} />
                <p className="text-sm font-medium text-center">No logs found<br />for this period.</p>
              </div>
            ) : (
              <div className="divide-y divide-navy/5">
                {logs.map(log => (
                  <button key={log._id} onClick={() => openLog(log)}
                    className={`w-full text-left p-4 hover:bg-gold/5 transition-colors ${activeLog?._id === log._id ? 'bg-gold/10 border-l-4 border-gold' : ''}`}>
                    <div className="flex items-start gap-3">
                      {log.employee?.profilePhoto
                        ? <img src={log.employee.profilePhoto} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        : <InitialsAvatar name={log.employee?.fullName} size={36} />
                      }
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-navy text-sm truncate">{log.employee?.fullName}</p>
                        <p className="text-xs text-navy/50">{new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="badge-gold text-[10px] py-0.5">{log.totalHours}h</span>
                          {log.isEditedByHR && <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">HR Edited</span>}
                          {log.isLocked && <Lock size={10} className="text-navy/40" />}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="flex-1 card p-0 overflow-hidden flex flex-col">
            {!activeLog ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-navy/30">
                <FileText size={48} />
                <p className="font-heading text-xl">Select a log to view details</p>
              </div>
            ) : (
              <>
                {/* Panel header */}
                <div className="p-6 border-b border-navy/10 flex items-center justify-between bg-navy/[0.02]">
                  <div className="flex items-center gap-3">
                    {activeLog.employee?.profilePhoto
                      ? <img src={activeLog.employee.profilePhoto} className="w-12 h-12 rounded-full object-cover" />
                      : <InitialsAvatar name={activeLog.employee?.fullName} size={48} />
                    }
                    <div>
                      <p className="font-heading text-navy font-bold text-lg">{activeLog.employee?.fullName}</p>
                      <p className="text-xs text-navy/50">
                        {new Date(activeLog.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {' '}&bull;{' '}{activeLog.totalHours}h total
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {activeLog.isEditedByHR && (
                      <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                        <Edit2 size={11} /> Edited by HR
                      </span>
                    )}
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="btn-primary py-2 px-4 text-sm">
                        <Edit2 size={15} /> Edit Log
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={actionLoading} className="btn-gold py-2 px-4 text-sm">
                          {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Save</>}
                        </button>
                        <button onClick={() => setIsEditing(false)} className="btn-secondary py-2 px-4 text-sm"><X size={14} /> Cancel</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {isEditing ? (
                    <>
                      {editTasks.map((task, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-navy/10 rounded-2xl p-4 bg-cream/50 space-y-3">
                          <p className="font-bold text-navy text-sm">Task {idx + 1}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="label">Task Name</label>
                              <input className="input text-sm" value={task.taskName}
                                onChange={e => updateEditTask(idx, 'taskName', e.target.value)} />
                            </div>
                            <div className="col-span-2">
                              <label className="label">Description</label>
                              <textarea rows={2} className="input text-sm resize-none" value={task.description}
                                onChange={e => updateEditTask(idx, 'description', e.target.value)} />
                            </div>
                            <div>
                              <label className="label">Time Spent (hrs)</label>
                              <input type="number" min={0} step={0.5} className="input text-sm" value={task.timeSpent}
                                onChange={e => updateEditTask(idx, 'timeSpent', parseFloat(e.target.value))} />
                            </div>
                            <div>
                              <label className="label">Status</label>
                              <select className="input text-sm" value={task.status}
                                onChange={e => updateEditTask(idx, 'status', e.target.value)}>
                                <option>In Progress</option>
                                <option>Completed</option>
                                <option>Blocked</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">Category</label>
                              <select className="input text-sm" value={task.category}
                                onChange={e => updateEditTask(idx, 'category', e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      <div>
                        <label className="label">General Notes</label>
                        <textarea rows={3} className="input resize-none text-sm" value={editNotes}
                          onChange={e => setEditNotes(e.target.value)} placeholder="Add notes..." />
                      </div>
                    </>
                  ) : (
                    <>
                      {activeLog.tasks.map((task, idx) => (
                        <motion.div key={idx} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-start gap-4 border border-navy/8 rounded-2xl p-4 bg-white hover:shadow-card transition-all">
                          <div className="flex-shrink-0 w-8 h-8 bg-gold/15 rounded-xl flex items-center justify-center font-bold text-gold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-heading font-bold text-navy">{task.taskName}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[task.category] || CATEGORY_COLORS.Other}`}>
                                {task.category}
                              </span>
                            </div>
                            <p className="text-sm text-navy/60 mt-0.5 line-clamp-2">{task.description}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="font-bold text-navy text-sm">{task.timeSpent}h</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${task.status === 'Completed' ? 'bg-green-100 text-success' : task.status === 'Blocked' ? 'bg-red-100 text-error' : 'bg-yellow-100 text-yellow-700'}`}>
                              {task.status}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                      {activeLog.notes && (
                        <div className="bg-navy/5 rounded-2xl p-4">
                          <p className="text-xs font-semibold text-navy/50 uppercase tracking-wider mb-1">Notes</p>
                          <p className="text-sm text-navy">{activeLog.notes}</p>
                        </div>
                      )}
                      {activeLog.submittedAt && (
                        <p className="text-xs text-navy/40 text-right">
                          Submitted at {new Date(activeLog.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          {activeLog.lastEditedAt && ` · HR edited at ${new Date(activeLog.lastEditedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
