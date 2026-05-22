import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Users, UserPlus, Info, CheckCheck, Check,
  Loader2, X, PlusCircle, Laptop, Paperclip, Search, Settings,
  Trash2, FileText, ChevronRight, AlertCircle, Download, Play, Pause, Music, File, FileCode, Eye
} from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import { Header } from '../../components/common/Header';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api, { API_BASE_URL, getFullUrl } from '../../utils/api';


export default function Messages() {
  const { user } = useAuth();
  const { on, off, emit, onlineUsers } = useSocket();

  // Active Chats Tab: 'direct' or 'group'
  const [activeTab, setActiveTab] = useState('direct');

  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeConv, setActiveConv] = useState(null); // structure: { _id, isGroup, ... }
  
  const [messages, setMessages] = useState([]);
  const [usersList, setUsersList] = useState([]); // other users
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Message Send state
  const [messageText, setMessageText] = useState('');

  // Attachment upload states
  const [attachment, setAttachment] = useState(null); // { url, filename, type }
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [activePreviewImage, setActivePreviewImage] = useState(null);
  const fileInputRef = useRef(null);

  // Direct chat creation modal state
  const [showDirectModal, setShowDirectModal] = useState(false);

  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);

  // Group settings/management modal state (HR only)
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupMembers, setEditGroupMembers] = useState([]);

  // Typing status states
  const [typingUsers, setTypingUsers] = useState({}); // conversationId/groupId -> Array of typing user names
  const typingTimeoutRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fetch direct conversations
  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/messages/conversations');
      // Filter direct types
      setConversations(data.filter(c => c.type === 'direct'));
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  // Fetch groups
  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups');
      setGroups(data);
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  // Fetch all users to start chat
  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsersList(data.filter(u => u._id !== user._id && u.isActive));
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchConversations(), fetchGroups(), fetchUsers()]);
    setLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Listen to Socket events
  useEffect(() => {
    // 1. Direct Message Received
    const handleReceiveMessage = ({ message }) => {
      if (activeConv && !activeConv.isGroup && message.conversationId === activeConv._id) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        emit('mark_read', { conversationId: activeConv._id });
      }
      fetchConversations();
    };

    // 2. Group Message Received
    const handleReceiveGroupMessage = ({ message, groupId }) => {
      if (activeConv && activeConv.isGroup && groupId === activeConv._id) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
      fetchGroups();
    };

    // 3. Message Ticks
    const handleMessageDelivered = ({ messageId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deliveredStatus: true } : m));
    };

    const handleMessageSeen = ({ conversationId }) => {
      if (activeConv && !activeConv.isGroup && conversationId === activeConv._id) {
        setMessages(prev => prev.map(m => !m.seenStatus ? { ...m, seenStatus: true, seenAt: new Date() } : m));
      }
    };

    // 4. Typing Indicator
    const handleUserTyping = ({ userId: typingUserId, name, conversationId }) => {
      if (typingUserId === user._id) return;
      setTypingUsers(prev => {
        const currentList = prev[conversationId] || [];
        if (name) {
          if (!currentList.includes(name)) {
            return { ...prev, [conversationId]: [...currentList, name] };
          }
        } else {
          return { ...prev, [conversationId]: currentList.filter(n => n !== name) };
        }
        return prev;
      });
    };

    // 5. Group Lifecycle events
    const handleGroupCreated = () => { fetchGroups(); };
    const handleGroupUpdated = ({ group }) => {
      fetchGroups();
      if (activeConv && activeConv.isGroup && activeConv._id === group._id) {
        setActiveConv(prev => ({ ...prev, groupName: group.groupName }));
      }
    };
    const handleGroupDeleted = ({ groupId }) => {
      fetchGroups();
      if (activeConv && activeConv.isGroup && activeConv._id === groupId) {
        setActiveConv(null);
        setMessages([]);
        alert('This group has been deleted by HR.');
      }
    };

    // 6. Socket Reconnection & Recovery Handler
    const handleConnect = () => {
      console.log('⚡ Socket connected/reconnected. Recovering rooms...');
      if (activeConv) {
        if (activeConv.isGroup) {
          emit('join_group', { groupId: activeConv._id });
        } else {
          emit('join_room', { conversationId: activeConv._id });
        }
      }
    };

    // 7. Attachment Events
    const handleReceiveAttachment = ({ attachment, conversationId, groupId }) => {
      console.log('📎 Attachment event received:', attachment);
      if (conversationId) fetchConversations();
      if (groupId) fetchGroups();
    };

    const handleAttachmentDelivered = ({ attachmentId }) => {
      setMessages(prev => prev.map(m => {
        const matches = m.attachmentId === attachmentId || m.attachmentId?._id === attachmentId;
        return matches ? { ...m, deliveredStatus: true } : m;
      }));
    };

    const handleAttachmentSeen = ({ attachmentId }) => {
      setMessages(prev => prev.map(m => {
        const matches = m.attachmentId === attachmentId || m.attachmentId?._id === attachmentId;
        return matches ? { ...m, seenStatus: true, seenAt: new Date() } : m;
      }));
    };

    const handleAttachmentDownloaded = ({ attachmentId, userId: downloaderId, userName }) => {
      console.log(`📥 Attachment ${attachmentId} was downloaded by ${userName}`);
      if (downloaderId !== user._id) {
        setMessages(prev => prev.map(m => {
          const matches = m.attachmentId === attachmentId || m.attachmentId?._id === attachmentId;
          if (matches) {
            const currentDownloads = m.downloadedBy || [];
            if (!currentDownloads.includes(userName)) {
              return { ...m, downloadedBy: [...currentDownloads, userName] };
            }
          }
          return m;
        }));
      }
    };

    on('connect', handleConnect);
    on('receive_message', handleReceiveMessage);
    on('receive_group_message', handleReceiveGroupMessage);
    on('message_delivered', handleMessageDelivered);
    on('message_seen', handleMessageSeen);
    on('user_typing', handleUserTyping);
    on('group_created', handleGroupCreated);
    on('group_updated', handleGroupUpdated);
    on('group_deleted', handleGroupDeleted);
    on('receive_attachment', handleReceiveAttachment);
    on('attachment_delivered', handleAttachmentDelivered);
    on('attachment_seen', handleAttachmentSeen);
    on('attachment_downloaded', handleAttachmentDownloaded);

    return () => {
      off('connect', handleConnect);
      off('receive_message', handleReceiveMessage);
      off('receive_group_message', handleReceiveGroupMessage);
      off('message_delivered', handleMessageDelivered);
      off('message_seen', handleMessageSeen);
      off('user_typing', handleUserTyping);
      off('group_created', handleGroupCreated);
      off('group_updated', handleGroupUpdated);
      off('group_deleted', handleGroupDeleted);
      off('receive_attachment', handleReceiveAttachment);
      off('attachment_delivered', handleAttachmentDelivered);
      off('attachment_seen', handleAttachmentSeen);
      off('attachment_downloaded', handleAttachmentDownloaded);
    };
  }, [activeConv]);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll position when messages or typing indicators change
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  // Select conversation / Group
  const handleSelectConversation = async (conv, isGroup = false) => {
    const selected = { ...conv, isGroup };
    setActiveConv(selected);
    setMessagesLoading(true);
    setPage(1);
    setHasMore(true);
    setShowSearch(false);
    setSearchQuery('');
    setAttachment(null);
    setMessageText('');

    try {
      let res;
      if (isGroup) {
        res = await api.get(`/groups/${conv._id}/messages?page=1&limit=30`);
        emit('join_group', { groupId: conv._id });
      } else {
        res = await api.get(`/messages/${conv._id}?page=1&limit=30`);
        emit('join_room', { conversationId: conv._id });
        emit('mark_read', { conversationId: conv._id });
      }

      setMessages(res.data);
      if (res.data.length < 30) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  // Load more on scroll to top
  const handleScroll = async (e) => {
    const element = e.currentTarget;
    if (element.scrollTop === 0 && hasMore && !messagesLoading && activeConv) {
      const prevScrollHeight = element.scrollHeight;
      const nextPage = page + 1;
      setPage(nextPage);
      setMessagesLoading(true);

      try {
        let res;
        if (activeConv.isGroup) {
          res = await api.get(`/groups/${activeConv._id}/messages?page=${nextPage}&limit=30`);
        } else {
          res = await api.get(`/messages/${activeConv._id}?page=${nextPage}&limit=30`);
        }

        const newMsgs = res.data;
        if (newMsgs.length < 30) {
          setHasMore(false);
        }

        setMessages(prev => [...newMsgs, ...prev]);

        // Restore scroll position
        setTimeout(() => {
          element.scrollTop = element.scrollHeight - prevScrollHeight;
        }, 50);
      } catch (err) {
        console.error('Failed to load more messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    }
  };

  // Start direct conversation
  const handleStartDirectChat = async (targetUser) => {
    try {
      const { data } = await api.post('/messages/conversations', {
        type: 'direct',
        participantId: targetUser._id
      });
      await fetchConversations();
      handleSelectConversation(data, false);
      setShowDirectModal(false);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  // Create group conversation (HR Only)
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedParticipants.length === 0) return;

    try {
      const { data } = await api.post('/groups', {
        groupName: groupName.trim(),
        groupDescription: groupDescription.trim(),
        members: selectedParticipants
      });

      await fetchGroups();
      // Join group room via socket
      emit('join_group', { groupId: data.group._id });
      handleSelectConversation(data.group, true);
      
      setShowGroupModal(false);
      setGroupName('');
      setGroupDescription('');
      setSelectedParticipants([]);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  // Group settings edit modal open (HR Only)
  const openGroupSettings = () => {
    if (!activeConv || !activeConv.isGroup || user.role !== 'hr') return;
    setEditGroupName(activeConv.groupName);
    setEditGroupDescription(activeConv.groupDescription || '');
    setEditGroupMembers(activeConv.members.map(m => m._id));
    setShowGroupSettingsModal(true);
  };

  // Update Group details (HR Only)
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!editGroupName.trim()) return;

    try {
      const { data } = await api.put(`/groups/${activeConv._id}`, {
        groupName: editGroupName.trim(),
        groupDescription: editGroupDescription.trim(),
        members: editGroupMembers
      });

      await fetchGroups();
      setActiveConv(prev => ({
        ...prev,
        groupName: data.groupName,
        groupDescription: data.groupDescription,
        members: data.members
      }));
      setShowGroupSettingsModal(false);
    } catch (err) {
      console.error('Failed to update group:', err);
    }
  };

  // Delete Group (HR Only)
  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this group? This action cannot be undone.')) return;

    try {
      await api.delete(`/groups/${activeConv._id}`);
      setActiveConv(null);
      setMessages([]);
      await fetchGroups();
      setShowGroupSettingsModal(false);
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  // Handle typing triggers
  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    if (!activeConv) return;

    const roomId = activeConv.isGroup ? `group_${activeConv._id}` : activeConv._id;
    emit('typing_start', { conversationId: roomId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      emit('typing_stop', { conversationId: roomId });
    }, 2000);
  };

  // Attachment upload selector triggers
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate extension
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.pdf', '.xml', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.docx', '.xlsx'];
    if (!allowedExts.includes(ext)) {
      alert('Unsupported file extension. Only PDF, XML, JPG, JPEG, PNG, MP3, WAV, DOCX, XLSX are allowed.');
      return;
    }

    // Validate size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds the 10MB limit.');
      return;
    }

    setUploadingAttachment(true);
    setUploadProgress(0);
    setUploadingFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    if (activeConv.isGroup) {
      formData.append('groupId', activeConv._id);
      formData.append('isGroup', 'true');
    } else {
      formData.append('conversationId', activeConv._id);
      formData.append('isGroup', 'false');
    }

    try {
      await api.post('/attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Attachment upload failed.');
    } finally {
      setUploadingAttachment(false);
      setUploadProgress(null);
      setUploadingFileName('');
      // Clear input so selecting the same file triggers change again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageText.trim() && !attachment) return;

    const content = messageText.trim();
    
    if (activeConv.isGroup) {
      emit('send_group_message', {
        groupId: activeConv._id,
        content,
        type: attachment ? attachment.type : 'text',
        attachmentUrl: attachment ? attachment.url : '',
        attachmentName: attachment ? attachment.filename : ''
      });
    } else {
      emit('send_message', {
        conversationId: activeConv._id,
        content,
        type: attachment ? attachment.type : 'text',
        attachmentUrl: attachment ? attachment.url : '',
        attachmentName: attachment ? attachment.filename : ''
      });
    }

    // Reset input states
    setMessageText('');
    setAttachment(null);
    
    const roomId = activeConv.isGroup ? `group_${activeConv._id}` : activeConv._id;
    emit('typing_stop', { conversationId: roomId });
  };

  // Helper details
  const getParticipantDetails = (conv) => {
    const other = conv.participants?.find(p => p._id !== user._id) || {};
    const isOnline = onlineUsers.has(other._id);
    return {
      name: other.fullName || 'Teuly Colleague',
      image: getFullUrl(other.profilePhoto),
      isOnline,
      role: other.designation || 'Team Member',
      lastSeen: other.lastSeen
    };
  };

  // Search filter matching
  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-gold text-navy px-0.5 rounded font-bold">{part}</mark> : part
    );
  };

  // Format dates cleanly
  const formatMessageDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Presence lastSeen parser
  const parseLastSeen = (lastSeenTime) => {
    if (!lastSeenTime) return 'Offline';
    const date = new Date(lastSeenTime);
    return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownloadAttachment = async (attachmentId, originalFileName) => {
    try {
      const response = await api.get(`/attachments/download/${attachmentId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      // Emit socket notification to room
      emit('attachment_downloaded', { attachmentId });
    } catch (err) {
      alert(err.response?.data?.message || 'Download failed or unauthorized.');
    }
  };

  const handlePreviewPDF = async (attachmentId, originalFileName) => {
    try {
      const response = await api.get(`/attachments/download/${attachmentId}`, {
        responseType: 'blob',
      });
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      window.open(fileURL, '_blank');
    } catch (err) {
      alert('Unable to preview PDF.');
    }
  };

  const renderAttachmentCard = (msg, isMe) => {
    const attachmentId = msg.attachmentId?._id || msg.attachmentId || msg.attachmentUrl?.split('/').pop();
    const fileName = msg.attachmentName || msg.attachmentId?.originalFileName || 'Attachment';
    const fileSize = msg.attachmentId?.fileSize || 0;
    const fileType = msg.type || msg.messageType || msg.attachmentId?.fileType || 'document';
    const downloadUrl = getFullUrl(`/api/attachments/download/${attachmentId}`);

    if (!attachmentId) return null;

    const formattedSize = formatFileSize(fileSize);

    switch (fileType) {
      case 'image':
        return (
          <div className="group relative rounded-xl overflow-hidden cursor-pointer border border-navy/10 hover:border-gold transition-all duration-300 max-w-xs shadow-md bg-navy bg-opacity-5">
            <img
              src={downloadUrl}
              alt={fileName}
              className="max-h-60 object-cover w-full hover:scale-[1.02] transition-transform duration-300"
              onClick={() => setActivePreviewImage(downloadUrl)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
              <p className="text-white text-xs font-bold truncate">{fileName}</p>
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-white/70 font-semibold">{formattedSize}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadAttachment(attachmentId, fileName);
                  }}
                  className="p-1 bg-gold text-navy rounded hover:bg-white transition-colors"
                  title="Download"
                >
                  <Download size={12} />
                </button>
              </div>
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className={`p-3 rounded-xl border flex flex-col gap-2 max-w-xs transition-all duration-300 ${
            isMe
              ? 'bg-navy bg-opacity-30 border-white/10 text-white'
              : 'bg-white border-navy/10 text-navy'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate" title={fileName}>{fileName}</p>
                <p className="text-[10px] font-semibold opacity-60">{formattedSize}</p>
              </div>
            </div>
            <div className="flex gap-2 border-t border-navy/5 pt-2 mt-1">
              <button
                type="button"
                onClick={() => handlePreviewPDF(attachmentId, fileName)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold transition-colors ${
                  isMe
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-cream hover:bg-gold/20 text-navy'
                }`}
              >
                <Eye size={12} /> Preview
              </button>
              <button
                type="button"
                onClick={() => handleDownloadAttachment(attachmentId, fileName)}
                className="flex-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold bg-gold text-navy hover:bg-opacity-90 transition-colors"
              >
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className={`p-3 rounded-xl border flex flex-col gap-2 max-w-xs w-72 transition-all duration-300 ${
            isMe
              ? 'bg-navy bg-opacity-30 border-white/10 text-white'
              : 'bg-white border-navy/10 text-navy'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gold/20 text-gold flex items-center justify-center flex-shrink-0">
                <Music size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate" title={fileName}>{fileName}</p>
                <p className="text-[10px] font-semibold opacity-60">{formattedSize}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadAttachment(attachmentId, fileName)}
                className="p-1.5 bg-gold text-navy rounded hover:bg-opacity-95 transition-colors"
                title="Download"
              >
                <Download size={12} />
              </button>
            </div>
            <audio controls className="w-full h-8 mt-1 rounded bg-cream/10" src={downloadUrl}>
              Your browser does not support the audio element.
            </audio>
          </div>
        );

      case 'xml':
        return (
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 max-w-xs transition-all duration-300 ${
            isMe
              ? 'bg-navy bg-opacity-30 border-white/10 text-white'
              : 'bg-white border-navy/10 text-navy'
          }`}>
            <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
              <FileCode size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate" title={fileName}>{fileName}</p>
              <p className="text-[10px] font-semibold opacity-60">{formattedSize} · XML Data</p>
            </div>
            <button
              type="button"
              onClick={() => handleDownloadAttachment(attachmentId, fileName)}
              className="p-1.5 bg-gold text-navy rounded hover:bg-opacity-95 transition-colors"
              title="Download File"
            >
              <Download size={14} />
            </button>
          </div>
        );

      default: // Document (Word, Excel, or fallback)
        return (
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 max-w-xs transition-all duration-300 ${
            isMe
              ? 'bg-navy bg-opacity-30 border-white/10 text-white'
              : 'bg-white border-navy/10 text-navy'
          }`}>
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
              <File size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate" title={fileName}>{fileName}</p>
              <p className="text-[10px] font-semibold opacity-60">{formattedSize} · Document</p>
            </div>
            <button
              type="button"
              onClick={() => handleDownloadAttachment(attachmentId, fileName)}
              className="p-1.5 bg-gold text-navy rounded hover:bg-opacity-95 transition-colors"
              title="Download File"
            >
              <Download size={14} />
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-7xl relative overflow-hidden flex flex-col h-screen max-h-screen">
        
        {/* Header Section */}
        <div className="flex-shrink-0">
          <Header title="Collaborations & Messaging" />
        </div>

        {/* Unified Panel Layout */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white rounded-3xl shadow-card border border-navy border-opacity-5 mb-8">
          
          {/* ─── Left Sidebar: Chats and Channels ─────────────────── */}
          <div className="lg:border-r border-navy border-opacity-10 flex flex-col h-full overflow-hidden bg-white">
            
            {/* Panel Tabs Header */}
            <div className="p-4 border-b border-navy border-opacity-5 flex justify-between items-center bg-navy bg-opacity-[0.02] flex-shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('direct')}
                  className={`text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'direct'
                      ? 'bg-navy text-gold shadow-sm'
                      : 'text-navy text-opacity-50 hover:bg-cream'
                  }`}
                >
                  Direct Chats
                </button>
                <button
                  onClick={() => setActiveTab('group')}
                  className={`text-xs font-bold tracking-wider uppercase px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'group'
                      ? 'bg-navy text-gold shadow-sm'
                      : 'text-navy text-opacity-50 hover:bg-cream'
                  }`}
                >
                  Channels
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowDirectModal(true)}
                  className="p-1.5 hover:bg-cream text-navy hover:text-gold rounded-lg transition-colors border border-navy border-opacity-10"
                  title="New Direct Chat"
                >
                  <UserPlus size={15} />
                </button>
                {user.role === 'hr' && (
                  <button
                    onClick={() => setShowGroupModal(true)}
                    className="p-1.5 hover:bg-cream text-navy hover:text-gold rounded-lg transition-colors border border-navy border-opacity-10"
                    title="New Group Channel"
                  >
                    <PlusCircle size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Chats Listing */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="py-12 text-center text-xs text-navy text-opacity-40 flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin text-gold" /> Syncing feeds...
                </div>
              ) : activeTab === 'direct' ? (
                // Direct conversations
                conversations.length === 0 ? (
                  <div className="p-8 text-center text-xs text-navy text-opacity-35 italic flex flex-col items-center gap-3">
                    <span>No active direct chats.</span>
                    <button
                      onClick={() => setShowDirectModal(true)}
                      className="px-3 py-1.5 text-xs font-semibold bg-navy text-gold rounded-lg hover:bg-opacity-95 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <UserPlus size={13} /> Start Direct Chat
                    </button>
                  </div>
                ) : (
                  conversations.map(conv => {
                    const { name, image, isOnline } = getParticipantDetails(conv);
                    const isSelected = activeConv?._id === conv._id && !activeConv.isGroup;

                    // Unread indicators
                    const isLastMessageUnread = conv.lastMessage && 
                      conv.lastMessage.sender !== user._id &&
                      (!conv.lastMessage.readBy || !conv.lastMessage.readBy.includes(user._id));

                    return (
                      <button
                        key={conv._id}
                        onClick={() => handleSelectConversation(conv, false)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left ${
                          isSelected
                            ? 'bg-navy text-white shadow-md'
                            : 'hover:bg-cream text-navy'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          {image ? (
                            <img src={image} alt={name} className="w-10 h-10 rounded-full object-cover border border-navy border-opacity-10" />
                          ) : (
                            <div className={`w-10 h-10 rounded-full bg-navy ${isSelected ? 'bg-opacity-20 text-gold' : 'bg-opacity-10 text-navy'} flex items-center justify-center font-bold text-sm border border-navy border-opacity-5`}>
                              {name ? name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase() : '?'}
                            </div>
                          )}
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                            isSelected ? 'border-navy' : 'border-white'
                          } ${isOnline ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-gold' : 'text-navy'} ${isLastMessageUnread ? 'font-black' : ''}`}>
                              {name}
                            </p>
                            <span className={`text-[9px] ${isSelected ? 'text-white text-opacity-65' : 'text-navy text-opacity-40'}`}>
                              {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className={`text-xs truncate ${isSelected ? 'text-white text-opacity-70' : 'text-navy text-opacity-55'} ${isLastMessageUnread ? 'font-bold text-navy text-opacity-90' : ''}`}>
                              {conv.lastMessage?.type === 'image' ? '📸 Image' : conv.lastMessage?.type === 'pdf' ? '📄 Document' : conv.lastMessage?.content || 'No messages yet.'}
                            </p>
                            {isLastMessageUnread && (
                              <div className="w-2.5 h-2.5 bg-error rounded-full flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )
              ) : (
                // Group channels listing
                groups.length === 0 ? (
                  <div className="p-8 text-center text-xs text-navy text-opacity-35 italic flex flex-col items-center gap-3">
                    <span>No active channels.</span>
                    {user.role === 'hr' ? (
                      <button
                        onClick={() => setShowGroupModal(true)}
                        className="px-3 py-1.5 text-xs font-semibold bg-navy text-gold rounded-lg hover:bg-opacity-95 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <PlusCircle size={13} /> Create Group Channel
                      </button>
                    ) : (
                      <span>Contact HR to join a channel.</span>
                    )}
                  </div>
                ) : (
                  groups.map(group => {
                    const isSelected = activeConv?._id === group._id && activeConv.isGroup;
                    return (
                      <button
                        key={group._id}
                        onClick={() => handleSelectConversation(group, true)}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left ${
                          isSelected
                            ? 'bg-navy text-white shadow-md'
                            : 'hover:bg-cream text-navy'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl bg-gold flex items-center justify-center ${isSelected ? 'bg-navy border border-gold text-gold' : 'text-navy'} font-bold text-sm`}>
                            <Users size={18} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <p className={`text-sm font-semibold truncate ${isSelected ? 'text-gold' : 'text-navy'}`}>
                              {group.groupName}
                            </p>
                            <span className={`text-[9px] ${isSelected ? 'text-white text-opacity-65' : 'text-navy text-opacity-40'}`}>
                              {group.updatedAt ? new Date(group.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-white text-opacity-70' : 'text-navy text-opacity-55'}`}>
                            {group.groupDescription || `${group.members?.length} members`}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )
              )}
            </div>
          </div>

          {/* ─── Right Panel: Chat Stream Area ─────────────────────── */}
          <div className="lg:col-span-2 flex flex-col h-full overflow-hidden bg-cream bg-opacity-15">
            {activeConv ? (
              <>
                {/* Active Chat Header */}
                <div className="p-4 border-b border-navy border-opacity-5 bg-navy bg-opacity-[0.02] flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {activeConv.isGroup ? (
                      <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center text-navy font-bold text-sm flex-shrink-0">
                        <Users size={20} />
                      </div>
                    ) : (
                      getParticipantDetails(activeConv).image ? (
                        <img src={getParticipantDetails(activeConv).image} alt={getParticipantDetails(activeConv).name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-navy bg-opacity-10 flex items-center justify-center text-navy font-bold text-sm flex-shrink-0 border border-navy border-opacity-5">
                          {getParticipantDetails(activeConv).name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                        </div>
                      )
                    )}

                    <div className="min-w-0">
                      <p className="font-heading font-bold text-navy text-base truncate">
                        {activeConv.isGroup ? activeConv.groupName : getParticipantDetails(activeConv).name}
                      </p>
                      <p className="text-[10px] text-navy text-opacity-50 font-semibold truncate flex items-center gap-1.5 mt-0.5">
                        {activeConv.isGroup ? (
                          <span>👥 {activeConv.members?.length || 0} Members</span>
                        ) : (
                          <>
                            <span className={`w-1.5 h-1.5 rounded-full ${getParticipantDetails(activeConv).isOnline ? 'bg-success' : 'bg-gray-400'}`} />
                            <span>{getParticipantDetails(activeConv).isOnline ? 'Active Now' : parseLastSeen(getParticipantDetails(activeConv).lastSeen)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Header Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Search inside discussion */}
                    <button
                      onClick={() => setShowSearch(s => !s)}
                      className={`p-2 rounded-xl transition-all ${showSearch ? 'bg-navy text-gold' : 'hover:bg-cream text-navy text-opacity-60'}`}
                      title="Search Messages"
                    >
                      <Search size={16} />
                    </button>

                    {/* Group settings (HR Only) */}
                    {activeConv.isGroup && user.role === 'hr' && (
                      <button
                        onClick={openGroupSettings}
                        className="p-2 hover:bg-cream rounded-xl text-navy text-opacity-60 transition-all"
                        title="Group Settings"
                      >
                        <Settings size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Message Search Bar */}
                <AnimatePresence>
                  {showSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-navy bg-opacity-5 border-b border-navy border-opacity-5 px-4 py-2 flex items-center gap-2"
                    >
                      <Search size={14} className="text-navy text-opacity-40" />
                      <input
                        type="text"
                        placeholder="Search text in this discussion..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs font-semibold text-navy placeholder-navy placeholder-opacity-40 focus:outline-none"
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-navy text-opacity-40 hover:text-navy">
                          <X size={14} />
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages Stream Content */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-5 space-y-4"
                >
                  {/* TTL disclaimer */}
                  <div className="bg-gold bg-opacity-10 border border-gold border-opacity-20 rounded-xl px-4 py-2.5 text-center text-xs text-navy font-semibold flex items-center justify-center gap-2">
                    <AlertCircle size={14} className="text-gold" />
                    <span>⚠️ Conversations auto-delete after 14 days. History is kept short.</span>
                  </div>

                  {messagesLoading && page === 1 ? (
                    <div className="h-40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-gold" size={24} />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-navy text-opacity-35 italic">
                      No discussions recorded yet. Say hello!
                    </div>
                  ) : (
                    messages.reduce((acc, msg, i) => {
                      const msgDate = formatMessageDate(msg.createdAt);
                      const prevMsg = messages[i - 1];
                      const prevMsgDate = prevMsg ? formatMessageDate(prevMsg.createdAt) : null;

                      // Insert date boundary separator
                      if (msgDate !== prevMsgDate) {
                        acc.push(
                          <div key={`date-${msg._id}`} className="flex justify-center my-3">
                            <span className="bg-navy bg-opacity-5 border border-navy border-opacity-5 text-navy text-opacity-50 text-[10px] font-bold tracking-widest px-3 py-1 rounded-full uppercase">
                              {msgDate}
                            </span>
                          </div>
                        );
                      }

                      const isMe = (msg.sender?._id || msg.senderId?._id || msg.sender || msg.senderId) === user._id;
                      const senderName = msg.sender?.fullName || msg.senderId?.fullName || 'Colleague';
                      const senderPhoto = getFullUrl(msg.sender?.profilePhoto || msg.senderId?.profilePhoto);
                      const msgType = msg.type || msg.messageType || 'text';

                      acc.push(
                        <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] flex gap-2 items-end ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            
                            {/* Sender Photo (if group or other person) */}
                            {!isMe && (
                              <div className="w-8 h-8 rounded-full bg-navy text-gold flex items-center justify-center font-bold text-xs overflow-hidden flex-shrink-0 border border-navy border-opacity-5">
                                {senderPhoto ? (
                                  <img src={senderPhoto} alt={senderName} className="w-full h-full object-cover" />
                                ) : (
                                  senderName.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase()
                                )}
                              </div>
                            )}

                            {/* Message Bubble Container */}
                            <div className="flex flex-col">
                              {activeConv.isGroup && !isMe && (
                                <span className="text-[9px] font-bold text-navy text-opacity-40 mb-1 ml-1 leading-none">
                                  {senderName}
                                </span>
                              )}
                              
                              <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                                isMe
                                  ? 'bg-navy text-white rounded-tr-none'
                                  : 'bg-white text-navy border border-navy border-opacity-5 rounded-tl-none'
                              }`}>
                                {/* Media Content rendering */}
                                {renderAttachmentCard(msg, isMe)}

                                {/* Highlight search keyword if query active */}
                                {msgType === 'text' && (
                                  <p className="whitespace-pre-wrap font-body text-xs sm:text-sm">
                                    {highlightText(msg.content || msg.message || '', searchQuery)}
                                  </p>
                                )}
                              </div>

                              {/* Message timestamp and status indicators */}
                              <div className="flex items-center justify-end gap-1.5 mt-1 px-1">
                                <span className="text-[9px] text-navy text-opacity-40 leading-none">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>

                                {/* Read Ticks (For direct messages and self messages) */}
                                {isMe && !activeConv.isGroup && (
                                  <div className="flex items-center">
                                    {msg.seenStatus ? (
                                      <CheckCheck size={12} className="text-gold" title="Read" />
                                    ) : msg.deliveredStatus ? (
                                      <CheckCheck size={12} className="text-navy text-opacity-35" title="Delivered" />
                                    ) : (
                                      <Check size={12} className="text-navy text-opacity-30" title="Sent" />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );

                      return acc;
                    }, [])
                  )}

                  {/* Typing Indicator */}
                  {typingUsers[activeConv.isGroup ? `group_${activeConv._id}` : activeConv._id] &&
                   typingUsers[activeConv.isGroup ? `group_${activeConv._id}` : activeConv._id].length > 0 && (
                    <div className="flex justify-start items-center gap-2 text-[10px] text-navy text-opacity-40 italic ml-10">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce [animation-delay:0.4s]" />
                      <span>{typingUsers[activeConv.isGroup ? `group_${activeConv._id}` : activeConv._id].join(', ')} is typing...</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Upload Progress Bar */}
                {uploadingAttachment && (
                  <div className="px-4 py-3 border-t border-navy border-opacity-5 bg-white flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-navy">
                      <span className="flex items-center gap-1.5 truncate max-w-[250px]">
                        <Loader2 size={13} className="animate-spin text-gold" />
                        Uploading: <span className="text-gold font-bold truncate">{uploadingFileName}</span>
                      </span>
                      <span className="text-navy text-opacity-65">{uploadProgress ?? 0}%</span>
                    </div>
                    <div className="w-full bg-cream rounded-full h-2 overflow-hidden border border-navy border-opacity-5">
                      <div
                        className="bg-gold h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress ?? 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Message Input Form */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-navy border-opacity-5 flex gap-2 items-center bg-white flex-shrink-0"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,application/xml,text/xml,audio/*,.docx,.xlsx"
                  />
                  <button
                    type="button"
                    disabled={uploadingAttachment}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 bg-cream hover:bg-navy hover:text-gold text-navy text-opacity-60 rounded-xl transition-all border border-navy border-opacity-5"
                    title="Upload File (PDF, XML, Images, Audio, Word, Excel)"
                  >
                    {uploadingAttachment ? (
                      <Loader2 size={16} className="animate-spin text-gold" />
                    ) : (
                      <Paperclip size={16} />
                    )}
                  </button>

                  <input
                    type="text"
                    placeholder="Type details of your message..."
                    value={messageText}
                    onChange={handleInputChange}
                    className="input flex-grow py-2.5 px-4 text-xs sm:text-sm bg-cream bg-opacity-35 border border-navy border-opacity-5"
                  />

                  <button
                    type="submit"
                    disabled={!messageText.trim() && !attachment}
                    className="p-2.5 bg-navy hover:bg-gold text-white hover:text-navy rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-cream bg-opacity-5">
                <Laptop size={48} className="text-navy opacity-20 mb-3" />
                <p className="font-heading text-navy text-lg font-bold">Select a Discussion</p>
                <p className="text-navy text-opacity-40 text-xs mt-1">
                  Choose a direct colleague or active channel from the left sidebar to coordinate work.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Modal: Start Direct Message Chat ──────────────────── */}
        <AnimatePresence>
          {showDirectModal && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDirectModal(false)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-sm relative z-50 bg-white"
              >
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <UserPlus className="text-gold" size={18} /> New Direct Message
                  </h2>
                  <button onClick={() => setShowDirectModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 py-1">
                  {usersList.map(u => {
                    const isOnline = onlineUsers.has(u._id);
                    return (
                      <button
                        key={u._id}
                        onClick={() => handleStartDirectChat(u)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-cream text-left transition-colors border border-transparent hover:border-navy hover:border-opacity-5"
                      >
                        <div className="relative">
                          {u.profilePhoto ? (
                            <img src={getFullUrl(u.profilePhoto)} alt={u.fullName} className="w-8 h-8 rounded-full object-cover border border-navy border-opacity-5" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-navy text-gold font-bold text-xs flex items-center justify-center">
                              {u.fullName.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('').toUpperCase()}
                            </div>
                          )}
                          <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${isOnline ? 'bg-success animate-pulse' : 'bg-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-bold text-navy text-xs leading-none">{u.fullName}</p>
                          <span className="text-[9px] text-navy text-opacity-40 uppercase font-semibold mt-1 inline-block">
                            {u.designation} · {u.department}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── Modal: Create Group Channel (HR Only) ──────────────── */}
        <AnimatePresence>
          {showGroupModal && user.role === 'hr' && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGroupModal(false)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-md relative z-50 bg-white"
              >
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Users className="text-gold" size={20} /> Start Group Channel
                  </h2>
                  <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <form onSubmit={handleCreateGroup} className="space-y-4 text-left">
                  <div>
                    <label className="label">Group Channel Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering Team, Marketing Sync"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Description (Optional)</label>
                    <input
                      type="text"
                      placeholder="Brief purpose of this channel..."
                      value={groupDescription}
                      onChange={e => setGroupDescription(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label mb-2">Select Members</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-navy border-opacity-15 rounded-xl p-3 bg-cream bg-opacity-35">
                      {usersList.map(u => (
                        <div key={u._id} className="flex items-center gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            id={`group-user-${u._id}`}
                            checked={selectedParticipants.includes(u._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParticipants(prev => [...prev, u._id]);
                              } else {
                                setSelectedParticipants(prev => prev.filter(id => id !== u._id));
                              }
                            }}
                            className="w-4 h-4 rounded text-gold focus:ring-gold border-navy border-opacity-15 cursor-pointer"
                          />
                          <label htmlFor={`group-user-${u._id}`} className="font-semibold text-navy cursor-pointer flex-1">
                            {u.fullName} <span className="text-navy text-opacity-40">({u.designation} · {u.department})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-navy border-opacity-10">
                    <button
                      type="submit"
                      disabled={!groupName.trim() || selectedParticipants.length === 0}
                      className="btn-gold flex-1 py-2.5 text-sm"
                    >
                      Create Channel
                    </button>
                    <button type="button" onClick={() => setShowGroupModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ─── Modal: Group Settings & Management (HR Only) ────────── */}
        <AnimatePresence>
          {showGroupSettingsModal && user.role === 'hr' && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowGroupSettingsModal(false)}
                className="fixed inset-0 bg-navy"
              />
              
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="card w-full max-w-md relative z-50 bg-white"
              >
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-navy border-opacity-10">
                  <h2 className="font-heading text-navy text-xl font-bold flex items-center gap-2">
                    <Settings className="text-gold" size={20} /> Manage Group Channel
                  </h2>
                  <button onClick={() => setShowGroupSettingsModal(false)} className="p-2 hover:bg-cream rounded-full"><X size={16} /></button>
                </div>

                <form onSubmit={handleUpdateGroup} className="space-y-4 text-left">
                  <div>
                    <label className="label">Group Name</label>
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={e => setEditGroupName(e.target.value)}
                      className="input"
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Description</label>
                    <input
                      type="text"
                      value={editGroupDescription}
                      onChange={e => setEditGroupDescription(e.target.value)}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label mb-2">Members Management</label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border border-navy border-opacity-15 rounded-xl p-3 bg-cream bg-opacity-35">
                      {usersList.map(u => (
                        <div key={u._id} className="flex items-center gap-2.5 text-xs">
                          <input
                            type="checkbox"
                            id={`edit-group-user-${u._id}`}
                            checked={editGroupMembers.includes(u._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditGroupMembers(prev => [...prev, u._id]);
                              } else {
                                setEditGroupMembers(prev => prev.filter(id => id !== u._id));
                              }
                            }}
                            className="w-4 h-4 rounded text-gold focus:ring-gold border-navy border-opacity-15 cursor-pointer"
                          />
                          <label htmlFor={`edit-group-user-${u._id}`} className="font-semibold text-navy cursor-pointer flex-1">
                            {u.fullName} <span className="text-navy text-opacity-40">({u.designation} · {u.department})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex flex-col gap-2 pt-4 border-t border-navy border-opacity-10">
                    <div className="flex gap-3">
                      <button type="submit" disabled={!editGroupName.trim()} className="btn-gold flex-1 py-2.5 text-sm">
                        Save Changes
                      </button>
                      <button type="button" onClick={() => setShowGroupSettingsModal(false)} className="btn-secondary flex-1 py-2.5 text-sm">
                        Cancel
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteGroup}
                      className="w-full flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-2.5 rounded-xl text-xs transition-colors mt-2"
                    >
                      <Trash2 size={14} /> Delete Group Channel
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Fullscreen Image Preview Modal */}
        <AnimatePresence>
          {activePreviewImage && (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                exit={{ opacity: 0 }}
                onClick={() => setActivePreviewImage(null)}
                className="fixed inset-0 bg-navy/90 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-50 max-w-4xl max-h-[85vh] overflow-hidden flex items-center justify-center rounded-2xl shadow-2xl bg-black"
              >
                <img
                  src={activePreviewImage}
                  alt="Attachment Preview"
                  className="max-w-full max-h-[85vh] object-contain rounded-2xl"
                />
                <button
                  type="button"
                  onClick={() => setActivePreviewImage(null)}
                  className="absolute top-4 right-4 p-2 bg-navy/80 hover:bg-gold text-white hover:text-navy rounded-full transition-all shadow-md"
                  title="Close Preview"
                >
                  <X size={18} />
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
