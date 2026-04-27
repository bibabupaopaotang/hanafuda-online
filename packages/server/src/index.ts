/**
 * 花札在线对战 — Socket.io 服务端入口
 * 部署目标：微信云托管 (CloudBase Run)
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './rooms/handler.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 15000,
  pingTimeout: 30000,
});

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`[Server] 监听端口 ${PORT}`);
  console.log(`[Server] 环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM 收到，关闭服务...');
  io.close();
  httpServer.close();
});
