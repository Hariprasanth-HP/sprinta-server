import express from "express";

import { generateResults } from "../controllers/generate.controller";

const router = express.Router();

router.post("/", generateResults);

/**
 * @swagger
 * /Team:
 *   get:
 *     summary: Retrieve a list of Teams
 *     responses:
 *       200:
 *         description: A list of Teams
 */
export default router;
