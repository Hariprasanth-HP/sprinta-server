// src/controllers/userController.ts
import { Prisma, PrismaClient, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextFunction, Request, Response } from "express";
import { err } from "../lib/helper";

const prisma = new PrismaClient();

/** Request body types */
interface CreateUserBody {
  email: string;
  name?: string;
  password: string;
  id: string;
}
interface UpdateUserBody {
  email?: string;
  name?: string;
  password?: string;
}

/** Remove sensitive fields from a user object */
function sanitizeUser(user: (Partial<User> & Record<string, any>) | null) {
  if (!user) return null;
  const { password, ...rest } = user as any;
  return rest;
}

/**
 * Create user (signup)
 * body: { email, name, password }
 */
export const createUser = async (
  req: Request<Record<string, never>, unknown, CreateUserBody>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, name, password, id } = req.body;

    // basic validation

    if (!id?.trim()) {
      return void err(res, 400, "Invalid user Id");
    }
    if (!email || typeof email !== "string") {
      res.status(400);
      return void err(res, 400, "Email is required.");
    }
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400);
      return void err(res, 400, "name is required.");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      res.status(400);
      return void err(res, 400, "Password is required and must be at least 6 characters.");
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: name.trim(),
        password: hashed,
        id: id.trim()
      },
    });

    res.status(201).json({ success: true, data: sanitizeUser(user) });
    return;
  } catch (e: any) {
    // Prisma unique constraint violation
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      const pErr = e as Prisma.PrismaClientKnownRequestError;
      const target = pErr.meta?.target
        ? Array.isArray(pErr.meta.target)
          ? pErr.meta.target.join(", ")
          : pErr.meta.target
        : "unique field";
      return void err(res, 409, `Unique constraint failed: ${target}`);
    }

    console.error("createUser error:", e);
    return void err(res, 500, "Failed to create user.");
  }
};

/**
 * List users with pagination
 * query: ?page=1&limit=20
 */
export const getUsers = async (
  req: Request<Record<string, never>, unknown, unknown>,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);

    const sanitized = users.map((u) => sanitizeUser(u));

    res.status(200).json({
      success: true,
      data: sanitized,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
    return;
  } catch (e) {
    console.error("getUsers error:", e);
    return void err(res, 500, "Failed to fetch users.");
  }
};
export const getUsersFromTeam = async (
  req: Request<Record<string, never>, unknown, unknown>,
  res: Response,
): Promise<void> => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * limit;
    const parsedTeamId = parseInt(String(req.query?.teamId));
    if (Number.isNaN(parsedTeamId)) return void err(res, 400, "Invalid Team id.");

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count(),
    ]);

    const sanitized = users.map((u) => sanitizeUser(u));

    res.status(200).json({
      success: true,
      data: sanitized,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
    return;
  } catch (e) {
    console.error("getUsers error:", e);
    return void err(res, 500, "Failed to fetch users.");
  }
};

/**
 * Get single user by id
 * params: id
 */
export const getUser = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id?.trim()) {
      return void err(res, 400, "Invalid user Id");
    }
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) return void err(res, 404, "User not found.");

    res.status(200).json({ success: true, data: sanitizeUser(user) });
    return;
  } catch (e) {
    console.error("getUser error:", e);
    return void err(res, 500, "Failed to fetch user.");
  }
};

/**
 * Update user
 * params: id
 * body: { email?, name?, password? }
 */
export const updateUser = async (
  req: Request<{ id: string }, unknown, UpdateUserBody>,
  res: Response,
): Promise<void> => {
  try {
    const id = req.params.id;

    if (!id?.trim())
      return void err(res, 400, "Invalid user id.");

    const { email, name, password } = req.body;
    const data: Partial<{ email: string; name: string; password: string }> = {};

    if (email !== undefined) {
      if (!email || typeof email !== "string")
        return void err(res, 400, "Email must be a non-empty string.");
      data.email = email.toLowerCase();
    }
    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0)
        return void err(res, 400, "name must be a non-empty string.");
      data.name = name.trim();
    }
    if (password !== undefined) {
      if (!password || typeof password !== "string" || password.length < 6)
        return void err(res, 400, "Password must be at least 6 characters.");
      data.password = await bcrypt.hash(password, 10);
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return void err(res, 404, "User not found.");

    const updated = await prisma.user.update({
      where: { id },
      data,
    });

    res.status(200).json({ success: true, data: sanitizeUser(updated) });
    return;
  } catch (e: any) {
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2002") {
      const pErr = e as Prisma.PrismaClientKnownRequestError;
      const target = pErr.meta?.target
        ? Array.isArray(pErr.meta.target)
          ? pErr.meta.target.join(", ")
          : pErr.meta.target
        : "unique field";
      return void err(res, 409, `Unique constraint failed: ${target}`);
    }
    console.error("updateUser error:", e);
    return void err(res, 500, "Failed to update user.");
  }
};

/**
 * Delete user
 * Params: id
 * Query: ?force=true
 */
export const deleteUser = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    if (!id?.trim()) {
      return void err(res, 400, "Invalid user Id");
    }
    const userExist = await prisma.user.findUnique({ where: { id } });
    if (!userExist) {
      return void err(res, 404, "User does not exist");
    }
    await prisma.user.delete({ where: { id } });
    res.status(200).json({ success: true, data: "user deleted" });
  } catch (e: any) {
    console.error("deleteUser error:", e);
    if ((e as Prisma.PrismaClientKnownRequestError)?.code === "P2003") {
      return void err(res, 409, "Cannot delete user due to existing foreign-key constraints.");
    }
    return void err(res, 500, "Failed to delete user.");
  }
};
