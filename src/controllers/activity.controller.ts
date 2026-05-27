import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db";
import { err } from "../lib/helper";
import { getJSON, invalidatePattern, setJSON } from "../lib/redis";
import { createNotification } from "./notification.controller";

/**
 * POST /ActivitiesgetActivitiesTree
 * body: { description, userId, epicId?, storyId?, taskId?, bugId?, parentId? }
 */
export enum ActivityKind {
  COMMENT = "COMMENT", // user comment with replies
  TASK_UPDATE = "TASK_UPDATE", // any change to a Task field
}

export const createActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      description,
      userId,
      taskId,
      parentId,
      kind = ActivityKind.COMMENT,
      assetIds,
    } = req.body as {
      description?: unknown;
      userId?: unknown;
      taskId?: unknown;
      parentId?: unknown | null;
      kind?: ActivityKind;
      assetIds?: number[];
    };

    if (!description || typeof description !== "string" || !description.trim()) {
      return err(res, 400, "`description` is required and must be a non-empty string.");
    }
    if (!userId || typeof userId !== "string") {
      return err(res, 400, "`userId` is required.");
    }
    const parsedTaskId = parseInt(String(taskId), 10);
    if (Number.isNaN(parsedTaskId)) {
      return err(res, 400, "`taskId` is required and must be a number.");
    }

    const data = {
      description: description.trim(),
      userId,
      taskId: parsedTaskId,
      kind,
      parentId: parentId !== undefined && parentId !== null ? parseInt(String(parentId), 10) : null,
    } as {
      description: string;
      userId: string;
      taskId: number;
      kind: ActivityKind;
      parentId: number | null;
    };

    // if parentId provided, ensure parent exists and belongs to same target (recommended)
    if (data.parentId) {
      const parent = await prisma.activity.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) return err(res, 400, "Parent Activity not found.");
      // ensure parent is under same target (prevent cross-target replies)
    }

    const created = await prisma.activity.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (Array.isArray(assetIds) && assetIds.length > 0) {
      await prisma.asset.updateMany({
        where: { id: { in: assetIds } },
        data: { activityId: created.id },
      });
    }

    if (data.kind === "COMMENT") {
      const task = await prisma.task.findUnique({
        where: { id: parsedTaskId },
        select: { assigneeId: true, name: true },
      });
      if (task?.assigneeId && task.assigneeId !== data.userId) {
        createNotification({
          userId: task.assigneeId,
          type: "COMMENT_ADDED",
          severity: "NORMAL",
          title: "New comment on task",
          message: typeof description === "string" ? description.substring(0, 200) : "New comment",
          link: `/tasks/${parsedTaskId}`,
        }).catch(() => {});
      }
    }

    const finalActivity = await prisma.activity.findUnique({
      where: { id: created.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assets: true,
      },
    });

    invalidatePattern(`activities:task:${parsedTaskId}`).catch(() => {});

    return res.status(201).json({ success: true, data: finalActivity ?? created });
  } catch (e) {
    console.error("createActivity error:", e);
    return err(res, 500, "Failed to create Activity.");
  }
};

/**
 * GET /ActivitiesgetActivitiesTree
 * Query params: epicId|storyId|taskId|bugId (exactly one), limit?, cursor?
 * Returns top-level ActivitiesgetActivitiesTree (parentId == null) with immediate replies & user.
 */
