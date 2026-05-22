import { io } from 'socket.io-client';
import { API_BASE_URL } from '../utils/api';

/**
 * Creates and returns a singleton Socket.IO client.
 * Auth token is passed via handshake auth payload.
 */
let socket = null;

export const getSocket = (token) => {
  const activeToken = token || localStorage.getItem('tc_token');

  if (!socket) {
    const socketUrl = API_BASE_URL || 'https://tuely-it-solutions.onrender.com';
    
    socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      auth: { token: activeToken },
    });
  } else {
    socket.auth = { token: activeToken };
  }
  return socket;
};

export const connectSocket = (token) => {
  const s = getSocket(token);
  const activeToken = token || localStorage.getItem('tc_token');
  s.auth = { token: activeToken };
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export default getSocket;
