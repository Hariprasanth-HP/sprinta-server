import { AssetType, PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

/**
 * Upload images / videos to Cloudinary
 * Accepts:
 * - single file: upload.single("file")
 * - multiple files: upload.array("files", 5)
 */
const prisma = new PrismaClient();
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.query.taskId);

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "taskId is required",
      });
    }

    // ✅ Multiple uploads
    if (Array.isArray(req.files) && req.files.length > 0) {
      const assetsData = req.files.map((file: Express.Multer.File) => ({
        url: file.path,
        publicId: file.filename,
        type: file.mimetype.startsWith("video") ? AssetType.VIDEO : AssetType.IMAGE,
        taskId,
      }));

      await prisma.asset.createMany({
        data: assetsData,
      });

      return res.status(200).json({
        success: true,
        count: assetsData.length,
        data: assetsData,
      });
    }

    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Media upload failed",
    });
  }
};
