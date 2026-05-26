import type { NotificationType, Prisma, Severity } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db";
import { getJSON, incr, decr, setCounter, setJSON, invalidatePattern } from "../lib/redis";
import { getIO } from "../socket";

export async function createNotification({
  userId,
  type,
  severity,
  title,
  message,
  link,
  metadata,
}: {
  userId: string;
  type: NotificationType;
  severity: Severity;
  title: string;
  message?: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const notification = await prisma.notification.create({
    data: { userId, type, severity, title, message, link, metadata },
  });

  incr(`unread:${userId}`).catch(() => {});
  invalidatePattern(`notifications:user:${userId}:*`).catch(() => {});

  try {
    const io = getIO();
    io.to(`user:${userId}`).emit("notification", notification);
  } catch {
    // Socket.IO not initialized — notification still saved
  }

  return notification;
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const isRead = req.query.isRead as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const cacheKey = `notifications:user:${userId}:page:${page}:limit:${limit}:isRead:${isRead ?? "all"}`;
    const cached = await getJSON<{ data: any[]; meta: any }>(cacheKey);
    if (cached) return res.status(200).json({ success: true, ...cached });

    const where: Record<string, unknown> = { userId };
    if (isRead === "true") where.isRead = true;
    else if (isRead === "false") where.isRead = false;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.notification.count({ where }),
    ]);

    const meta = { page, limit, total, totalPages: Math.ceil(total / limit) };
    setJSON(cacheKey, { data, meta }, 30).catch(() => {});

    return res.status(200).json({ success: true, data, meta });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch notifications",
    });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const counterKey = `unread:${userId}`;
    let count = await getJSON<number>(counterKey);
    if (count === null) {
      count = await prisma.notification.count({ where: { userId, isRead: false } });
      setCounter(counterKey, count, 86400).catch(() => {});
    }

    return res.status(200).json({ success: true, count });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get unread count",
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid notification id" });

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found" });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    decr(`unread:${userId}`).catch(() => {});
    invalidatePattern(`notifications:user:${userId}:*`).catch(() => {});

    return res.status(200).json({ success: true, data: updated });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to mark as read",
    });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    setCounter(`unread:${userId}`, 0).catch(() => {});
    invalidatePattern(`notifications:user:${userId}:*`).catch(() => {});

    return res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to mark all as read",
    });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid notification id" });

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification)
      return res.status(404).json({ success: false, message: "Notification not found" });

    await prisma.notification.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete notification",
    });
  }
};
