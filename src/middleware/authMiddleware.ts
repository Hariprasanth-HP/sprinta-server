import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { supabase } from "../controllers/auth/auth.controller";
import { getJSON, setJSON } from "../lib/redis";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ error: "Missing authorization header" });
    }
    const token = auth.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const cacheKey = `auth:token:${hashToken(token)}`;
    const cached = await getJSON<{ id: string; email?: string }>(cacheKey);
    if (cached) {
      req.user = cached as any;
      return next();
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = user;

    const expiresIn = user.role === "service_role" ? 3600 : 300;
    setJSON(cacheKey, { id: user.id, email: user.email }, expiresIn).catch(() => { });

    next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
