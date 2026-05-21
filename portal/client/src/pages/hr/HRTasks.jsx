import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Edit2, Trash2, Check, X, Loader2,
  AlertCircle, Calendar, Clock, ChevronDown, Flag,
  Filter, CheckCircle, PlayCircle, AlertOctagon, Circle
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PRIORITY_STYLES = {
  Low:    { bg: 'bg-green-100', text: 'text-green-700', icon: <Circle size={12} className="text-green-500" /> },
  Medium: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <Circle size={12} className="text-orange-500" /> },
  High:   { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertOctagon size={12} className="text-red-500" /> },
  Urgent: { bg: 'bg-red-200', text: 'text-red-900', icon: <AlertOctagon size={12} className="text-red-700" /> },
};
const STATUS_FILTERS = ['All', 'Pending', 'In Progress', 'Completed'];
const STATUS_STYLES = {
  Pending:     { bg: 'bg-gray-100', text: 'text-gray-600', icon: <Circle size={12} /> },
  'In Progress': { bg: 'bg-gold/20', text: 'text-navy', icon: <PlayCircle size={12} className="text-gold" /> },
  Completed:   { bg: 'bg-green-100', text: 'text-success', icon: <CheckCircle size={12} className="text-success" /> },
};

function InitialsAvatar({ name, size = 36 }) {
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') : '?';
  return (
    <div className="rounded-full bg-navy text-gold font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function HRTasks() {
  const { on, off } = useSocket();
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Forms
  const [assignForm, setAssignForm] = useState({ assignedTo: '', title: '', description: '', priority: 'Medium', dueDate: '' });
  const [editForm, setEditForm] = useState({});

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    try {
      const [usersRes, tasksRes] = await Promise.all([api.get('/users'), api.get('/tasks')]);
      setEmployees(usersRes.data.filter(u => u.role === 'employee'));
      setTasks(tasksRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    // Real-time: employee status change shows notification already in bell
    const handleStatusChange = () => fetchAll();
    on('task_status_change', handleStatusChange);
    return () => off('task_status_change', handleStatusChange);
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchSearch = !searchQuery || task.title?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'All' || task.status === statusFilter;
    const matchEmployee = employeeFilter === 'all' || (task.assignedTo?._id || task.assignedTo) === employeeFilter;
    const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchSearch && matchStatus && matchEmployee && matchPriority;
  });

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const overdueTasks = tasks.filter(t => t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < new Date()).length;

  const handleAssignTask = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.post('/tasks', assignForm);
      setShowAssignModal(false);
      setAssignForm({ assignedTo: '', title: '', description: '', priority: 'Medium', dueDate: '' });
      fetchAll();
      showToast('Task assigned successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign task.');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (task) => {
    setSelectedTask(task);
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate?.split('T')[0] || '',
      status: task.status,
    });
    setError('');
    setShowEditModal(true);
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    setError('');
    setActionLoading(true);
    try {
      await api.put(`/tasks/${selectedTask._id}`, editForm);
      setShowEditModal(false);
      fetchAll();
      showToast('Task updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update task.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTask = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/tasks/${selectedTask._id}`);
      setShowDeleteConfirm(false);
      fetchAll();
      showToast('Task deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete task.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gold" />
      </main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8">

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`fixed top-6 right-6 z-[9999] px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'}`}>
              <Check size={16} /> {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Human Resources</p>
            <h1 className="font-heading text-navy text-4xl font-bold">Task Management</h1>
            <p className="text-navy/50 mt-1">Assign, monitor, and manage all employee tasks in real-time.</p>
          </div>
          <button onClick={() => setShowAssignModal(true)} className="btn-primary">
            <Plus size={18} /> Assign New Task
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tasks', value: totalTasks, icon: <Flag size={20} />, color: 'text-navy', bg: 'bg-navy/10' },
            { label: 'In Progress', value: inProgressTasks, icon: <PlayCircle size={20} />, color: 'text-gold', bg: 'bg-gold/15' },
            { label: 'Completed', value: completedTasks, icon: <CheckCircle size={20} />, color: 'text-success', bg: 'bg-green-100' },
            { label: 'Overdue', value: overdueTasks, icon: <AlertOctagon size={20} />, color: 'text-error', bg: 'bg-red-100' },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</div>
              <div>
                <p className={`text-3xl font-heading font-bold ${s.color}`}>{s.value}</p>
                <p className="text-sm text-navy/50">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 bg-white rounded-2xl p-4 shadow-card">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 text-navy/40" size={16} />
              <input type="text" placeholder="Search tasks..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} className="input pl-9 py-2.5 text-sm" />
            </div>
          </div>
          <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="input w-48 py-2.5 text-sm">
            <option value="all">All Employees</option>
            {employees.map(emp => <option key={emp._id} value={emp._id}>{emp.fullName}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="input w-36 py-2.5 text-sm">
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${statusFilter === s ? 'bg-navy text-gold border-navy' : 'border-navy/10 text-navy/60 hover:border-navy/30'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Task Grid */}
        {filteredTasks.length === 0 ? (
          <div className="text-center py-20 text-navy/40">
            <Flag size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-heading text-xl">No tasks found</p>
            <p className="text-sm mt-1">Try changing filters or assign a new task</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTasks.map((task, idx) => {
              const emp = task.assignedTo;
              const isOverdue = task.status !== 'Completed' && task.dueDate && new Date(task.dueDate) < new Date();
              const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.Low;
              const sStyle = STATUS_STYLES[task.status] || STATUS_STYLES.Pending;

              return (
                <motion.div key={task._id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                  className={`card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 ${isOverdue ? 'border-l-4 border-error' : ''}`}>

                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${pStyle.bg} ${pStyle.text}`}>
                      {pStyle.icon} {task.priority}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModal(task)} className="p-1.5 hover:bg-cream rounded-lg text-navy/50 hover:text-navy">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => { setSelectedTask(task); setShowDeleteConfirm(true); setError(''); }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-navy/50 hover:text-error">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-heading font-bold text-navy text-base mb-1.5 leading-snug">{task.title}</h3>
                  <p className="text-sm text-navy/60 line-clamp-2 mb-3">{task.description || 'No description.'}</p>

                  {task.isEdited && (
                    <p className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mb-2">
                      <Edit2 size={9} /> Edited by HR
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-navy/8">
                    {/* Assigned employee */}
                    <div className="flex items-center gap-2">
                      {emp?.profilePhoto
                        ? <img src={emp.profilePhoto} className="w-7 h-7 rounded-full object-cover" />
                        : <InitialsAvatar name={emp?.fullName} size={28} />
                      }
                      <span className="text-xs font-medium text-navy/70 truncate max-w-[100px]">{emp?.fullName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${sStyle.bg} ${sStyle.text}`}>
                        {sStyle.icon} {task.status}
                      </span>
                      {/* Due date */}
                      {task.dueDate && (
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${isOverdue ? 'text-error' : 'text-navy/50'}`}>
                          <Calendar size={10} />
                          {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Assign Task Modal ─────────────────────────────────── */}
        <AnimatePresence>
          {showAssignModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowAssignModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2"><Plus className="text-gold" size={22} /> Assign New Task</h2>
                  <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={18} /></button>
                </div>
                {error && <div className="bg-red-50 text-error text-sm px-3 py-2 rounded-xl mb-4 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}
                <form onSubmit={handleAssignTask} className="space-y-4">
                  <div>
                    <label className="label">Assign To *</label>
                    <select required className="input" value={assignForm.assignedTo}
                      onChange={e => setAssignForm(f => ({ ...f, assignedTo: e.target.value }))}>
                      <option value="">Select Employee</option>
                      {employees.map(emp => (
                        <option key={emp._id} value={emp._id}>{emp.fullName} — {emp.designation || emp.department}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Task Name *</label>
                    <input required type="text" className="input" value={assignForm.title}
                      onChange={e => setAssignForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Update CRM database" />
                  </div>
                  <div>
                    <label className="label">Description *</label>
                    <textarea required rows={3} className="input resize-none" value={assignForm.description}
                      onChange={e => setAssignForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what needs to be done..." />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITIES.map(p => {
                        const s = PRIORITY_STYLES[p];
                        return (
                          <button key={p} type="button"
                            onClick={() => setAssignForm(f => ({ ...f, priority: p }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all flex items-center gap-1.5 ${assignForm.priority === p ? `${s.bg} ${s.text} border-current` : 'border-navy/10 text-navy/50 hover:border-navy/30'}`}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="label">Due Date *</label>
                    <input required type="date" className="input" value={assignForm.dueDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setAssignForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={actionLoading} className="btn-gold flex-1">
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Assign Task</>}
                    </button>
                    <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Edit Task Modal ───────────────────────────────────── */}
        <AnimatePresence>
          {showEditModal && selectedTask && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2"><Edit2 className="text-gold" size={22} /> Edit Task</h2>
                  <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={18} /></button>
                </div>
                {error && <div className="bg-red-50 text-error text-sm px-3 py-2 rounded-xl mb-4">{error}</div>}
                <form onSubmit={handleEditTask} className="space-y-4">
                  <div>
                    <label className="label">Task Name *</label>
                    <input required type="text" className="input" value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea rows={3} className="input resize-none" value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <div className="flex gap-2 flex-wrap">
                      {PRIORITIES.map(p => (
                        <button key={p} type="button" onClick={() => setEditForm(f => ({ ...f, priority: p }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${editForm.priority === p ? 'bg-navy text-gold border-navy' : 'border-navy/10 text-navy/50'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Due Date *</label>
                      <input required type="date" className="input" value={editForm.dueDate}
                        onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Status</label>
                      <select className="input" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={actionLoading} className="btn-primary flex-1">
                      {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Check size={16} /> Save Changes</>}
                    </button>
                    <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary flex-1">Cancel</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── Delete Confirm ───────────────────────────────────── */}
        <AnimatePresence>
          {showDeleteConfirm && selectedTask && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteConfirm(false)} className="fixed inset-0 bg-navy" />
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="card relative z-50 w-full max-w-md">
                <h2 className="font-heading text-navy text-xl font-bold mb-3">Delete Task</h2>
                <p className="text-sm text-navy/70 bg-red-50 rounded-xl p-4 mb-5">
                  Are you sure you want to delete the task <strong>"{selectedTask.title}"</strong>? This will notify the employee and remove the task permanently.
                </p>
                {error && <p className="text-error text-sm mb-3">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={handleDeleteTask} disabled={actionLoading} className="btn-danger flex-1">
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> Delete</>}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
