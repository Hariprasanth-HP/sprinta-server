import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 200;

const ipMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();

  let entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    ipMap.set(ip, entry);
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: "Too many requests" });
  }

  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipMap) {
    if (now > entry.resetAt) ipMap.delete(ip);
  }
}, 60 * 1000);
