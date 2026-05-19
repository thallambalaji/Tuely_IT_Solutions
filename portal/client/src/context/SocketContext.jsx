import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const listenersRef = useRef(new Map());
  const socket = getSocket();

  useEffect(() => {
    if (!user) return;

    socket.on('user_online',  ({ userId }) => setOnlineUsers(s => new Set([...s, userId])));
    socket.on('user_offline', ({ userId }) => setOnlineUsers(s => { const n = new Set(s); n.delete(userId); return n; }));
    socket.on('notification',  (notif)    => setNotifications(n => [notif, ...n.slice(0, 49)]));
    socket.on('force_logout',  ()         => { window.location.href = '/portal/login?reason=deactivated'; });
    socket.on('password_changed', ()      => { alert('Your password has been changed by HR. Please log in again.'); window.location.href = '/portal/login'; });

    return () => {
      socket.off('user_online');
      socket.off('user_offline');
      socket.off('notification');
      socket.off('force_logout');
      socket.off('password_changed');
    };
  }, [user]);

  const on = (event, handler) => {
    socket.on(event, handler);
    listenersRef.current.set(`${event}_${handler}`, { event, handler });
  };

  const off = (event, handler) => {
    socket.off(event, handler);
  };

  const emit = (event, data) => socket.emit(event, data);

  const clearNotifications = () => setNotifications([]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, notifications, on, off, emit, clearNotifications }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
export default SocketContext;
