import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Check, X, MessageSquare, AlertCircle, Info, Calendar, Loader2
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import api from '../../utils/api';

export default function HRLeaves() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    try {
      const { data } = await api.get('/leaves');
      // Sort Pending first, then descending by date
      const sorted = data.sort((a, b) => {
        if (a.status === 'Pending' && b.status !== 'Pending') return -1;
        if (a.status !== 'Pending' && b.status === 'Pending') return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setRequests(sorted);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleReview = async (status) => {
    if (!selectedRequest) return;
    if (status === 'Rejected' && !reviewNote.trim()) {
      alert('A comment/reason is required for rejections.');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/leaves/${selectedRequest._id}/review`, {
        status,
        reviewNote: reviewNote.trim()
      });
      setSelectedRequest(null);
      setReviewNote('');
      fetchRequests();
    } catch (err) {
      console.error('Failed to review leave request:', err);
      alert('Failed to update leave request status.');
    } finally {
      setActionLoading(false);
    }
  };

  const getDurationInDays = (start, end) => {
    const diffTime = Math.abs(new Date(end) - new Date(start));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <Header title="Leave Management" />

        <div className="mb-8">
          <p className="text-navy text-opacity-50 text-sm">Review employee leave applications and record review decisions.</p>
        </div>

        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Loading leave applications queue...</p>
          </div>
        ) : (
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-navy border-opacity-10 bg-navy bg-opacity-5">
                  <th className="p-4 font-heading text-navy font-bold text-sm">Employee</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Leave Type</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Duration</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Reason</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm">Status</th>
                  <th className="p-4 font-heading text-navy font-bold text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-navy text-opacity-40">No leave applications found.</td>
                  </tr>
                ) : (
                  requests.map(req => {
                    const duration = getDurationInDays(req.fromDate, req.toDate);
                    const emp = req.employee || {};

                    return (
                      <tr key={req._id} className="border-b border-navy border-opacity-5 hover:bg-navy hover:bg-opacity-[0.01]">
                        {/* Employee info */}
                        <td className="p-4 flex items-center gap-3">
                          {emp.profilePhoto ? (
                            <img src={emp.profilePhoto} alt={emp.fullName} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-navy text-gold font-bold text-xs flex items-center justify-center">
                              {emp.fullName?.[0] || 'E'}
                            </div>
                          )}
                          <div>
                            <p className="font-heading font-bold text-navy leading-tight">{emp.fullName || 'Unknown Employee'}</p>
                            <p className="text-[10px] text-navy text-opacity-45 mt-0.5">{emp.designation} · {emp.department}</p>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="p-4 font-semibold text-navy">{req.leaveType}</td>

                        {/* Dates duration */}
                        <td className="p-4">
                          <p className="text-navy font-semibold text-sm">
                            {new Date(req.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} -{' '}
                            {new Date(req.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <span className="text-[10px] text-navy text-opacity-40 font-bold uppercase">{duration} {duration === 1 ? 'day' : 'days'}</span>
                        </td>

                        {/* Reason */}
                        <td className="p-4 text-xs text-navy text-opacity-70 max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>

                        {/* Status Badge */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            req.status === 'Approved' ? 'bg-green-100 text-success' :
                            req.status === 'Rejected' ? 'bg-red-100 text-error' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {req.status}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="p-4 text-right">
                          {req.status === 'Pending' ? (
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="btn-gold text-xs py-1.5 px-3 rounded-lg"
                            >
                              Review Request
                            </button>
                          ) : (
                            <div className="text-xs text-right">
                              <p className="font-bold text-navy">Reviewed by {req.reviewedBy?.fullName || 'HR'}</p>
                              <p className="text-[10px] text-navy text-opacity-40 italic mt-0.5">{req.reviewNote || 'No comment'}</p>
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Review Modal ──────────────────────────────────────── */}
        <AnimatePresence>
          {selectedRequest && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedRequest(null)}
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
                    <FileText className="text-gold" size={20} /> Review Leave Request
                  </h2>
                  <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <div className="space-y-4 text-left text-xs mb-5">
                  <div className="bg-cream p-3 rounded-xl border border-navy border-opacity-5">
                    <p className="font-bold text-navy text-sm">{selectedRequest.employee?.fullName}</p>
                    <p className="text-navy text-opacity-50 mt-0.5">{selectedRequest.employee?.designation} · {selectedRequest.employee?.department}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-navy border-opacity-5">
                    <div>
                      <p className="font-bold text-navy text-opacity-45 uppercase tracking-widest text-[10px]">Leave Type</p>
                      <p className="font-semibold text-navy text-sm mt-1">{selectedRequest.leaveType}</p>
                    </div>
                    <div>
                      <p className="font-bold text-navy text-opacity-45 uppercase tracking-widest text-[10px]">Duration</p>
                      <p className="font-semibold text-navy text-sm mt-1">
                        {getDurationInDays(selectedRequest.fromDate, selectedRequest.toDate)} Days
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-navy text-opacity-45 uppercase tracking-widest text-[10px] mb-1">Reason</p>
                    <p className="text-navy leading-relaxed bg-cream p-2.5 rounded-xl border border-navy border-opacity-5 italic">
                      "{selectedRequest.reason}"
                    </p>
                  </div>

                  <div>
                    <label className="label uppercase tracking-widest text-[10px] text-navy text-opacity-45">Review Comments / Notes</label>
                    <textarea
                      placeholder="Add an approval note or rejection reasoning here..."
                      value={reviewNote}
                      onChange={e => setReviewNote(e.target.value)}
                      className="input min-h-[80px] text-xs py-2"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-navy border-opacity-10">
                  <button
                    onClick={() => handleReview('Approved')}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1 py-2 text-sm flex items-center justify-center gap-1.5 rounded-xl transition-colors"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview('Rejected')}
                    disabled={actionLoading}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold flex-1 py-2 text-sm flex items-center justify-center gap-1.5 rounded-xl transition-colors"
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="btn-secondary flex-1 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
