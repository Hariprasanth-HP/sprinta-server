import type { Server as HTTPServer } from "node:http";
import { Server } from "socket.io";

let io: Server;

export function initSocket(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", credentials: true },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
}
