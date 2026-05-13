/*
  Warnings:

  - You are about to drop the column `taskId` on the `Comment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_taskId_fkey";

-- DropIndex
DROP INDEX "public"."Comment_taskId_idx";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "taskId";
