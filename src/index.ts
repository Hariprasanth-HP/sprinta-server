// src/index.ts
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";

import { requireAuth } from "./middleware/authMiddleware";
import ActivityRouter from "./routes/activity.route";
// import your routers / middleware (update paths as needed)
import AuthRouter from "./routes/auth/auth.route";
import GenerateController from "./routes/generate.route";
import ListRouter from "./routes/list.route";
import MemberRouter from "./routes/member.route";
import ProjectRouter from "./routes/project.route";
import StatusController from "./routes/status.route";
import TaskRouter from "./routes/task.route";
import TeamRouter from "./routes/team.route";
import UploadRouter from "./routes/upload.route";
import UserRouter from "./routes/user.route";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT ?? 4000);
// ✅ CORS CONFIG
const allowedOrigins = [
  "http://localhost:5173", // Vite dev
  "http://localhost:3000", // Next.js / CRA
  "https://hariprasanth-hp.github.io"
];


const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Task Management API",
      version: "1.0.0",
      description: "API documentation for your backend",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT ?? 4000}`,
      },
    ],
  },
  apis: ["./src/routes/**/*.ts"],
});

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (origin === `http://localhost:${PORT}`) {
        return callback(null, true);
      }
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = "CORS policy: This origin is not allowed.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true, // 💥 REQUIRED for cookies
  }),
);
app.use(express.json());
app.get("/", (_, res) => {
  res.status(200).json({
    success: true,
    message: "Sprinta API is running 🚀",
  });
});

console.log("DATABASE_URL:", process?.env?.DATABASE_URL, process?.env?.ACCESS_TOKEN_EXPIRES_IN);

async function main(): Promise<void> {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  // Mount routers
  // Public auth routes
  app.use("/api/auth", AuthRouter);
  // Protected routes — requireAuth middleware applied
  app.use("/api/user", requireAuth, UserRouter);
  app.use("/api/team", requireAuth, TeamRouter);
  app.use("/api/project", requireAuth, ProjectRouter);
  app.use("/api/list", requireAuth, ListRouter);
  app.use("/api/task", requireAuth, TaskRouter);
  app.use("/api/member", requireAuth, MemberRouter);
  app.use("/api/activity", requireAuth, ActivityRouter);
  app.use("/api/status", requireAuth, StatusController);
  app.use("/api/generate", requireAuth, GenerateController);
  app.use("/api/upload", requireAuth, UploadRouter);

  // Connect Prisma then start server
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("Fatal error in main:", e);
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("Error during disconnect:", err);
  }
  process.exit(1);
});
