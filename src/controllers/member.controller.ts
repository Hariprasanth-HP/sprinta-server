import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../db";
import { err, isPrismaKnownError } from "../lib/helper";
import { TeamRole } from "../types/type";

// CREATE member
// Assumes: prisma is imported and `err(res, code, message)` helper exists
// Example: const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const createMembers = async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);

    if (Number.isNaN(teamId)) {
      return err(res, 400, "Invalid Team id.");
    }

    const currentUser = req.user;

    if (!currentUser?.id) {
      return err(res, 401, "Unauthorized.");
    }

    const { members } = req.body;

    if (!members || !Array.isArray(members)) {
      return err(res, 400, "members must be an array.");
    }

    if (members.length === 0) {
      return err(res, 400, "members array cannot be empty.");
    }

    const MAX_BULK = 10;

    if (members.length > MAX_BULK) {
      return err(res, 400, `Too many members at once (max ${MAX_BULK}).`);
    }

    // Ensure team exists
    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!existingTeam) {
      return err(res, 404, "Team not found.");
    }

    // Check current user's workspace role
    const currentMembership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: currentUser.id,
      },
    });

    if (!currentMembership) {
      return err(res, 403, "Not a team member.");
    }

    const isAdmin = currentMembership.role === "OWNER" || currentMembership.role === "ADMIN";

    if (!isAdmin) {
      return err(res, 403, "Only admins can add members.");
    }

    // Validate + normalize
    const normalizedMembers = await Promise.all(
      members.map(async (m, i) => {
        if (!m || typeof m !== "object") {
          throw {
            status: 400,
            message: `Member at index ${i} must be an object.`,
          };
        }

        if (!m.email || typeof m.email !== "string") {
          throw {
            status: 400,
            message: `Member at index ${i} missing email.`,
          };
        }

        const email = m.email.trim().toLowerCase();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
          throw {
            status: 400,
            message: `Invalid email at index ${i}: ${m.email}`,
          };
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: {
            email,
          },
        });

        return {
          email,

          name: m.name ? String(m.name).trim() : null,

          role: m.role ?? "MEMBER",

          userId: existingUser?.id ?? null,
        };
      }),
    );

    // Upsert members
    const upsertPromises = normalizedMembers.map((m) =>
      prisma.teamMember.upsert({
        where: {
          uniq_team_email: {
            teamId,
            email: m.email,
          },
        },

        create: {
          teamId,

          email: m.email,

          name: m.name,

          role: m.role,

          userId: m.userId,

          addedById: currentUser.id,
        },

        update: {
          name: m.name,

          role: m.role,

          // attach user if they now exist
          ...(m.userId
            ? {
                userId: m.userId,
              }
            : {}),
        },
      }),
    );

    await prisma.$transaction(upsertPromises);

    // Fetch updated team
    const updatedTeam = await prisma.team.findUnique({
      where: {
        id: teamId,
      },

      include: {
        members: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updatedTeam,
      added: normalizedMembers.length,
    });
  } catch (e: any) {
    if (e?.status && e.message) {
      return err(res, e.status, e.message);
    }

    if (e?.code === "P2002") {
      return err(res, 409, "Unique constraint failed.");
    }

    console.error("createMembers error:", e);

    return err(res, 500, "Failed to add team members.");
  }
};

// GET all member (optionally filter by creator)
const getMembers = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;
    const where: Prisma.TeamMemberWhereInput = {};

    if (teamId) {
      const id = parseInt(teamId as string, 10);
      if (Number.isNaN(id)) return err(res, 400, "teamId must be a number");
      where.teamId = id;
    } else {
      return err(res, 500, "Creator Id should be sent");
    }

    const member = await prisma.teamMember.findMany({
      where,
      orderBy: { addedAt: "desc" },
      include: { team: true },
    });

    return res.status(200).json({ success: true, data: member });
  } catch (e) {
    console.error("getmember error:", e);
    return err(res, 500, "Failed to fetch member.");
  }
};

// GET single member by id (includes projects)
const getMember = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return err(res, 400, "Invalid member id.");

    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: { team: true },
    });

    if (!member) return err(res, 404, "member not found.");

    return res.status(200).json({ success: true, data: member });
  } catch (e) {
    console.error("getmember error:", e);
    return err(res, 500, "Failed to fetch member.");
  }
};

