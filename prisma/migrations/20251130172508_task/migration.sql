-- DropForeignKey
ALTER TABLE "public"."List" DROP CONSTRAINT "List_projectId_fkey";

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
