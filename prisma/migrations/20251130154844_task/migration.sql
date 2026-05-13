-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "statusId" INTEGER;

-- CreateTable
CREATE TABLE "TaskStatus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" INTEGER NOT NULL,

    CONSTRAINT "TaskStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskStatus_projectId_idx" ON "TaskStatus"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStatus_projectId_name_key" ON "TaskStatus"("projectId", "name");

-- CreateIndex
CREATE INDEX "Task_statusId_idx" ON "Task"("statusId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "TaskStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStatus" ADD CONSTRAINT "TaskStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
