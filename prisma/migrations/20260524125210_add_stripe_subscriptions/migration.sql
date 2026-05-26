-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'EXPIRED');

-- CreateTable
CREATE TABLE "TeamSubscription" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "priceId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSubscription_teamId_key" ON "TeamSubscription"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSubscription_stripeCustomerId_key" ON "TeamSubscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSubscription_stripeSubscriptionId_key" ON "TeamSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "TeamSubscription_stripeCustomerId_idx" ON "TeamSubscription"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "TeamSubscription_stripeSubscriptionId_idx" ON "TeamSubscription"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "TeamSubscription" ADD CONSTRAINT "TeamSubscription_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
