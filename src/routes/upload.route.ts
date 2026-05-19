import express from "express";

import { uploadMedia } from "../controllers/upload.controller";
import upload from "../middleware/upload";

const router = express.Router();

router.post("/multiple", upload.array("files", 5), uploadMedia);
router.post("/single", upload.single("file"), uploadMedia);

export default router;
