-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('COMMENT', 'TASK_UPDATE', 'SYSTEM', 'NOTE', 'WORKLOG');

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" INTEGER,
    "userId" INTEGER,
    "parentId" INTEGER,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_taskId_idx" ON "Activity"("taskId");

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_kind_createdAt_idx" ON "Activity"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
