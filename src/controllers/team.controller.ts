// backend/src/controllers/TeamController.ts
import type { Request, Response } from "express";
import { prisma } from "../db";
import { err } from "../lib/helper";
import { TeamRole } from "../types/type";

/**
 * CREATE Team
 * - If authenticated user (req.user) present, use that as creator.
 * - If creatorId provided in body, falls back to that (validated).
 * - If we have a creator user, create both team and teamMember in a transaction.
 */
const createTeam = async (req: Request, res: Response) => {
  try {
    const { name, about, creatorId: bodyCreatorId } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err(res, 400, "Team name is required.");
    }

    // allow req.user from your auth middleware; keep as any for now
    const authUser: any = (req as any).user ?? null;

    const effectiveCreatorId =
      authUser?.id ?? (bodyCreatorId ? parseInt(String(bodyCreatorId), 10) : null);

    let creatorUser = null;
    if (effectiveCreatorId !== null && effectiveCreatorId !== undefined) {
      if (Number.isNaN(effectiveCreatorId)) {
        return err(res, 400, "creatorId must be a number.");
      }
      creatorUser = await prisma.user.findUnique({
        where: { id: effectiveCreatorId },
        select: { id: true, email: true, name: true },
      });
      if (!creatorUser) return err(res, 400, "Creator user not found.");
    }

    // If we have a creator, create team + member in a single transaction
    let createdTeam;
    if (creatorUser) {
      const result = await prisma.$transaction(async (tx) => {
        const team = await tx.team.create({
          data: {
            name: name.trim(),
            about: about ?? "",
            creatorId: creatorUser!.id,
          },
        });

        // create member; ignore unique constraint if already present
        try {
          await tx.teamMember.create({
            data: {
              teamId: team.id,
              userId: creatorUser!.id,
              email: creatorUser!.email.toLowerCase().trim(),
              name: creatorUser!.name ?? null,
              role: "OWNER",
            },
          });
        } catch (e: any) {
          // P2002 is unique constraint in Prisma
          if (e?.code !== "P2002") throw e;
          // else ignore (already a member)
        }

        // fetch team with members + projects to return
        const full = await tx.team.findUnique({
          where: { id: team.id },
          include: { members: true, projects: true },
        });
        return full;
      });

      createdTeam = result;
    }
    return res.status(201).json({ success: true, data: createdTeam });
  } catch (e: any) {
    // handle unique constraint on team name
    if (
      e?.code === "P2002" &&
      e?.meta &&
      typeof e.meta.target !== "undefined" &&
      String(e.meta.target).includes("name")
    ) {
      return err(res, 409, "Team name already exists.");
    }
    console.error("createTeam error:", e);
    return err(res, 500, "Failed to create Team.");
  }
};

/**
 * Get teams the user belongs to (based on email or userId).
 * Expects authenticated user in req.user OR body.user (fallback)
 */
async function getTeamsFromUser(req: Request, res: Response) {
  try {
    const user = req.user;
    console.log('useruseruser1', user);

    if (!user?.id) {
      return err(res, 400, "Authenticated user required.");
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            email: user.email,
          },
        },
      },

      include: {
        members: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const teamsWithProjects = await Promise.all(
      teams.map(async (team) => {

        const membership = team.members.find(
          (m) => m.userId === user.id
        );

        const isAdmin =
          membership?.role === "OWNER" ||
          membership?.role === "ADMIN";

        const projects = await prisma.project.findMany({
          where: isAdmin
            ? {
              teamId: team.id,
            }
            : {
              teamId: team.id,
              members: {
                some: {
                  userId: user.id,
                },
              },
            },
        });

        return {
          ...team,
          projects,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: teamsWithProjects,
    });

  } catch (e) {
    console.error("getTeamsFromUser error:", e);

    return err(res, 500, "Failed to fetch teams.");
  }
}

/**
 * Add / update users (members) on a team and/or change creatorId.
 * - PUT/PATCH /teams/:id/members  with body { members: [...], creatorId?: number|null }
 * - members expected to be array of objects: { email, name?, userId?, role? }
 */
const addUsersToTeam = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid Team id.");

    const { members, creatorId: bodyCreatorId } = req.body;

    // Build update payload for team update (only creatorId right now)
    const teamUpdateData: any = {};

    // Validate and optionally set creatorId
    if (typeof bodyCreatorId !== "undefined") {
      if (bodyCreatorId === null) {
        teamUpdateData.creatorId = null;
      } else {
        const parsed = bodyCreatorId;
        if (!parsed.trim()) return err(res, 400, "creatorId is required");
        const user = await prisma.user.findUnique({ where: { id: parsed } });
        if (!user) return err(res, 400, "Creator user not found.");
        teamUpdateData.creatorId = parsed;
      }
    }

    // Ensure Team exists
    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "Team not found.");

    // If members provided: validate and upsert them in transaction with team update
    if (typeof members !== "undefined") {
      if (!Array.isArray(members)) {
        return err(res, 400, "If provided, members must be an array.");
      }

      // Validate entries
      const sanitizedMembers = members.map((m: any) => {
        if (!m?.email || typeof m.email !== "string" || m.email.trim() === "") {
          throw new Error("Each member must include a valid email.");
        }
        return {
          email: m.email.toLowerCase().trim(),
          name: m.name ?? null,
          userId: m.userId ?? null,
          role: m.role ?? TeamRole.MEMBER,
        };
      });

      // Perform team update + upsert members in transaction
      const updated = await prisma.$transaction(async (tx) => {
        // Update team (maybe no-op if no creatorId)
        if (Object.keys(teamUpdateData).length > 0) {
          await tx.team.update({ where: { id }, data: teamUpdateData });
        }

        // For each member, try to create; if unique constraint on (teamId, email) exists, update that row
        for (const m of sanitizedMembers) {
          try {
            await tx.teamMember.create({
              data: {
                teamId: id,
                userId: m.userId,
                email: m.email,
                name: m.name,
                role: m.role,
              },
            });
          } catch (e: any) {
            // If unique constraint -> update existing member
            if (e?.code === "P2002") {
              // find the existing member (by teamId + email) and update
              await tx.teamMember.updateMany({
                where: { teamId: id, email: m.email },
                data: { userId: m.userId, name: m.name, role: m.role },
              });
            } else {
              throw e;
            }
          }
        }

        // return team with projects + members
        const teamFull = await tx.team.findUnique({
          where: { id },
          include: { projects: true, members: true },
        });
        return teamFull;
      });

      return res.status(200).json({ success: true, data: updated });
    } else {
      // only creatorId change (no members)
      const updated = await prisma.team.update({
        where: { id },
        data: teamUpdateData,
        include: { projects: true, members: true },
      });
      return res.status(200).json({ success: true, data: updated });
    }
  } catch (e: any) {
    // Prisma unique violation on team name is possible elsewhere; handle generic errors
    if (e?.code === "P2002" && e?.meta && String(e.meta.target).includes("name")) {
      return err(res, 409, "Team name already exists.");
    }
    console.error("addUsersToTeam error:", e);
    return err(res, 500, "Failed to update Team members.");
  }
};

