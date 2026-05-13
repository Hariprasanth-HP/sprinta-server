import { PrismaClient } from "@prisma/client";
import { err } from "../lib/helper";

// backend/src/controllers/projectController.js
const prisma = new PrismaClient();


// CREATE project
const createProject = async (req, res) => {
  try {
    const { name, description, creatorId, teamId } = req.body;

    const parsedComId = parseInt(teamId, 10);
    // Basic validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err(res, 400, "Project name is required.");
    }

    if (!teamId) {
      return err(res, 400, "Project teamId is required.");
    }
    if (Number.isNaN(parsedComId)) return err(res, 400, "teamId must be a number");

    if (description && description.length > 255) {
      return err(res, 400, "Description must be at most 255 characters.");
    }

    // Prefer authenticated user as creator if available
    const effectiveCreatorId = req.user?.id ?? (creatorId ? parseInt(creatorId) : null);

    // If creatorId provided, ensure user exists
    if (effectiveCreatorId) {
      const user = await prisma.user.findUnique({
        where: { id: effectiveCreatorId },
      });
      if (!user) return err(res, 400, "Creator user not found.");
    }
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        creatorId: effectiveCreatorId ?? null,
        teamId: parseInt(teamId, 10) ?? null,
      },
    });
    await prisma.taskStatus.createMany({
      data: [
        { name: "To Do", projectId: project.id, sortOrder: 0 },
        { name: "In Progress", projectId: project.id, sortOrder: 1 },
        { name: "Done", projectId: project.id, sortOrder: 2 },
      ],
    });

    return res.status(201).json({ success: true, data: project });
  } catch (e) {
    // Handle unique constraint violation (duplicate name)
    if (e.code === "P2002" && e.meta && e.meta.target && e.meta.target.includes("name")) {
      return err(res, 409, "Project name already exists.");
    }
    console.error("createProject error:", e);
    return err(res, 500, "Failed to create project.");
  }
};

// GET all projects (optionally filter by creator)
const getProjects = async (req, res) => {
  try {
    const { teamId } = req.query;
    const where = {};

    if (teamId) {
      const id = parseInt(teamId);
      if (Number.isNaN(id)) return err(res, 400, "teamId must be a number");
      where.teamId = id;
    } else {
      return err(res, 500, "teamId should be sent");
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: projects });
  } catch (e) {
    console.error("getProjects error:", e);
    return err(res, 500, "Failed to fetch projects.");
  }
};

// GET single project by id (includes tasks)
const getProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid project id.");

    const project = await prisma.project.findUnique({
      where: { id },
      include: { projects: true },
    });

    if (!project) return err(res, 404, "Project not found.");

    return res.status(200).json({ success: true, data: project });
  } catch (e) {
    console.error("getProject error:", e);
    return err(res, 500, "Failed to fetch project.");
  }
};

// UPDATE project
const updateProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid project id.");

    const { name, description, creatorId, teamId } = req.body;

    // Validate fields if provided
    const data = {};
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }
      data.name = name.trim();
    }
    if (description !== undefined) {
      if (description && description.length > 255) {
        return err(res, 400, "Description must be at most 255 characters.");
      }
      data.description = description === null ? null : description;
    }
    if (teamId !== undefined) {
      if (teamId && teamId.length > 255) {
        return err(res, 400, "teamId must be at most 255 characters.");
      }
      data.teamId = teamId === null ? null : teamId;
    }

    // Optionally change creator (ensure user exists)
    if (creatorId !== undefined) {
      if (creatorId === null) {
        data.creatorId = null;
      } else {
        const parsed = parseInt(creatorId);
        if (Number.isNaN(parsed)) return err(res, 400, "creatorId must be a number or null");
        const user = await prisma.user.findUnique({ where: { id: parsed } });
        if (!user) return err(res, 400, "Creator user not found.");
        data.creatorId = parsed;
      }
    }

    // Ensure project exists
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "Project not found.");

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    // Unique violation on name
    if (e.code === "P2002" && e.meta && e.meta.target && e.meta.target.includes("name")) {
      return err(res, 409, "Project name already exists.");
    }
    console.error("updateProject error:", e);
    return err(res, 500, "Failed to update project.");
  }
};

// DELETE project
// Default safety: disallow deleting if tasks exist. If you prefer cascade, adjust logic.
const deleteProject = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid project id.");

    const project = await prisma.project.findUnique({
      where: { id },
      include: { tasks: true },
    });
    if (!project) return err(res, 404, "Project not found.");

    // if (project.tasks && project.tasks.length > 0) {
    //   return err(
    //     res,
    //     400,
    //     "Project has tasks. Delete or detach tasks before deleting the project."
    //   );
    // }

    await prisma.project.delete({ where: { id } });
    return res.status(200).json({ success: true, data: `Project ${id} deleted` });
  } catch (e) {
    console.error("deleteProject error:", e);
    // If DB refuses if there are dependent rows not caught above, return 409
    if (e.code === "P2003") {
      return err(res, 409, "Project has dependent records and cannot be deleted.");
    }
    return err(res, 500, "Failed to delete project.");
  }
};

export { createProject, deleteProject, getProject, getProjects, updateProject };