export const getActivities = async (req: Request, res: Response): Promise<Response> => {
  try {
    // pick target (like { key: 'epicId', id: 1 })
    const { taskId } = req.query as { taskId?: unknown };
    const parsedTaskId = parseInt(String(taskId), 10);
    if (Number.isNaN(parsedTaskId)) {
      return err(res, 400, "taskId is required and must be a number.");
    }
    const cacheKey = `activities:task:${parsedTaskId}`;
    const cached = await getJSON<any[]>(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, data: cached, meta: { total: cached.length } });
    }

    const rows = await prisma.activity.findMany({
      where: {
        taskId: parsedTaskId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assets: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // build tree util - preserves order of 'rows' (we fetched asc)
    function buildTree(flat: any[]) {
      // sort by createdAt ascending so replies are chronological
      flat.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const map = new Map(flat.map((item: any) => [item.id, { ...item, replies: [] }]));
      const roots: any[] = [];

      for (const item of flat) {
        const node = map.get(item.id);
        if (item.parentId) {
          const parent = map.get(item.parentId);
          if (parent) parent.replies.push(node);
          else roots.push(node); // orphaned reply -> treat as root
        } else {
          roots.push(node);
        }
      }

      return roots;
    }

    const treeAsc = buildTree(rows); // replies ordered per replyOrder

    const finalTree = treeAsc;

    setJSON(cacheKey, finalTree, 60).catch(() => {});

    return res.status(200).json({
      success: true,
      data: finalTree,
      meta: {
        total: rows.length,
      },
    });
  } catch (e) {
    console.error("getActivitiesTreeTree error:", e);
    return err(res, 500, "Failed to fetch ActivitiesgetActivitiesTree.");
  }
};

/**
 * GET /ActivitiesgetActivitiesTree/:id
 * Returns Activity with user and immediate replies
 */
export const getActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const parsed = parseInt(String(id), 10);
    if (Number.isNaN(parsed)) return err(res, 400, "id must be a number.");

    const cacheKey = `activity:${parsed}`;
    const cached = await getJSON<any>(cacheKey);
    if (cached) return res.status(200).json({ success: true, data: cached });

    const Activity = await prisma.activity.findUnique({
      where: { id: parsed },
      include: {
        user: { select: { id: true, name: true, email: true } },
        assets: true,
        replies: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
    if (!Activity) return err(res, 404, "Activity not found.");

    setJSON(cacheKey, Activity, 60).catch(() => {});

    return res.status(200).json({ success: true, data: Activity });
  } catch (e) {
    console.error("getActivity error:", e);
    return err(res, 500, "Failed to fetch Activity.");
  }
};

/**
 * PATCH /ActivitiesgetActivitiesTree/:id
 * body: { description? }
 * Only allows partial updates to description. (Add permission checks in production)
 */
export const updateActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const parsed = parseInt(String(id), 10);
    if (Number.isNaN(parsed)) return err(res, 400, "id must be a number.");

    const { description } = req.body as { description?: unknown };
    if (description === undefined || (typeof description === "string" && !description.trim())) {
      return err(res, 400, "`description` is required and must be a non-empty string.");
    }

    const updated = await prisma.activity.update({
      where: { id: parsed },
      data: { description: String(description).trim() },
      include: { user: { select: { id: true, name: true } } },
    });

    invalidatePattern(`activity:${parsed}`).catch(() => {});
    if (updated.taskId) invalidatePattern(`activities:task:${updated.taskId}`).catch(() => {});

    return res.status(200).json({ success: true, data: updated });
  } catch (e: any) {
    console.error("updateActivity error:", e);
    if (e?.code === "P2025") return err(res, 404, "Activity not found.");
    return err(res, 500, "Failed to update Activity.");
  }
};

/**
 * DELETE /ActivitiesgetActivitiesTree/:id
 * Query:
 *   soft=true  => perform soft-delete (isDeleted = true)
 *   force=true => recursively delete replies (hard delete)
 *
 * If Activity has replies and force isn't provided, returns 400.
 */
async function deleteRepliesRecursive(tx: Prisma.TransactionClient, parentId: number) {
  const replies = await tx.activity.findMany({ where: { parentId } });
  for (const r of replies) {
    await deleteRepliesRecursive(tx, r.id);
    await tx.activity.delete({ where: { id: r.id } });
  }
}

export const deleteActivity = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const parsed = parseInt(String(id), 10);
    if (Number.isNaN(parsed)) return err(res, 400, "id must be a number.");

    const { soft, force } = req.query as { soft?: unknown; force?: unknown };

    const Activity = await prisma.activity.findUnique({
      where: { id: parsed },
      include: { replies: true },
    });
    if (!Activity) return err(res, 404, "Activity not found.");

    // soft-delete option (keeps replies)
    if (String(soft) === "true") {
      const updated = await prisma.activity.update({
        where: { id: parsed },
        data: { isDeleted: true },
      });
      invalidatePattern(`activity:${parsed}`).catch(() => {});
      if (updated.taskId) invalidatePattern(`activities:task:${updated.taskId}`).catch(() => {});
      return res.status(200).json({ success: true, data: updated });
    }

    // if has replies and no force -> block
    if (Activity.replies && Activity.replies.length > 0 && String(force) !== "true") {
      return err(
        res,
        400,
        "Activity has replies; pass ?force=true to delete recursively or ?soft=true to soft-delete.",
      );
    }

    const { taskId: activityTaskId } = Activity;

    // recursive hard delete in a transaction (safe)
    await prisma.$transaction(async (tx) => {
      if (String(force) === "true") {
        await deleteRepliesRecursive(tx, parsed);
      }
      await tx.activity.delete({ where: { id: parsed } });
    });

    invalidatePattern(`activity:${parsed}`).catch(() => {});
    if (activityTaskId) invalidatePattern(`activities:task:${activityTaskId}`).catch(() => {});

    return res.status(200).json({ success: true, data: `Activity ${parsed} deleted` });
  } catch (e: any) {
    console.error("deleteActivity error:", e);
    if (e?.code === "P2025") return err(res, 404, "Activity not found.");
    return err(res, 500, "Failed to delete Activity.");
  }
};

// dont change the logoc resolve TS issues
