import { AssetType } from "@prisma/client";
import type { Request, Response } from "express";
import cloudinary from "../cloudinary_config";
import { prisma } from "../db";

/**
 * Upload images / videos to Cloudinary
 * Query params: ?taskId=xxx OR ?activityId=xxx
 */
export const uploadMedia = async (req: Request, res: Response) => {
  try {
    const taskId = req.query.taskId ? Number(req.query.taskId) : undefined;
    const activityId = req.query.activityId ? Number(req.query.activityId) : undefined;

    if (!taskId && !activityId) {
      return res.status(400).json({
        success: false,
        message: "taskId or activityId is required",
      });
    }

    if (taskId && Number.isNaN(taskId)) {
      return res.status(400).json({ success: false, message: "Invalid taskId" });
    }
    if (activityId && Number.isNaN(activityId)) {
      return res.status(400).json({ success: false, message: "Invalid activityId" });
    }

    // ✅ Multiple uploads
    if (Array.isArray(req.files) && req.files.length > 0) {
      const assetsData = req.files.map((file: Express.Multer.File) => ({
        url: file.path,
        publicId: file.filename,
        type: file.mimetype.startsWith("video") ? AssetType.VIDEO : AssetType.IMAGE,
        ...(taskId !== undefined ? { taskId } : {}),
        ...(activityId !== undefined ? { activityId } : {}),
      }));

      const publicIds = assetsData.map((a) => a.publicId);

      await prisma.asset.createMany({
        data: assetsData,
      });

      const created = await prisma.asset.findMany({
        where: { publicId: { in: publicIds } },
        orderBy: { id: "asc" },
      });

      return res.status(200).json({
        success: true,
        count: created.length,
        data: created,
      });
    }

    // ✅ Single upload
    if (req.file) {
      const asset = await prisma.asset.create({
        data: {
          url: req.file.path,
          publicId: req.file.filename,
          type: req.file.mimetype.startsWith("video") ? AssetType.VIDEO : AssetType.IMAGE,
          ...(taskId !== undefined ? { taskId } : {}),
          ...(activityId !== undefined ? { activityId } : {}),
        },
      });

      return res.status(200).json({
        success: true,
        count: 1,
        data: [asset],
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

/**
 * Get all assets for a task
 */
export const getTaskAssets = async (req: Request, res: Response) => {
  try {
    const taskId = Number(req.params.taskId);

    if (!taskId) {
      return res.status(400).json({ success: false, message: "taskId is required" });
    }

    const assets = await prisma.asset.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ success: true, data: assets });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to fetch assets",
    });
  }
};

/**
 * Delete an asset (from Cloudinary + database)
 */
export const deleteAsset = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid asset id" });

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(asset.publicId);
    } catch {
      // Proceed even if Cloudinary delete fails
    }

    await prisma.asset.delete({ where: { id } });

    return res.status(200).json({ success: true, message: "Asset deleted" });
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete asset",
    });
  }
};
