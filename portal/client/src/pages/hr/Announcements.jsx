import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Megaphone, Plus, Pin, Trash2, Calendar, Send,
  Globe, Laptop, ShieldAlert, Loader2, X
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import api from '../../utils/api';

export default function HRAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState('All');
  const [isPinned, setIsPinned] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAnnouncements = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim() || !description.trim()) {
      setFormError('Title and Description are required.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/announcements', {
        title,
        description,
        audience,
        isPinned
      });
      setShowPostModal(false);
      // Reset form
      setTitle('');
      setDescription('');
      setAudience('All');
      setIsPinned(false);
      fetchAnnouncements();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to post announcement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden">
        
        {/* Header bar */}
        <Header title="Announcements Board" />

        <div className="flex justify-between items-center mb-8">
          <p className="text-navy text-opacity-50 text-sm">Post announcements, alerts, and system notices targeting specific user audience.</p>
          <button
            onClick={() => setShowPostModal(true)}
            className="btn-gold flex items-center gap-2"
          >
            <Plus size={16} /> Broadcast Notice
          </button>
        </div>

        {loading ? (
          <div className="card py-20 text-center flex flex-col items-center justify-center">
            <Loader2 size={32} className="animate-spin text-gold mb-3" />
            <p className="text-navy text-opacity-50 text-sm">Loading broadcasts...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {announcements.length === 0 ? (
              <div className="card py-16 text-center text-navy text-opacity-40">
                <Megaphone size={48} className="mx-auto mb-4 opacity-35 text-navy" />
                <p className="text-lg font-heading font-bold">No broadcasts yet</p>
                <p className="text-sm mt-1">Use the "Broadcast Notice" button to alert employees.</p>
              </div>
            ) : (
              announcements.map(ann => (
                <motion.div
                  key={ann._id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`card relative overflow-hidden border-l-4 ${
                    ann.isPinned ? 'border-gold bg-gold bg-opacity-[0.02]' : 'border-navy border-opacity-30'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      {/* Meta badges */}
                      <div className="flex items-center gap-2 mb-3">
                        {ann.isPinned && (
                          <span className="badge-gold text-[10px] uppercase font-bold flex items-center gap-0.5">
                            <Pin size={10} className="fill-current" /> Pinned
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                          ann.audience === 'All' ? 'badge-success' :
                          ann.audience === 'IT' ? 'badge-it' : 'badge-non-it'
                        }`}>
                          {ann.audience === 'All' ? <Globe size={10} /> : <Laptop size={10} />}
                          {ann.audience} Audience
                        </span>
                      </div>

                      <h3 className="font-heading text-navy text-xl font-bold mb-2">{ann.title}</h3>
                      <p className="text-navy text-opacity-70 text-sm leading-relaxed whitespace-pre-wrap">{ann.description}</p>

                      <p className="text-[10px] text-navy text-opacity-40 mt-4 font-medium">
                        Posted by {ann.postedBy?.fullName || 'HR'} on {new Date(ann.createdAt).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    {/* Delete action */}
                    <button
                      onClick={() => handleDelete(ann._id)}
                      className="p-2 hover:bg-red-50 text-error rounded-xl transition-colors self-start"
                      title="Delete announcement"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ─── Post Announcement Modal ──────────────────────────── */}
        <AnimatePresence>
          {showPostModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPostModal(false)}
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
                    <Megaphone className="text-gold" size={20} /> Broadcast Notice
                  </h2>
                  <button onClick={() => setShowPostModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <form onSubmit={handlePostAnnouncement} className="space-y-4 text-left">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-error rounded-xl p-3 text-xs flex items-center gap-2 font-semibold">
                      <ShieldAlert size={14} /> {formError}
                    </div>
                  )}

                  <div>
                    <label className="label">Title</label>
                    <input
                      type="text"
                      placeholder="Enter a descriptive alert header..."
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Content / Body</label>
                    <textarea
                      placeholder="Write details of the broadcast alert..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="input min-h-[100px] py-2.5 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Audience Scope</label>
                    <select
                      value={audience}
                      onChange={e => setAudience(e.target.value)}
                      className="input"
                    >
                      <option value="All">All Employees</option>
                      <option value="IT">IT Only</option>
                      <option value="Non-IT">Non-IT Only</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="isPinned"
                      checked={isPinned}
                      onChange={e => setIsPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-gold focus:ring-gold border-navy border-opacity-15 cursor-pointer"
                    />
                    <label htmlFor="isPinned" className="text-xs font-semibold text-navy cursor-pointer flex items-center gap-1">
                      <Pin size={12} className="text-gold fill-current" /> Pin to Dashboard Banner
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-navy border-opacity-10">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-gold flex-1 py-2 text-sm flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Publish Notice
                    </button>
                    <button type="button" onClick={() => setShowPostModal(false)} className="btn-secondary flex-1 py-2 text-sm">
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
