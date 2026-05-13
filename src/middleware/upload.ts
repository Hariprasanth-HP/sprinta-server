import { Request } from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

import cloudinary from "../cloudinary_config";

const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX_SIZE = 10 * 1024 * 1024; // 10MB

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "project-management",
    resource_type: "auto",
    allowed_formats: ["jpg", "png", "jpeg", "webp", "mp4", "mov"],
  }),
});

/**
 * Custom file filter to validate type & size
 */
const fileFilter: multer.Options["fileFilter"] = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (file.mimetype.startsWith("image")) {
    // image size check
    if (Number(req.headers["content-length"]) > IMAGE_MAX_SIZE) {
      return cb(new Error("Image size exceeds 5MB limit"));
    }
    return cb(null, true);
  }

  if (file.mimetype.startsWith("video")) {
    // video size check
    if (Number(req.headers["content-length"]) > VIDEO_MAX_SIZE) {
      return cb(new Error("Video size exceeds 10MB limit"));
    }
    return cb(null, true);
  }

  cb(new Error("Only image and video files are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
});

export default upload;
