-- AlterTable
ALTER TABLE "SKU" ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "shopifyVariantId" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceShopifySettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "shopDomain" TEXT,
    "adminAccessToken" TEXT,
    "priceUpdateMode" TEXT NOT NULL DEFAULT 'DRY_RUN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceShopifySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "actionId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceShopifySettings_workspaceId_key" ON "WorkspaceShopifySettings"("workspaceId");

-- CreateIndex
CREATE INDEX "ShopifyJob_workspaceId_status_createdAt_idx" ON "ShopifyJob"("workspaceId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceShopifySettings" ADD CONSTRAINT "WorkspaceShopifySettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyJob" ADD CONSTRAINT "ShopifyJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyJob" ADD CONSTRAINT "ShopifyJob_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "SKU"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopifyJob" ADD CONSTRAINT "ShopifyJob_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;
