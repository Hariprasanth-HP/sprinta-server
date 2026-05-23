-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "activityId" INTEGER,
ALTER COLUMN "taskId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Asset_activityId_idx" ON "Asset"("activityId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