// UPDATE member
const updateMember = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    if (!currentUser?.id) {
      return err(res, 401, "Unauthorized.");
    }

    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return err(res, 400, "Invalid member id.");
    }

    const { name, about, teamId, role } = req.body;

    // Ensure member exists
    const existing = await prisma.teamMember.findUnique({
      where: { id },
    });

    if (!existing) {
      return err(res, 404, "Member not found.");
    }

    // SAME FLOW using existing.teamId
    const currentMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: existing.teamId,
        userId: currentUser.id,
      },
    });

    if (!currentMembership) {
      return err(res, 403, "Access denied.");
    }

    const isAdmin = currentMembership.role === "OWNER" || currentMembership.role === "ADMIN";

    if (!isAdmin) {
      return err(res, 403, "Only admins can update members.");
    }

    const data: any = {};

    // Validate name
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }

      data.name = name.trim();
    }

    // Validate about
    if (about !== undefined) {
      if (about && about.length > 255) {
        return err(res, 400, "About must be at most 255 characters.");
      }

      data.about = about === null ? null : about;
    }

    // Validate role
    if (role !== undefined) {
      const allowedRoles = Object.values(TeamRole);

      if (!allowedRoles.includes(role as TeamRole)) {
        return err(res, 400, `Invalid role. Allowed: ${allowedRoles.join(", ")}`);
      }

      // Only OWNER can modify OWNER
      if (existing.role === "OWNER" && currentMembership.role !== "OWNER") {
        return err(res, 403, "Only owner can modify owner role.");
      }

      data.role = role as TeamRole;
    }

    // Optional team change
    if (teamId !== undefined) {
      const parsed = parseInt(teamId, 10);

      if (Number.isNaN(parsed)) {
        return err(res, 400, "teamId must be a number");
      }

      const team = await prisma.team.findUnique({
        where: {
          id: parsed,
        },
      });

      if (!team) {
        return err(res, 400, "Team not found.");
      }

      data.teamId = parsed;
    }

    const updated = await prisma.teamMember.update({
      where: {
        id,
      },

      data,

      include: {
        team: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (e: unknown) {
    if (
      isPrismaKnownError(e) &&
      e.code === "P2002" &&
      Array.isArray(e.meta?.target) &&
      e.meta.target.includes("name")
    ) {
      return err(res, 409, "Member name already exists.");
    }

    console.error("updateMember error:", e);

    return err(res, 500, "Failed to update member.");
  }
};

// DELETE member
// Default safety: disallow deleting if projects exist. If you prefer cascade, adjust logic.
const deleteMember = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return err(res, 401, "Unauthorized.");
    }
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return err(res, 400, "Invalid member id.");
    }
    // Target member
    const member = await prisma.teamMember.findUnique({
      where: {
        id,
      },

      include: {
        team: true,
      },
    });

    if (!member) {
      return err(res, 404, "Member not found.");
    }
    // Current user's membership
    const currentMembership = await prisma.teamMember.findFirst({
      where: {
        teamId: member.teamId,
        userId: currentUser.id,
      },
    });

    if (!currentMembership) {
      return err(res, 403, "Access denied.");
    }

    const isAdmin =
      currentMembership.role === TeamRole.OWNER || currentMembership.role === TeamRole.ADMIN;

    if (!isAdmin) {
      return err(res, 403, "Only admins can delete members.");
    }

    // ADMIN cannot remove OWNER
    if (member.role === TeamRole.OWNER && currentMembership.role !== TeamRole.OWNER) {
      return err(res, 403, "Only owner can remove owner.");
    }

    // Prevent deleting yourself
    if (member.userId === currentUser.id) {
      return err(res, 400, "You cannot remove yourself.");
    }

    if (member.userId) {
      await prisma.projectMember.deleteMany({
        where: {
          userId: member.userId,

          project: {
            teamId: member.teamId,
          },
        },
      });
    }
    await prisma.teamMember.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      data: `member ${id} deleted`,
    });
  } catch (e: any) {
    if (e.code === "P2003") {
      return err(res, 409, "Member has dependent records and cannot be deleted.");
    }
    return err(res, 500, "Failed to delete member.");
  }
};

export { createMembers, deleteMember, getMember, getMembers, updateMember };
