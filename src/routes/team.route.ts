import express from "express";

import {
  addUsersToTeam,
  createTeam,
  deleteTeam,
  getTeam,
  getTeams,
  getTeamsFromUser,
  updateTeam,
} from "../controllers/team.controller";

const router = express.Router();

router.post("/", createTeam);

/**
 * @swagger
 * /Team:
 *   get:
 *     summary: Retrieve a list of Teams
 *     responses:
 *       200:
 *         description: A list of Teams
 */
router.get("/", getTeams);
router.get("/:id", getTeam);
router.post("/user", getTeamsFromUser);
router.put("/:id", addUsersToTeam);

router.put("/update/:id", updateTeam);
router.delete("/:id", deleteTeam);
export default router;
