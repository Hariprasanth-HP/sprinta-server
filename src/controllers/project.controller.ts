import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db";
import { err } from "../lib/helper";

// CREATE project
const createProject = async (req: Request, res: Response) => {
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

    // creatorId is string UUID
    const effectiveCreatorId: string | null =
      req.user?.id ?? (creatorId ? String(creatorId).trim() : null);

    // Ensure creator exists
    if (effectiveCreatorId) {
      const user = await prisma.user.findUnique({
        where: { id: effectiveCreatorId },
      });

      if (!user) {
        return err(res, 400, "Creator user not found.");
      }
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

    return res.status(201).json({
      success: true,
      data: project,
    });
  } catch (e: any) {
    if (e.code === "P2002" && e.meta?.target?.includes("name")) {
      return err(res, 409, "Project name already exists.");
    }

    console.error("createProject error:", e);

    return err(res, 500, "Failed to create project.");
  }
};

// GET all projects

const getProjects = async (
  req: Request,
  res: Response
) => {
  try {
    const user = req.user;
    if (!user) {
      return err(res, 401, "Unauthorized");
    }
    const { teamId } = req.query;
    if (!teamId) {
      return err(res, 400, "teamId is required");
    }
    const parsedTeamId = parseInt(
      teamId as string,
      10
    );
    if (Number.isNaN(parsedTeamId)) {
      return err(
        res,
        400,
        "teamId must be a number"
      );
    }
    // Check workspace membership
    const membership =
      await prisma.teamMember.findFirst({
        where: {
          teamId: parsedTeamId,
          userId: user.id as any,
        },
      });

    if (!membership) {
      return err(
        res,
        403,
        "Access denied"
      );
    }
    // Workspace admins can access all projects
    const isAdmin =
      membership.role === "OWNER" ||
      membership.role === "ADMIN";

    const where: Prisma.ProjectWhereInput =
      isAdmin
        ? {
          teamId: parsedTeamId,
        }
        : {
          teamId: parsedTeamId,

          members: {
            some: {
              userId: user.id as string | Prisma.UuidFilter<"ProjectMember"> | undefined,
            },
          },
        };

    const projects =
      await prisma.project.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },

        include: {
          members: true,
        },
      });

    return res.status(200).json({
      success: true,
      data: projects,
    });

  } catch (e) {

    console.error("getProjects error:", e);

    return err(
      res,
      500,
      "Failed to fetch projects."
    );
  }
};

// GET single project
const getProject = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return err(res, 400, "Invalid project id.");
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      return err(res, 404, "Project not found.");
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (e: any) {
    console.error("getProject error:", e);

    return err(res, 500, "Failed to fetch project.");
  }
};

// UPDATE project
const updateProject = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid project id.");

    const { name, description, creatorId, teamId } = req.body;

    const data: Prisma.ProjectUncheckedUpdateInput = {};

    // name
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }

      data.name = name.trim();
    }

    // description
    if (description !== undefined) {
      if (description && description.length > 255) {
        return err(res, 400, "Description must be at most 255 characters.");
      }

      data.description = description === null ? null : description;
    }

    // teamId
    if (teamId !== undefined) {
      const parsedTeamId = parseInt(String(teamId || "").trim(), 10);

      if (Number.isNaN(parsedTeamId)) {
        return err(res, 400, "Invalid teamId");
      }

      data.teamId = parsedTeamId;
    }

    // creatorId
    if (creatorId !== undefined) {
      if (creatorId === null) {
        data.creatorId = null;
      } else {
        const parsed = String(creatorId).trim();

        if (!parsed) {
          return err(res, 400, "creatorId must be valid");
        }

        const user = await prisma.user.findUnique({
          where: {
            id: parsed,
          },
        });

        if (!user) {
          return err(res, 400, "Creator user not found.");
        }

        data.creatorId = parsed;
      }
    }

    // Ensure project exists
    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      return err(res, 404, "Project not found.");
    }

    const updated = await prisma.project.update({
      where: { id },
      data,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (e: any) {
    if (e.code === "P2002" && e.meta?.target?.includes("name")) {
      return err(res, 409, "Project name already exists.");
    }

    console.error("updateProject error:", e);

    return err(res, 500, "Failed to update project.");
  }
};

// DELETE project
const deleteProject = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid project id.");

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tasks: true,
      },
    });

    if (!project) {
      return err(res, 404, "Project not found.");
    }

    await prisma.project.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      data: `Project ${id} deleted`,
    });
  } catch (e: any) {
    console.error("deleteProject error:", e);

    if (e.code === "P2003") {
      return err(res, 409, "Project has dependent records and cannot be deleted.");
    }

    return err(res, 500, "Failed to delete project.");
  }
};

export { createProject, deleteProject, getProject, getProjects, updateProject };
