import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, MessageSquare, Eye, Clock, Users, ShieldCheck } from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';

function InitialsAvatar({ name, size = 36 }) {
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('') : '?';
  return (
    <div className="rounded-full bg-navy text-gold font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

export default function HRMessageMonitor() {
  const { on, off, emit } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const { data } = await api.get('/messages/monitor/all');
        setConversations(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  const openConversation = async (conv) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    try {
      const { data } = await api.get(`/messages/${conv._id}`);
      setMessages(data);
      // Silently join the room for monitoring (verified HR on socket level)
      emit('hr_monitor_chat', { conversationId: conv._id });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  // Listen for new messages in monitored conversations
  useEffect(() => {
    const handleNewMsg = ({ message }) => {
      if (message.conversationId === selectedConv?._id) {
        setMessages(prev => [...prev, message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };
    on('receive_message', handleNewMsg);
    return () => off('receive_message', handleNewMsg);
  }, [selectedConv]);

  const filteredConvs = conversations.filter(conv => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return conv.participants?.some(p => p.fullName?.toLowerCase().includes(q)) ||
      conv.groupName?.toLowerCase().includes(q);
  });

  const getConvTitle = (conv) => {
    if (conv.type === 'group') return conv.groupName || 'Group Chat';
    return conv.participants?.map(p => p.fullName).join(' ↔ ') || 'Direct Chat';
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 flex flex-col p-8 max-h-screen">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <p className="text-gold text-sm font-semibold tracking-widest uppercase mb-1">Human Resources</p>
          <h1 className="font-heading text-navy text-3xl font-bold flex items-center gap-3">
            <ShieldCheck className="text-gold" size={32} />
            Message Monitor
          </h1>
          <p className="text-navy/50 text-sm mt-1">
            Read-only view of all employee conversations. You are invisible to users.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-gold/10 rounded-xl border border-gold/20">
            <Eye size={15} className="text-gold" />
            <span className="text-xs font-bold text-navy">Silent Monitoring Mode — Employees cannot see you joined.</span>
          </div>
        </motion.div>

        {/* Two-panel layout */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Conversation list */}
          <div className="w-72 flex-shrink-0 bg-white rounded-2xl shadow-card flex flex-col overflow-hidden">
            <div className="p-4 border-b border-navy/10">
              <div className="relative">
                <Search className="absolute left-3 top-3 text-navy/40" size={15} />
                <input type="text" placeholder="Search conversations..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} className="input pl-9 py-2 text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-navy/5">
              {loading ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gold" /></div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-navy/30">
                  <MessageSquare size={32} />
                  <p className="text-sm">No conversations</p>
                </div>
              ) : filteredConvs.map(conv => (
                <button key={conv._id} onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 hover:bg-gold/5 transition-colors ${selectedConv?._id === conv._id ? 'bg-gold/10 border-l-4 border-gold' : ''}`}>
                  <div className="flex items-center gap-3">
                    {conv.type === 'group'
                      ? <div className="w-9 h-9 bg-navy rounded-full flex items-center justify-center flex-shrink-0"><Users size={15} className="text-gold" /></div>
                      : <InitialsAvatar name={conv.participants?.[0]?.fullName} size={36} />
                    }
                    <div className="min-w-0">
                      <p className="font-bold text-navy text-sm truncate">{getConvTitle(conv)}</p>
                      {conv.lastMessage && (
                        <p className="text-xs text-navy/50 truncate mt-0.5">{conv.lastMessage.content || '[attachment]'}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message view (read-only) */}
          <div className="flex-1 bg-white rounded-2xl shadow-card flex flex-col overflow-hidden">
            {!selectedConv ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-navy/30">
                <Eye size={48} />
                <p className="font-heading text-xl">Select a conversation to monitor</p>
                <p className="text-sm text-center max-w-xs">All messages are displayed in read-only mode. Employees are not notified of HR monitoring.</p>
              </div>
            ) : (
              <>
                {/* Conv header */}
                <div className="p-4 border-b border-navy/10 bg-navy/[0.02] flex items-center gap-3">
                  {selectedConv.type === 'group'
                    ? <div className="w-10 h-10 bg-navy rounded-full flex items-center justify-center flex-shrink-0"><Users size={16} className="text-gold" /></div>
                    : <InitialsAvatar name={getConvTitle(selectedConv)} size={40} />
                  }
                  <div>
                    <p className="font-heading font-bold text-navy">{getConvTitle(selectedConv)}</p>
                    <p className="text-xs text-navy/50">
                      {selectedConv.participants?.length} participant(s) · Monitoring silently
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-gold bg-gold/10 px-3 py-1.5 rounded-full">
                    <Eye size={12} /> Monitoring
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gold" /></div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-navy/30">
                      <MessageSquare size={32} />
                      <p className="text-sm">No messages in this conversation yet.</p>
                    </div>
                  ) : (
                    <>
                      <div className="text-center text-xs text-navy/40 py-2 bg-gold/5 rounded-xl">
                        ⚠️ Messages auto-delete after 14 days. Older history may not be available.
                      </div>
                      {messages.map(msg => (
                        <div key={msg._id} className="flex gap-3 items-start">
                          {msg.sender?.profilePhoto
                            ? <img src={msg.sender.profilePhoto} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-1" />
                            : <InitialsAvatar name={msg.sender?.fullName} size={32} />
                          }
                          <div className="flex-1 max-w-xl">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="font-bold text-navy text-sm">{msg.sender?.fullName}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${msg.sender?.role === 'hr' ? 'bg-gold/20 text-navy' : 'bg-navy/10 text-navy'}`}>
                                {msg.sender?.role?.toUpperCase()}
                              </span>
                              <span className="text-xs text-navy/40 ml-auto">
                                {new Date(msg.createdAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                            <div className="bg-cream rounded-2xl rounded-tl-none px-4 py-2.5 text-sm text-navy">
                              {msg.type === 'text' && msg.content}
                              {msg.type === 'image' && <img src={msg.attachmentUrl} className="max-w-xs rounded-xl" alt="attachment" />}
                              {msg.type === 'pdf' && (
                                <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors">
                                  📄 {msg.attachmentName || 'Document.pdf'}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Read-only indicator */}
                <div className="p-4 border-t border-navy/10 bg-navy/[0.02]">
                  <div className="flex items-center justify-center gap-2 text-navy/40 text-sm">
                    <ShieldCheck size={16} className="text-gold" />
                    <span>Read-only monitoring mode. You cannot send messages from this panel.</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
