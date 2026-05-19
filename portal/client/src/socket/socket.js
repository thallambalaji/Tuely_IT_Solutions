import { io } from 'socket.io-client';

/**
 * Creates and returns a singleton Socket.IO client.
 * Auth token is passed via handshake auth (extracted from cookie by server middleware).
 */
let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};

export default getSocket;
