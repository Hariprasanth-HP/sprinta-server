-- Add sortOrder column for drag-and-drop ordering
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Covering index for project-scoped sort
CREATE INDEX IF NOT EXISTS "Task_projectId_sortOrder_idx" ON "Task"("projectId", "sortOrder");

-- Composite indexes for common filter+sort patterns
CREATE INDEX IF NOT EXISTS "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "List_projectId_idx" ON "List"("projectId");
CREATE INDEX IF NOT EXISTS "List_projectId_createdAt_idx" ON "List"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "Activity_taskId_createdAt_idx" ON "Activity"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "Activity_parentId_idx" ON "Activity"("parentId");
CREATE INDEX IF NOT EXISTS "Asset_taskId_createdAt_idx" ON "Asset"("taskId", "createdAt");

-- Team membership indexes for auth checks
CREATE INDEX IF NOT EXISTS "Team_creatorId_idx" ON "Team"("creatorId");
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_userId_idx" ON "TeamMember"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_role_idx" ON "TeamMember"("teamId", "role");
