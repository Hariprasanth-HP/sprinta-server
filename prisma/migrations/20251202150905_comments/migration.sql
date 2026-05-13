/*
  Warnings:

  - You are about to drop the column `userId` on the `Comment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_userId_fkey";

-- DropIndex
DROP INDEX "public"."Comment_userId_idx";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "userId";
