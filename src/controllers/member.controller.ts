import { Prisma, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

import { err, isPrismaKnownError } from "../lib/helper";

// backend/src/controllers/memberController.js
const prisma = new PrismaClient();

// CREATE member
// Assumes: prisma is imported and `err(res, code, message)` helper exists
// Example: const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

const createMembers = async (req: Request, res: Response) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    if (Number.isNaN(teamId)) return err(res, 400, "Invalid Team id.");

    const { members } = req.body;
    if (!members || !Array.isArray(members)) {
      return err(res, 400, "members must be an array.");
    }

    if (members.length === 0) {
      return err(res, 400, "members array cannot be empty.");
    }

    // Optional: limit bulk size to avoid huge requests
    const MAX_BULK = 100;
    if (members.length > MAX_BULK) {
      return err(res, 400, `Too many members at once (max ${MAX_BULK}).`);
    }

    // Ensure Team exists
    const existingTeam = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (!existingTeam) return err(res, 404, "Team not found.");

    // Validate and normalize member objects
    const normalizedMembers = members.map((m, i) => {
      if (!m || typeof m !== "object") {
        throw {
          status: 400,
          message: `Member at index ${i} must be an object.`,
        };
      }
      if (!m.email || typeof m.email !== "string") {
        throw { status: 400, message: `Member at index ${i} missing email.` };
      }
      const email = m.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw {
          status: 400,
          message: `Invalid email at index ${i}: ${m.email}`,
        };
      }
      return {
        email,
        name: m.name ? String(m.name).trim() : null,
        role: m.role ? String(m.role).trim() : "member",
      };
    });

    // Upsert each member (create if not exists, otherwise update name/role)
    // This relies on the compound unique constraint @@unique([teamId, email])
    const upsertPromises = normalizedMembers.map((m) =>
      prisma.teamMember.upsert({
        where: {
          // Prisma auto-generates a compound unique name like teamId_email
          // Replace `teamId_email` with the correct generated name if different in your schema.
          uniq_team_email: { teamId, email: m.email },
        },
        create: {
          teamId,
          email: m.email,
          name: m.name,
          role: m.role,
          // userId stays null until the person signs up
        },
        update: {
          // update name/role to keep admin-entered data current
          name: m.name,
          role: m.role,
        },
      }),
    );

    const results = await prisma.$transaction(upsertPromises);

    // Return the updated team with members included
    const updatedTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true, projects: true }, // adjust includes as needed
    });

    // If you uploaded an image earlier and want to reference it here:
    return res.status(200).json({
      success: true,
      data: updatedTeam,
      added: results.length,
    });
  } catch (e: any) {
    // bubble up thrown validation errors
    if (e && e.status && e.message) return err(res, e.status, e.message);

    // Prisma unique constraint error on some other field
    if (e && e.code === "P2002") {
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
      const id = parseInt(teamId as string);
      if (Number.isNaN(id)) return err(res, 400, "teamId must be a number");
      where["teamId"] = id;
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
    const id = parseInt(req.params.id);
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
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid member id.");

    const { name, about, teamId } = req.body;

    // Validate fields if provided
    const data: any = {};
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return err(res, 400, "If provided, name must be a non-empty string.");
      }
      data.name = name.trim();
    }
    if (about !== undefined) {
      if (about && about.length > 255) {
        return err(res, 400, "About must be at most 255 characters.");
      }
      data.about = about === null ? null : about;
    }

    // Optionally change team (ensure team exists)
    if (teamId !== undefined) {
      if (teamId === null) {
        data.teamId = null;
      } else {
        const parsed = parseInt(teamId);
        if (Number.isNaN(parsed)) return err(res, 400, "teamId must be a number or null");
        const team = await prisma.team.findUnique({ where: { id: parsed } });
        if (!team) return err(res, 400, "Team not found.");
        data.teamId = parsed;
      }
    }

    // Ensure member exists
    const existing = await prisma.teamMember.findUnique({ where: { id } });
    if (!existing) return err(res, 404, "member not found.");

    const updated = await prisma.teamMember.update({
      where: { id },
      data,
      include: { team: true },
    });

    return res.status(200).json({ success: true, data: updated });
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
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return err(res, 400, "Invalid member id.");

    const member = await prisma.teamMember.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!member) return err(res, 404, "member not found.");

    await prisma.teamMember.delete({ where: { id } });
    return res.status(200).json({ success: true, data: `member ${id} deleted` });
  } catch (e: any) {
    console.error("deletemember error:", e);
    // If DB refuses if there are dependent rows not caught above, return 409
    if (e.code === "P2003") {
      return err(res, 409, "member has dependent records and cannot be deleted.");
    }
    return err(res, 500, "Failed to delete member.");
  }
};

export { createMembers, deleteMember, getMember, getMembers, updateMember };
