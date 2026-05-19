import express from "express";
import { MulterError } from "multer";

import { deleteAsset, getTaskAssets, uploadMedia } from "../controllers/upload.controller";
import upload from "../middleware/upload";

const router = express.Router();

router.post("/multiple", upload.array("files", 5), uploadMedia);
router.post("/single", upload.single("file"), uploadMedia);
router.get("/task/:taskId", getTaskAssets);
router.delete("/:id", deleteAsset);

router.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ success: false, message: "File too large. Max 100MB per file." });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ success: false, message: "Too many files. Max 5 files." });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    _next(err);
  },
);

export default router;
