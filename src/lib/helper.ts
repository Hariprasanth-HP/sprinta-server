import { Prisma } from "@prisma/client";
import { Response } from "express";

export function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  if (typeof e !== "object" || e === null) return false;

  if (!("code" in e)) return false;
  if (typeof (e as { code: unknown }).code !== "string") return false;

  return true;
}


// simple uniform error responder
export function err(res: Response, status = 500, message = "Internal Server Error") {
  return res.status(status).json({ success: false, error: message });
}