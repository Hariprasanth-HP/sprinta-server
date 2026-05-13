-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleId" UUID;