/**
 * GET teams (optionally filter by creatorId)
 * - If no creatorId provided, returns all teams (paginated is recommended in real apps)
 */
const getTeams = async (req: Request, res: Response) => {
  try {
    const { creatorId } = req.query;
    const where: any = {};

    if (typeof creatorId !== "undefined" && creatorId !== null && String(creatorId).length > 0) {
      const id = String(creatorId).trim();
      if (id.length === 0) return err(res, 400, "creatorId must be a string");
      where.creatorId = id;
    }

    const teams = await prisma.team.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { members: true, projects: true },
    });

    return res.status(200).json({ success: true, data: teams });
  } catch (e) {
    console.error("getTeams error:", e);
    return err(res, 500, "Failed to fetch Team.");
  }
};

/**
 * GET single Team by id
 */
const getTeam = async (
  req: Request,
  res: Response
) => {
  try {

    const currentUser = req.user;

    if (!currentUser?.id) {
      return err(res, 401, "Unauthorized.");
    }

    const id = parseInt(
      String(req.params.id),
      10
    );

    if (Number.isNaN(id)) {
      return err(
        res,
        400,
        "Invalid Team id."
      );
    }

    const team =
      await prisma.team.findUnique({
        where: {
          id,
        },

        include: {
          members: true,
        },
      });

    if (!team) {
      return err(
        res,
        404,
        "Team not found."
      );
    }

    // Verify user belongs to workspace
    const membership =
      team.members.find(
        (m) =>
          m.userId === currentUser.id
      );

    if (!membership) {
      return err(
        res,
        403,
        "Access denied."
      );
    }

    return res.status(200).json({
      success: true,

      data: {
        ...team,

        currentRole:
          membership.role,
      },
    });

  } catch (e) {

    console.error(
      "getTeam error:",
      e
    );

    return err(
      res,
      500,
      "Failed to fetch Team."
    );
  }
};
/**
 * UPDATE Team (name, about, creatorId)
 */
const updateTeam = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid Team id.");

    const { name, about, creatorId } = req.body;

    const data: any = {};
    if (typeof name !== "undefined") {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }
      data.name = name.trim();
    }
    if (typeof about !== "undefined") {
      if (about !== null && typeof about !== "string") {
        return err(res, 400, "About must be a string or null.");
      }
      if (typeof about === "string" && about.length > 255) {
        return err(res, 400, "About must be at most 255 characters.");
      }
      data.about = about === null ? null : about;
    }

    if (typeof creatorId !== "undefined") {
      if (creatorId === null) {
        data.creatorId = null;
      } else {
        const parsed = creatorId;
        if (Number.isNaN(parsed)) return err(res, 400, "creatorId must be a number or null");
        const user = await prisma.user.findUnique({ where: { id: parsed } });
        if (!user) return err(res, 400, "Creator user not found.");
        data.creatorId = parsed;
      }
    }

    const existing = await prisma.team.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "Team not found.");

    const updated = await prisma.team.update({
      where: { id },
      data,
      include: { projects: true, members: true },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === "P2002" && e?.meta && String(e.meta.target).includes("name")) {
      return err(res, 409, "Team name already exists.");
    }
    console.error("updateTeam error:", e);
    return err(res, 500, "Failed to update Team.");
  }
};

/**
 * DELETE Team
 * - disallow delete if projects exist (keeps previous behavior)
 */
const deleteTeam = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid Team id.");

    const team = await prisma.team.findUnique({
      where: { id },
      include: { projects: true },
    });
    if (!team) return err(res, 404, "Team not found.");

    if (team.projects && team.projects.length > 0) {
      return err(
        res,
        400,
        "Team has projects. Delete or detach projects before deleting the Team.",
      );
    }

    await prisma.team.delete({ where: { id } });
    return res.status(200).json({ success: true, data: `Team ${id} deleted` });
  } catch (e: any) {
    console.error("deleteTeam error:", e);
    if (e?.code === "P2003") {
      return err(res, 409, "Team has dependent records and cannot be deleted.");
    }
    return err(res, 500, "Failed to delete Team.");
  }
};

export { addUsersToTeam, createTeam, deleteTeam, getTeam, getTeams, getTeamsFromUser, updateTeam };
