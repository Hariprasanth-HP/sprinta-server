import express from "express";

import {
  createList,
  deleteList,
  getList,
  getLists,
  updateList,
} from "../controllers/list.controller";

const router = express.Router();

router.post("/", createList);

/**
 * @swagger
 * /List:
 *   get:
 *     summary: Retrieve a list of Lists
 *     responses:
 *       200:
 *         description: A list of Lists
 */
router.get("/", getLists);
router.get("/:id", getList);
router.put("/:id", updateList);
router.delete("/:id", deleteList);
export default router;
