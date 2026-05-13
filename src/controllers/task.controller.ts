// backend/src/controllers/taskController.ts
import { ActivityKind, Priority, Prisma, PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";

const prisma = new PrismaClient();

// Type shapes for requests (loose to exactly match your runtime checks)
type CreateTaskBody = {
  name?: string;
  description?: string;
  projectId?: number;
  parentTaskId?: number | null;
  priority?: Priority;
  dueDate?: Date;
  listId?: number | null;
  assignedById?: number | null;
  assigneeId?: number | null;
  statusId?: number;
  userId?: number; // optional actor
};

type UpdateTaskBody = {
  name?: unknown;
  description?: unknown | null;
  projectId?: unknown;
  parentTaskId?: unknown | null;
  priority?: unknown;
  dueDate?: unknown | null;
  listId?: unknown | null;
  assignedById?: unknown | null;
  assigneeId?: unknown | null;
  statusId?: unknown | null;
  userId?: unknown;
};

type TaskQuery = {
  projectId?: string | string[] | undefined;
  id?: string | string[] | undefined;
};

// Prisma error guard
function isPrismaError(e: unknown): e is { code?: string; meta?: unknown } {
  return typeof e === "object" && e !== null && "code" in e;
}

/* ---------- CREATE task ---------- */
const createTask = async (
  req: Request<unknown, unknown, CreateTaskBody>,
  res: Response,
): Promise<void> => {
  try {
    const {
      name,
      description,
      projectId,
      parentTaskId = null,
      priority,
      dueDate,
      listId = null,
      assignedById = null,
      assigneeId = null,
      statusId = 0,
    } = req.body || {};

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ success: false, error: "Task name is required." });
      return;
    }
    if (description && typeof description === "string" && description.length > 255) {
      res.status(400).json({
        success: false,
        error: "Description must be at most 255 characters.",
      });
      return;
    }
    if (projectId === undefined || projectId === null) {
      res.status(400).json({ success: false, error: "projectId is required." });
      return;
    }
    const sid = parseInt(String(projectId), 10);
    if (Number.isNaN(sid)) {
      res.status(400).json({ success: false, error: "projectId must be a number." });
      return;
    }

    // Ensure parent project exists
    const project = await prisma.project.findUnique({
      where: { id: sid },
    });
    if (!project) {
      res.status(404).json({ success: false, error: "Parent project not found." });
      return;
    }

    const result = await prisma.task.create({
      data: {
        name: (name as string).trim(),
        description: description! ?? null,
        priority,
        dueDate: dueDate ? new Date(String(dueDate)) : null,
        listId,
        projectId: sid,
        parentTaskId,
        assignedById,
        assigneeId,
        statusId,
      },
    });

    res.status(201).json({ success: true, data: result });
    return;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;

      if (Array.isArray(target) && target.includes("name")) {
        res.status(409).json({
          success: false,
          error: "Task name already exists.",
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to create task.",
    });
  }
};

/* ---------- GET all tasks (optionally filter by projectId) ---------- */
const getTasks = async (
  req: Request<unknown, unknown, unknown, TaskQuery>,
  res: Response,
): Promise<void> => {
  try {
    const { projectId } = req.query as TaskQuery;
    const where: { [key: string]: unknown } = {};
    if (projectId !== undefined) {
      const sid = parseInt(Array.isArray(projectId) ? projectId[0] : String(projectId), 10);
      if (Number.isNaN(sid)) {
        res.status(400).json({ success: false, error: "projectId must be a number." });
        return;
      }
      where.projectId = sid;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assets: true,
        subTasks: {
          include: {
            assets: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, data: tasks.filter((t) => !t.parentTaskId) });
    return;
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch tasks." });
    return;
  }
};

/* ---------- GET single task ---------- */
const getTask = async (
  req: Request<unknown, unknown, unknown, TaskQuery>,
  res: Response,
): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.query.id) ? req.query.id[0] : String(req.query.id), 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid task id." });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { subTasks: true },
    });
    if (!task) {
      res.status(404).json({ success: false, error: "Task not found." });
      return;
    }

    res.status(200).json({ success: true, data: task });
    return;
  } catch {
    res.status(500).json({ success: false, error: "Failed to fetch task." });
    return;
  }
};

