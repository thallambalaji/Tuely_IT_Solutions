import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Send, Plus, CheckCircle2, AlertTriangle, Clock, X, Loader2
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const DEFAULT_LIMITS = {
  Casual: 12,
  Sick: 10,
  Earned: 15,
};

export default function EmployeeLeave() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [balances, setBalances] = useState({ Casual: 12, Sick: 10, Earned: 15 });

  // New leave form state
  const [title, setTitle] = useState('');
  const [leaveType, setLeaveType] = useState('Casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  const fetchLeaves = async () => {
    if (!user) return;
    try {
      const [leavesRes, balanceRes] = await Promise.all([
        api.get('/leaves'),
        api.get(`/leaves/balance/${user._id || user.id}`)
      ]);
      setLeaves(leavesRes.data);
      if (balanceRes.data) {
        setBalances({
          Casual: balanceRes.data.Casual?.remaining ?? 12,
          Sick: balanceRes.data.Sick?.remaining ?? 10,
          Earned: balanceRes.data.Earned?.remaining ?? 15,
        });
      }
    } catch (err) {
      console.error('Error fetching leave history and balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLeaves();
    }
  }, [user]);

  const getDurationInDays = (start, end) => {
    if (!start || !end) return 0;
    const diffTime = Math.abs(new Date(end) - new Date(start));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const requestedDays = getDurationInDays(fromDate, toDate);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !fromDate || !toDate || !reason.trim()) {
      setFormError('Please fill out all fields.');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    const duration = getDurationInDays(fromDate, toDate);

    // Balance check
    if (leaveType !== 'Unpaid' && duration > balances[leaveType]) {
      setFormError(`Insufficient leave balance. You requested ${duration} days, but only have ${balances[leaveType]} days remaining.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/leaves', {
        title,
        leaveType,
        fromDate,
        toDate,
        reason
      });
      setShowApplyModal(false);
      // Reset form
      setTitle('');
      setFromDate('');
      setToDate('');
      setReason('');
      fetchLeaves();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <Header title="Leave Requests" />

        {/* Action Button */}
        <div className="flex justify-between items-center mb-8">
          <p className="text-navy text-opacity-50 text-sm">Request leaves of absence and review your history.</p>
          <button
            onClick={() => setShowApplyModal(true)}
            className="btn-gold flex items-center gap-2"
          >
            <Plus size={16} /> Request Leave
          </button>
        </div>

        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Loading leave summaries...</p>
          </div>
        ) : (
          <>
            {/* Balance Tracker */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { type: 'Casual Leave', limit: DEFAULT_LIMITS.Casual, remaining: balances.Casual, color: 'text-blue-600', bg: 'bg-blue-50' },
                { type: 'Sick Leave', limit: DEFAULT_LIMITS.Sick, remaining: balances.Sick, color: 'text-success', bg: 'bg-green-50' },
                { type: 'Earned Leave', limit: DEFAULT_LIMITS.Earned, remaining: balances.Earned, color: 'text-gold-dark', bg: 'bg-gold-soft bg-opacity-25' },
              ].map(({ type, limit, remaining, color, bg }) => (
                <div key={type} className="card flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-navy text-opacity-45 uppercase font-bold tracking-wider">{type}</span>
                    <p className="text-3xl font-bold font-heading text-navy mt-1">
                      {remaining} <span className="text-sm font-semibold text-navy text-opacity-40">/ {limit} days</span>
                    </p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center font-bold ${color}`}>
                    {Math.round((remaining / limit) * 100)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Leave History */}
            <div className="card p-0 overflow-x-auto">
              <div className="px-5 py-4 border-b border-navy border-opacity-5">
                <h3 className="font-heading text-navy text-xl font-bold">Request History</h3>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-navy border-opacity-10 bg-navy bg-opacity-5">
                    <th className="p-4 font-heading text-navy font-bold text-sm">Type</th>
                    <th className="p-4 font-heading text-navy font-bold text-sm">Duration</th>
                    <th className="p-4 font-heading text-navy font-bold text-sm">Reason</th>
                    <th className="p-4 font-heading text-navy font-bold text-sm">Status</th>
                    <th className="p-4 font-heading text-navy font-bold text-sm">Approver Review</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-navy text-opacity-40">No leave requests found.</td>
                    </tr>
                  ) : (
                    leaves.map(leave => {
                      const duration = getDurationInDays(leave.fromDate, leave.toDate);
                      return (
                        <tr key={leave._id} className="border-b border-navy border-opacity-5 hover:bg-navy hover:bg-opacity-[0.01]">
                          <td className="p-4 font-semibold text-navy">{leave.leaveType}</td>
                          <td className="p-4">
                            <p className="text-navy font-semibold text-sm">
                              {new Date(leave.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} -{' '}
                              {new Date(leave.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <span className="text-[10px] text-navy text-opacity-40 font-bold uppercase">{duration} {duration === 1 ? 'day' : 'days'}</span>
                          </td>
                          <td className="p-4 text-xs text-navy text-opacity-70 max-w-xs truncate" title={leave.reason}>
                            {leave.reason}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              leave.status === 'Approved' ? 'bg-green-100 text-success' :
                              leave.status === 'Rejected' ? 'bg-red-100 text-error' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {leave.status}
                            </span>
                          </td>
                          <td className="p-4 text-xs">
                            {leave.reviewedBy ? (
                              <div>
                                <p className="font-bold text-navy">Reviewed by {leave.reviewedBy.fullName}</p>
                                <p className="text-navy text-opacity-60 mt-0.5">{leave.reviewNote || 'No review comment provided.'}</p>
                              </div>
                            ) : (
                              <span className="text-navy text-opacity-35 italic">Awaiting review</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── Apply Leave Modal ─────────────────────────────────── */}
        <AnimatePresence>
          {showApplyModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowApplyModal(false)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-md relative z-50"
              >
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Calendar className="text-gold" size={20} /> Request New Leave
                  </h2>
                  <button onClick={() => setShowApplyModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <form onSubmit={handleApplyLeave} className="space-y-4 text-left">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-error rounded-xl p-3 text-xs flex items-center gap-2 font-semibold">
                      <AlertTriangle size={14} /> {formError}
                    </div>
                  )}

                  <div>
                    <label className="label">Title / Subject *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Medical emergency, Family function..."
                      className="input text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Leave Type</label>
                    <select
                      value={leaveType}
                      onChange={e => setLeaveType(e.target.value)}
                      className="input"
                    >
                      <option value="Casual">Casual Leave ({balances.Casual} days left)</option>
                      <option value="Sick">Sick Leave ({balances.Sick} days left)</option>
                      <option value="Earned">Earned Leave ({balances.Earned} days left)</option>
                      <option value="Unpaid">Unpaid Leave (Unlimited)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Start Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="input text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">End Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        className="input text-xs"
                        required
                      />
                    </div>
                  </div>

                  {requestedDays > 0 && (
                    <div className="bg-navy bg-opacity-5 p-3 rounded-xl flex items-center justify-between text-xs font-semibold text-navy">
                      <span>Total Days Requested:</span>
                      <span className="text-gold font-bold text-sm">{requestedDays} {requestedDays === 1 ? 'Day' : 'Days'}</span>
                    </div>
                  )}

                  {leaveType !== 'Unpaid' && requestedDays > balances[leaveType] && (
                    <div className="bg-red-50 border border-red-200 text-error rounded-xl p-3 text-xs flex items-center gap-2 font-semibold">
                      <AlertTriangle size={14} /> Warning: Insufficient leave balance!
                    </div>
                  )}

                  <div>
                    <label className="label">Reason for Absence</label>
                    <textarea
                      placeholder="Please clarify the reason for your leave request..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="input min-h-[90px] text-xs py-2"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-navy border-opacity-10">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-gold flex-1 py-2 text-sm flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Submit Request
                    </button>
                    <button type="button" onClick={() => setShowApplyModal(false)} className="btn-secondary flex-1 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
