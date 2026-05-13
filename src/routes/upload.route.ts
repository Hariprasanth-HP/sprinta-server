import express from "express";

import { uploadMedia } from "../controllers/upload.controller";
import upload from "../middleware/upload";

const router = express.Router();

router.post("/multiple", upload.array("files"), uploadMedia);

export default router;
