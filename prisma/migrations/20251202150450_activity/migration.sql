/*
  Warnings:

  - Made the column `kind` on table `Activity` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
CREATE SEQUENCE activity_id_seq;
ALTER TABLE "Activity" ALTER COLUMN "id" SET DEFAULT nextval('activity_id_seq'),
ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER SEQUENCE activity_id_seq OWNED BY "Activity"."id";
