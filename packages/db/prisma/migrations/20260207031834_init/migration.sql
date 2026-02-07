-- AlterTable
ALTER TABLE "Action" ADD COLUMN     "safetyReason" TEXT,
ADD COLUMN     "safetyStatus" TEXT NOT NULL DEFAULT 'OK';

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "minMarginPercent" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "maxPriceChangePercent" DECIMAL(6,2) NOT NULL DEFAULT 15,
    "roundingMode" TEXT NOT NULL DEFAULT 'NEAREST_1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSettings_workspaceId_key" ON "WorkspaceSettings"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
