import { Prisma, PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { err } from "../lib/helper";

// backend/src/controllers/ListController.js
const prisma = new PrismaClient();

// CREATE List
const createList = async (req: Request, res: Response) => {
  try {
    const { name, projectId } = req.body;

    // Basic validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err(res, 400, "List name is required.");
    }

    // Prefer authenticated project as creator if available
    const effectiveprojectId = projectId ? parseInt(projectId) : null;

    // If projectId provided, ensure project exists
    if (effectiveprojectId) {
      const project = await prisma.project.findUnique({
        where: { id: effectiveprojectId },
      });
      if (!project) return err(res, 400, "Creator project not found.");
    }

    // Create List
    const List = await prisma.list.create({
      data: {
        name: name.trim(),
        projectId: effectiveprojectId! ?? null,
      },
    });

    return res.status(201).json({ success: true, data: List });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;

      if (Array.isArray(target) && target.includes("name")) {
        return err(res, 409, "List name already exists.");
      }
    }

    console.error("createList error:", e);
    return err(res, 500, "Failed to create List.");
  }
};

// GET all Lists (optionally filter by creator)
const getLists = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const where: Prisma.ListWhereInput = {};

    if (projectId) {
      const id: number = parseInt(String(projectId));
      if (Number.isNaN(id)) return err(res, 400, "projectId must be a number");
      where.projectId = id;
    } else {
      return err(res, 500, "Creator Id should be sent");
    }

    const Lists = await prisma.list.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: Lists });
  } catch (e) {
    console.error("getLists error:", e);
    return err(res, 500, "Failed to fetch Lists.");
  }
};

// GET single List by id (includes projects)
const getList = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid List id.");

    const List = await prisma.list.findUnique({
      where: { id },
    });

    if (!List) return err(res, 404, "List not found.");

    return res.status(200).json({ success: true, data: List });
  } catch (e) {
    console.error("getList error:", e);
    return err(res, 500, "Failed to fetch List.");
  }
};

// UPDATE List
const updateList = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid List id.");

    const { name, projectId } = req.body;

    const data: Prisma.ListUpdateInput = {};

    // Optional name update
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }

      data.name = name.trim();
    }

    if (projectId !== undefined) {
      if (projectId === null) {
        return err(res, 400, "projectId cannot be null");
      } else {
        const parsed = Number(projectId);
        if (Number.isNaN(parsed)) {
          return err(res, 400, "projectId must be a number or null");
        }

        const project = await prisma.project.findUnique({
          where: { id: parsed },
        });

        if (!project) {
          return err(res, 400, "Creator project not found.");
        }

        data.project = {
          connect: { id: parsed },
        };
      }
    }

    // Ensure List exists
    const existing = await prisma.list.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "List not found.");

    const updated = await prisma.list.update({
      where: { id },
      data, // ✅ correct type
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;

      if (Array.isArray(target) && target.includes("name")) {
        return err(res, 409, "List name already exists.");
      }
    }

    console.error("updateList error:", e);
    return err(res, 500, "Failed to update List.");
  }
};

// DELETE List
// Default safety: disallow deleting if projects exist. If you prefer cascade, adjust logic.
const deleteList = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid List id.");

    const List = await prisma.list.findUnique({
      where: { id },
    });
    if (!List) return err(res, 404, "List not found.");

    await prisma.list.delete({ where: { id } });
    return res.status(200).json({ success: true, data: `List ${id} deleted` });
  } catch (e: unknown) {
    console.error("deleteList error:", e);

    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return err(res, 409, "List has dependent records and cannot be deleted.");
    }

    return err(res, 500, "Failed to delete List.");
  }
};

export { createList, deleteList, getList, getLists, updateList };
