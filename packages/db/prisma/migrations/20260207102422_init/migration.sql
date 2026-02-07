-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'PRO', 'AGENCY', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL DEFAULT 'STARTER',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceUsageMonth" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "seatsUsed" INTEGER NOT NULL DEFAULT 0,
    "skusUsed" INTEGER NOT NULL DEFAULT 0,
    "competitorsUsed" INTEGER NOT NULL DEFAULT 0,
    "snapshotImportRowsUsed" INTEGER NOT NULL DEFAULT 0,
    "portalTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceUsageMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceUsageMonth_workspaceId_yearMonth_idx" ON "WorkspaceUsageMonth"("workspaceId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceUsageMonth_workspaceId_yearMonth_key" ON "WorkspaceUsageMonth"("workspaceId", "yearMonth");

-- AddForeignKey
ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceUsageMonth" ADD CONSTRAINT "WorkspaceUsageMonth_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
