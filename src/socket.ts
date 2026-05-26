import type { Server as HTTPServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import { Server } from "socket.io";

let io: Server;

export function initSocket(httpServer: HTTPServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", credentials: true },
  });

  const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const pubClient = new Redis(REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  } catch {
    console.warn("Redis adapter unavailable — Socket.IO running without it");
  }

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
