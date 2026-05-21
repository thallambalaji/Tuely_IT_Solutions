import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Send, Lock, Clock, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import api from '../../utils/api';

const STATUS_OPTIONS = ['Completed', 'In Progress', 'Blocked'];
const CATEGORIES = ['Development', 'Design', 'Testing', 'Documentation', 'Meeting', 'Support', 'Other'];

const emptyTask = () => ({ taskName: '', description: '', timeSpent: '', status: 'In Progress', category: 'Development' });

export default function WorkLog() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitted, setSubmitted] = useState(false);
  const [existingLog, setExistingLog] = useState(null);
  const [tasks, setTasks] = useState([emptyTask()]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchLogForDate = async (dateStr) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/work-logs?date=${dateStr}`);
      if (data?.[0]) {
        setExistingLog(data[0]);
        setSubmitted(true);
        setTasks(data[0].tasks);
        setNotes(data[0].notes || '');
      } else {
        setExistingLog(null);
        setSubmitted(false);
        if (dateStr === new Date().toISOString().split('T')[0]) {
          setTasks([emptyTask()]);
          setNotes('');
        } else {
          setTasks([]);
          setNotes('');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load work log details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogForDate(selectedDate);
  }, [selectedDate]);

  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.timeSpent) || 0), 0);

  const addTask = () => {
    if (tasks.length >= 10) return;
    setTasks(t => [...t, emptyTask()]);
  };

  const removeTask = (i) => setTasks(t => t.filter((_, idx) => idx !== i));

  const updateTask = (i, field, value) => {
    setTasks(t => t.map((task, idx) => idx === i ? { ...task, [field]: value } : task));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validTasks = tasks.filter(t => t.taskName.trim());
    if (validTasks.length === 0) return setError('Please add at least one task.');

    setSubmitting(true);
    try {
      const { data } = await api.post('/work-logs', { tasks: validTasks, notes, date: selectedDate });
      setExistingLog(data.log);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 min-h-screen bg-cream flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-gold" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="ml-64 flex-1 min-h-screen bg-cream p-8 max-w-5xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Daily Work Log</p>
            <h1 className="font-heading text-navy text-4xl font-bold">
              {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-navy uppercase tracking-wider">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input py-1.5 px-3 text-xs w-40 shadow-sm"
            />
          </div>
        </motion.div>

        {/* Already Submitted — Locked View */}
        {submitted && existingLog && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card">
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-navy border-opacity-10">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                <CheckCircle size={24} className="text-success" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-navy text-2xl font-bold">Log Submitted ✓</h2>
                <p className="text-navy text-opacity-50 text-sm mt-1">
                  Submitted at {new Date(existingLog.submittedAt).toLocaleTimeString()} · {existingLog.totalHours}h total
                </p>
                {existingLog.isEditedByHR && (
                  <div className="flex items-center gap-2 mt-2 bg-gold-soft border border-gold border-opacity-30 px-3 py-2 rounded-xl inline-flex">
                    <span className="badge-gold text-xs">Edited by HR</span>
                    <span className="text-navy text-opacity-60 text-xs">
                      {existingLog.lastEditedAt ? `on ${new Date(existingLog.lastEditedAt).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-navy text-opacity-40 text-sm">
                <Lock size={16} />
                Locked
              </div>
            </div>
            <div className="space-y-4">
              {existingLog.tasks.map((task, i) => (
                <div key={i} className="flex gap-4 p-4 bg-cream rounded-xl">
                  <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center text-gold font-bold text-sm flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="font-semibold text-navy">{task.taskName}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${task.status === 'Completed' ? 'bg-green-100 text-success' : task.status === 'Blocked' ? 'bg-red-100 text-error' : 'bg-gold-soft text-navy'}`}>
                          {task.status}
                        </span>
                        <span className="flex items-center gap-1 text-navy text-opacity-50 text-xs font-medium">
                          <Clock size={12} /> {task.timeSpent}h
                        </span>
                      </div>
                    </div>
                    {task.description && <p className="text-navy text-opacity-60 text-sm mt-1">{task.description}</p>}
                    <span className="text-xs bg-navy bg-opacity-5 text-navy text-opacity-50 px-2 py-0.5 rounded mt-1 inline-block">{task.category}</span>
                  </div>
                </div>
              ))}
            </div>
            {existingLog.notes && (
              <div className="mt-4 p-4 bg-cream rounded-xl">
                <p className="text-xs font-semibold text-navy text-opacity-50 uppercase tracking-wider mb-1">End of Day Notes</p>
                <p className="text-navy text-sm">{existingLog.notes}</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Form — Not Yet Submitted */}
        {!submitted && selectedDate === new Date().toISOString().split('T')[0] && (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Total Hours Banner */}
            <div className="card bg-navy bg-opacity-5 flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-gold" />
                <span className="font-heading text-navy font-semibold text-lg">Total Hours Today</span>
              </div>
              <span className="font-heading text-4xl font-bold text-gold">{totalHours.toFixed(1)}h</span>
            </div>

            {/* Task Entries */}
            <AnimatePresence>
              {tasks.map((task, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="card"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-navy rounded-lg flex items-center justify-center text-gold font-bold text-sm">
                        {i + 1}
                      </div>
                      <span className="font-semibold text-navy">Task {i + 1}</span>
                    </div>
                    {tasks.length > 1 && (
                      <button type="button" onClick={() => removeTask(i)} className="text-error hover:bg-red-50 p-2 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="label">Task Name *</label>
                      <input
                        className="input"
                        value={task.taskName}
                        onChange={e => updateTask(i, 'taskName', e.target.value)}
                        placeholder="What did you work on?"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Description</label>
                      <textarea
                        className="input resize-none"
                        rows={2}
                        value={task.description}
                        onChange={e => updateTask(i, 'description', e.target.value)}
                        placeholder="Briefly describe what you accomplished..."
                      />
                    </div>
                    <div>
                      <label className="label">Time Spent (hours) *</label>
                      <input
                        className="input"
                        type="number"
                        min="0.25"
                        max="24"
                        step="0.25"
                        value={task.timeSpent}
                        onChange={e => updateTask(i, 'timeSpent', e.target.value)}
                        placeholder="e.g. 2.5"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <select className="input" value={task.category} onChange={e => updateTask(i, 'category', e.target.value)}>
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Status</label>
                      <div className="flex gap-3">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateTask(i, 'status', s)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all duration-200
                              ${task.status === s
                                ? s === 'Completed' ? 'bg-success text-white border-success'
                                : s === 'Blocked' ? 'bg-error text-white border-error'
                                : 'bg-gold text-navy border-gold'
                                : 'border-navy border-opacity-20 text-navy text-opacity-60 hover:border-opacity-40'
                              }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add Task Button */}
            {tasks.length < 10 && (
              <button
                type="button"
                onClick={addTask}
                className="w-full border-2 border-dashed border-navy border-opacity-20 rounded-2xl py-4 text-navy text-opacity-50
                           hover:border-gold hover:text-gold transition-all duration-200 flex items-center justify-center gap-2 font-medium"
              >
                <Plus size={18} />
                Add Another Task {tasks.length > 0 && `(${10 - tasks.length} remaining)`}
              </button>
            )}

            {/* End of Day Notes */}
            <div className="card">
              <label className="label">End of Day Notes (optional)</label>
              <textarea
                className="input resize-none"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anything notable? Blockers? Tomorrow's plan?"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle size={16} className="text-error" />
                <p className="text-error text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="btn-primary w-full py-4 text-base"
            >
              {submitting ? <><Loader2 size={20} className="animate-spin" /> Submitting...</> : <><Send size={20} /> Submit Today's Work Log</>}
            </motion.button>

            <p className="text-center text-navy text-opacity-40 text-xs">
              Once submitted, your log is locked. Only HR can make edits.
            </p>
          </motion.form>
        )}

        {/* Not Submitted for Past Date */}
        {!submitted && selectedDate !== new Date().toISOString().split('T')[0] && (
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card text-center py-16 text-navy text-opacity-40">
            <Lock size={48} className="mx-auto mb-4 opacity-30 text-navy" />
            <p className="text-lg font-heading font-bold text-navy">No Log Submitted</p>
            <p className="text-sm mt-1">You did not submit a work log for {new Date(selectedDate).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
