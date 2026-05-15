import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = new URL(process.env.DATABASE_URL || "");
  url.searchParams.set("connection_limit", "5");
  url.searchParams.set("pool_timeout", "10");

  return new PrismaClient({
    datasources: { db: { url: url.toString() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
