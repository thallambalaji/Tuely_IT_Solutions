import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Clock, AlertTriangle, Play, Check,
  Calendar, Info, FileText, Loader2, Sparkles, X
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

const STATUS_FILTERS = ['All', 'Pending', 'In Progress', 'Completed'];

export default function EmployeeTasks() {
  const { on, off } = useSocket();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [selectedTask, setSelectedTask] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get('/tasks');
      setTasks(data);
    } catch (err) {
      console.error('Error fetching employee tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Listen for socket events to update tasks list in real-time
    const handleTaskEvent = () => {
      fetchTasks();
    };

    on('task_assigned', handleTaskEvent);
    on('task_updated', handleTaskEvent);
    on('task_deleted', handleTaskEvent);

    return () => {
      off('task_assigned', handleTaskEvent);
      off('task_updated', handleTaskEvent);
      off('task_deleted', handleTaskEvent);
    };
  }, []);

  const handleStatusUpdate = async (taskId, newStatus) => {
    setActionLoading(taskId);
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      await fetchTasks();
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'All') return true;
    return task.status === activeTab;
  });

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
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">My Tasks</p>
          <h1 className="font-heading text-navy text-4xl font-bold">My Workload</h1>
          <p className="text-navy text-opacity-50 mt-1">View assigned assignments and update your daily completion logs.</p>
        </motion.div>

        {/* Tab Filters */}
        <div className="flex gap-2 border-b border-navy border-opacity-10 pb-4 mb-6">
          {STATUS_FILTERS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-navy text-gold shadow-md'
                  : 'text-navy text-opacity-65 hover:bg-navy hover:bg-opacity-5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Task Grid */}
        {filteredTasks.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card py-16 text-center text-navy text-opacity-40">
            <CheckCircle size={48} className="mx-auto mb-4 opacity-30 text-navy" />
            <p className="text-lg font-heading font-bold">All clear!</p>
            <p className="text-sm mt-1">No tasks assigned under "{activeTab}" status.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTasks.map(task => {
              const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'Completed';

              return (
                <motion.div
                  key={task._id}
                  layoutId={`card-${task._id}`}
                  className="card-hover flex flex-col justify-between"
                >
                  <div>
                    {/* Priority & Meta Badges */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        task.priority === 'urgent' ? 'badge-error' :
                        task.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                        task.priority === 'medium' ? 'badge-warning' : 'badge-success'
                      }`}>
                        {task.priority}
                      </span>
                      {task.isEdited && (
                        <span className="badge-gold text-[9px] uppercase font-bold flex items-center gap-1">
                          <Sparkles size={10} /> Edited by HR
                        </span>
                      )}
                    </div>

                    <h2 className="font-heading text-navy text-xl font-bold mb-2 line-clamp-1">{task.title}</h2>
                    <p className="text-navy text-opacity-60 text-sm mb-4 line-clamp-3 leading-relaxed">
                      {task.description || 'No description details provided.'}
                    </p>
                  </div>

                  <div>
                    {/* Due Date Indicator */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-navy text-opacity-50 mb-4">
                      <Calendar size={14} />
                      <span className={isOverdue ? 'text-error font-bold animate-pulse' : ''}>
                        Due {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isOverdue && ' (Overdue)'}
                      </span>
                    </div>

                    {/* Quick State Toggle Buttons */}
                    <div className="flex gap-2 pt-3 border-t border-navy border-opacity-5">
                      {task.status === 'Pending' && (
                        <button
                          onClick={() => handleStatusUpdate(task._id, 'In Progress')}
                          disabled={actionLoading === task._id}
                          className="btn-gold flex-1 text-xs py-2 px-3 rounded-lg"
                        >
                          {actionLoading === task._id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          Start Work
                        </button>
                      )}
                      
                      {task.status === 'In Progress' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(task._id, 'Completed')}
                            disabled={actionLoading === task._id}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center gap-2 justify-center flex-1 text-xs py-2 px-3 rounded-lg transition-colors"
                          >
                            {actionLoading === task._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            Complete
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(task._id, 'Pending')}
                            disabled={actionLoading === task._id}
                            className="btn-secondary flex-1 text-xs py-2 px-3 rounded-lg"
                          >
                            Pause
                          </button>
                        </>
                      )}

                      {task.status === 'Completed' && (
                        <span className="badge-success text-center w-full justify-center py-2 rounded-lg gap-2 text-xs">
                          <CheckCircle size={12} /> Task Completed
                        </span>
                      )}

                      <button
                        onClick={() => setSelectedTask(task)}
                        className="btn-ghost p-2 hover:bg-navy hover:bg-opacity-5 rounded-lg"
                        title="View Full Task Detail"
                      >
                        <Info size={16} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ─── Task Details Dialog ──────────────────────────────── */}
        <AnimatePresence>
          {selectedTask && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedTask(null)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-md relative z-50"
              >
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <FileText className="text-gold" size={20} /> Full Task Detail
                  </h2>
                  <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-heading text-navy text-2xl font-bold">{selectedTask.title}</h3>
                    {selectedTask.isEdited && (
                      <span className="badge-gold text-[10px] uppercase font-bold flex items-center gap-1">
                        <Sparkles size={10} /> Edited by HR
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-navy border-opacity-10 text-xs">
                    <div>
                      <p className="font-semibold text-navy text-opacity-50 uppercase tracking-widest">Priority</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 inline-block ${
                        selectedTask.priority === 'urgent' ? 'badge-error' :
                        selectedTask.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                        selectedTask.priority === 'medium' ? 'badge-warning' : 'badge-success'
                      }`}>
                        {selectedTask.priority}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-navy text-opacity-50 uppercase tracking-widest">Due Date</p>
                      <p className="text-navy font-semibold text-sm mt-1">
                        {new Date(selectedTask.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-navy text-opacity-50 uppercase tracking-widest mb-1">Description</p>
                    <p className="text-navy text-sm leading-relaxed whitespace-pre-wrap">{selectedTask.description || 'No description provided.'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-navy text-opacity-50 uppercase tracking-widest mb-2">Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        selectedTask.status === 'Completed' ? 'bg-success' :
                        selectedTask.status === 'In Progress' ? 'bg-gold' : 'bg-red-400'
                      }`} />
                      <span className="text-navy font-bold text-sm uppercase">{selectedTask.status}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6 mt-4 border-t border-navy border-opacity-10">
                  {selectedTask.status === 'Pending' && (
                    <button
                      onClick={() => handleStatusUpdate(selectedTask._id, 'In Progress')}
                      disabled={actionLoading === selectedTask._id}
                      className="btn-gold flex-1 text-sm py-2 px-3 rounded-lg"
                    >
                      Start Work
                    </button>
                  )}
                  {selectedTask.status === 'In Progress' && (
                    <button
                      onClick={() => handleStatusUpdate(selectedTask._id, 'Completed')}
                      disabled={actionLoading === selectedTask._id}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-center gap-2 flex-1 text-sm py-2 px-3 rounded-lg transition-colors"
                    >
                      Mark Completed
                    </button>
                  )}
                  <button onClick={() => setSelectedTask(null)} className="btn-secondary flex-1">Close</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
