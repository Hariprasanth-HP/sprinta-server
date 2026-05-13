import express from "express";

import {
  createUser,
  deleteUser,
  getUser,
  getUsers,
  getUsersFromTeam,
  updateUser,
} from "../controllers/user.controller";

const router = express.Router();

/**
 * @swagger
 * /user:
 *   get:
 *     summary: Retrieve a list of users
 *     responses:
 *       200:
 *         description: A list of users
 */
router.post("/create", createUser);
router.get("/", getUsers);
router.get("/team", getUsersFromTeam);
router.get("/:id", getUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
export default router;
