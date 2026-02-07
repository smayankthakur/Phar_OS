-- CreateEnum
CREATE TYPE "SKUStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "SKU" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "currentPrice" DECIMAL(12,2) NOT NULL,
    "status" "SKUStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SKU_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SKU_workspaceId_idx" ON "SKU"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SKU_workspaceId_sku_key" ON "SKU"("workspaceId", "sku");

-- AddForeignKey
ALTER TABLE "SKU" ADD CONSTRAINT "SKU_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
