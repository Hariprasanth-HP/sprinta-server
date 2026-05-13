// backend/src/controllers/taskStatusController.ts
import { PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { err } from "../lib/helper";

const prisma = new PrismaClient();

// Prisma error type guard
function isPrismaError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e;
}

/**
 * CREATE TaskStatus
 * Body: { name, color?, sortOrder?, projectId }
 */
export const createTaskStatus = async (req: Request, res: Response) => {
  try {
    const {
      name,
      color,
      sortOrder: bodySortOrder,
      projectId: bodyProjectId,
    } = req.body as {
      name?: unknown;
      color?: string;
      sortOrder?: unknown;
      projectId?: unknown;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err(res, 400, "Status name is required.");
    }

    const projectId = parseInt(String(bodyProjectId), 10);
    if (Number.isNaN(projectId)) {
      return err(res, 400, "projectId is required and must be a number.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return err(res, 404, "Project not found.");

    let sortOrder = typeof bodySortOrder === "number" ? bodySortOrder : null;

    if (sortOrder === null) {
      const last = await prisma.taskStatus.findFirst({
        where: { projectId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      sortOrder = (last?.sortOrder ?? -1) + 1;
    }

    const created = await prisma.taskStatus.create({
      data: {
        name: name.trim(),
        color: color ?? null,
        sortOrder,
        projectId,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return err(res, 409, "Status name already exists for this project.");
    }
    console.error("createTaskStatus error:", e);
    return err(res, 500, "Failed to create status.");
  }
};

/**
 * GET statuses for a project
 * Query: ?projectId=1
 */
export const getTaskStatusesByProject = async (req: Request, res: Response) => {
  try {
    const { projectId: qProjectId } = req.query as {
      projectId?: string | string[];
    };

    const projectId = parseInt(Array.isArray(qProjectId) ? qProjectId[0] : String(qProjectId), 10);

    if (Number.isNaN(projectId)) return err(res, 400, "projectId must be a number.");

    const statuses = await prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return res.status(200).json({ success: true, data: statuses });
  } catch (e) {
    console.error("getTaskStatusesByProject error:", e);
    return err(res, 500, "Failed to fetch statuses.");
  }
};

/**
 * GET single status by id
 */
export const getTaskStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid status id.");

    const status = await prisma.taskStatus.findUnique({ where: { id } });
    if (!status) return err(res, 404, "Status not found.");

    return res.status(200).json({ success: true, data: status });
  } catch (e) {
    console.error("getTaskStatus error:", e);
    return err(res, 500, "Failed to fetch status.");
  }
};

/**
 * UPDATE status
 */
export const updateTaskStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid status id.");

    const { name, color } = req.body as {
      name?: unknown;
      color?: unknown;
      sortOrder?: unknown;
    };

    const data: {
      name?: string;
      color?: string | null;
    } = {};

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }
      data.name = name.trim();
    }

    if (color !== undefined) {
      data.color = color === null ? null : (color as string);
    }

    const existing = await prisma.taskStatus.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "Status not found.");

    const updated = await prisma.taskStatus.update({
      where: { id },
      data,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return err(res, 409, "Status name already exists for this project.");
    }
    console.error("updateTaskStatus error:", e);
    return err(res, 500, "Failed to update status.");
  }
};

/**
 * DELETE status
 */
export const deleteTaskStatus = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid status id.");

    const status = await prisma.taskStatus.findUnique({
      where: { id },
      include: { tasks: true },
    });

    if (!status) return err(res, 404, "Status not found.");

    if (status.tasks && status.tasks.length > 0) {
      return err(res, 400, "Status has tasks. Reassign or clear tasks before deleting.");
    }

    await prisma.taskStatus.delete({ where: { id } });

    return res.status(200).json({ success: true, data: `Status ${id} deleted` });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2003") {
      return err(res, 409, "Status has dependent records and cannot be deleted.");
    }
    console.error("deleteTaskStatus error:", e);
    return err(res, 500, "Failed to delete status.");
  }
};
