import express from "express";

import {
  createMembers,
  deleteMember,
  getMember,
  getMembers,
  updateMember,
} from "../controllers/member.controller";

const router = express.Router();

router.post("/:teamId", createMembers);

/**
 * @swagger
 * /Member:
 *   get:
 *     summary: Retrieve a list of Members
 *     responses:
 *       200:
 *         description: A list of Members
 */
router.get("/", getMembers);
router.get("/:id", getMember);

router.put("/:id", updateMember);
router.delete("/:id", deleteMember);
export default router;