/* ---------- UPDATE task ---------- */
const updateTask = async (
  req: Request<{ id: string }, unknown, UpdateTaskBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid task id." });
      return;
    }

    // Raw incoming values (we will use hasOwnProp to detect which were provided)
    const incoming = (req.body as UpdateTaskBody) || {};

    const {
      name,
      description,
      projectId,
      parentTaskId = null,
      priority,
      dueDate,
      listId = null,
      assignedById = null,
      assigneeId = null,
      statusId,
    } = incoming;

    // Helper to see if a field was provided in the request body (even if null)
    const has = (k: string) => Object.prototype.hasOwnProperty.call(incoming, k);

    // Basic validation for fields that are provided
    const dataToUpdate: Partial<UpdateTaskBody> = {};

    if (has("name")) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: "If provided, name must be a non-empty string.",
        });
        return;
      }
      dataToUpdate.name = (name as string).trim();
    }

    if (has("description")) {
      if (description && typeof description === "string" && description.length > 255) {
        res.status(400).json({
          success: false,
          error: "Description must be at most 255 characters.",
        });
        return;
      }
      dataToUpdate.description = description === null ? null : description;
    }

    if (has("projectId")) {
      const sid = parseInt(String(projectId), 10);
      if (Number.isNaN(sid)) {
        res.status(400).json({ success: false, error: "projectId must be a number." });
        return;
      }
      const project = await prisma.project.findUnique({ where: { id: sid } });
      if (!project) {
        res.status(404).json({ success: false, error: "Parent project not found." });
        return;
      }
      dataToUpdate.projectId = sid;
    }

    if (has("parentTaskId")) {
      // allow null to unset parent
      dataToUpdate.parentTaskId = parentTaskId === null ? null : parseInt(String(parentTaskId), 10);
      if (dataToUpdate.parentTaskId !== null && Number.isNaN(dataToUpdate.parentTaskId)) {
        res.status(400).json({
          success: false,
          error: "parentTaskId must be a number or null.",
        });
        return;
      }
    }

    if (has("priority")) {
      dataToUpdate.priority = priority === null ? null : priority;
    }

    if (has("dueDate")) {
      dataToUpdate.dueDate = dueDate === null ? null : new Date(String(dueDate));
      if (dueDate !== null && isNaN((dataToUpdate.dueDate as Date).getTime())) {
        res.status(400).json({
          success: false,
          error: "dueDate must be a valid date or null.",
        });
        return;
      }
    }

    if (has("listId")) {
      dataToUpdate.listId = listId === null ? null : parseInt(String(listId), 10);
      if (dataToUpdate.listId !== null && Number.isNaN(dataToUpdate.listId)) {
        res.status(400).json({ success: false, error: "listId must be a number or null." });
        return;
      }
    }

    if (has("assignedById")) {
      dataToUpdate.assignedById = assignedById === null ? null : parseInt(String(assignedById), 10);
      if (dataToUpdate.assignedById !== null && Number.isNaN(dataToUpdate.assignedById)) {
        res.status(400).json({
          success: false,
          error: "assignedById must be a number or null.",
        });
        return;
      }
    }

    if (has("assigneeId")) {
      dataToUpdate.assigneeId = assigneeId === null ? null : parseInt(String(assigneeId), 10);
      if (dataToUpdate.assigneeId !== null && Number.isNaN(dataToUpdate.assigneeId)) {
        res.status(400).json({
          success: false,
          error: "assigneeId must be a number or null.",
        });
        return;
      }
    }

    if (has("statusId")) {
      dataToUpdate.statusId = statusId === null ? null : parseInt(String(statusId), 10);
      if (dataToUpdate.statusId !== null && Number.isNaN(dataToUpdate.statusId)) {
        res.status(400).json({
          success: false,
          error: "statusId must be a number or null.",
        });
        return;
      }
    }

    // fetch existing task
    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        status: true,
      },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: "Task not found." });
      return;
    }

    // Build diffs only for fields that were provided and actually changed
    const diffs: Array<{ field: string; from: unknown; to: unknown }> = [];

    // Build a human-readable description
    const changesText = diffs
      .map((d) => {
        const fromStr =
          d.from === null || d.from === undefined
            ? "null"
            : d.from instanceof Date
              ? d.from.toISOString()
              : String(d.from);
        const toStr =
          d.to === null || d.to === undefined
            ? "null"
            : d.to instanceof Date
              ? d.to.toISOString()
              : String(d.to);
        return `${d.field}: "${fromStr}" → "${toStr}"`;
      })
      .join("; ");

    const actorId = req.body?.userId ?? null; // adjust if your auth stores actor elsewhere

    // perform update + activity creation atomically
    const [updatedTask, createdActivity] = await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: dataToUpdate as Prisma.TaskUpdateInput,
      }),
      prisma.activity.create({
        data: {
          kind: ActivityKind.TASK_UPDATE,
          description: `Task updated — ${changesText}`,
          metadata: {
            diffs,
            actorId,
            timestamp: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          taskId: id,
          userId: actorId as number,
        },
        include: {
          user: true,
        },
      }),
    ]);

    res.status(200).json({ success: true, data: updatedTask, activity: createdActivity });
    return;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;

      if (Array.isArray(target) && target.includes("name")) {
        res.status(409).json({
          success: false,
          error: "Task name already exists.",
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to update task.",
    });
  }
};

/* ---------- DELETE task ---------- */
const deleteTask = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid task id." });
      return;
    }

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { subTasks: true },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: "Task not found." });
      return;
    }
    if ((existing.subTasks ?? []).length > 0) {
      res.status(400).json({
        success: false,
        error: "Task has subtasks. Delete them first.",
      });
      return;
    }
    await prisma.task.delete({
      where: { id },
      include: { subTasks: true },
    });
    res.status(200).json({ success: true, data: `Task ${id} deleted` });
    return;
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      res.status(409).json({
        success: false,
        error: "Task has dependent records and cannot be deleted.",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete task.",
    });
  }
};

export { createTask, deleteTask, getTask, getTasks, updateTask };
