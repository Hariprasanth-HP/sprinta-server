import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import cloudinary from "../cloudinary_config";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "project-management",
    resource_type: "auto",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "mp4", "mov"],
  }),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image") || file.mimetype.startsWith("video")) {
      return cb(null, true);
    }
    cb(new Error("Only image and video files are allowed"));
  },
});

export default upload;
