import express from "express";

import {
  createTaskStatus,
  deleteTaskStatus,
  getTaskStatus,
  getTaskStatusesByProject,
  updateTaskStatus,
} from "../controllers/status.controller";

const router = express.Router();

router.post("/", createTaskStatus);

/**
 * @swagger
 * /Status:
 *   get:
 *     summary: Retrieve a Status of Statuss
 *     responses:
 *       200:
 *         description: A Status of Statuss
 */
router.get("/", getTaskStatusesByProject);
router.get("/:id", getTaskStatus);
router.patch("/:id", updateTaskStatus);
router.delete("/:id", deleteTaskStatus);
export default router;
