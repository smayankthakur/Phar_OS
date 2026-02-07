-- CreateEnum
CREATE TYPE "ResellerRole" AS ENUM ('RESELLER_OWNER', 'RESELLER_ADMIN', 'RESELLER_SUPPORT');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "billingManagedByReseller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planOverride" "PlanTier",
ADD COLUMN     "resellerId" TEXT;

-- CreateTable
CREATE TABLE "Reseller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "brandName" TEXT,
    "logoUrl" TEXT,
    "accentColor" TEXT,
    "supportEmail" TEXT,
    "appName" TEXT,

    CONSTRAINT "Reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerMembership" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ResellerRole" NOT NULL DEFAULT 'RESELLER_SUPPORT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResellerDomain" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'APP',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResellerMembership_userId_idx" ON "ResellerMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerMembership_resellerId_userId_key" ON "ResellerMembership"("resellerId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResellerDomain_domain_key" ON "ResellerDomain"("domain");

-- CreateIndex
CREATE INDEX "ResellerDomain_resellerId_createdAt_idx" ON "ResellerDomain"("resellerId", "createdAt");

-- CreateIndex
CREATE INDEX "ResellerDomain_resellerId_verifiedAt_idx" ON "ResellerDomain"("resellerId", "verifiedAt");

-- CreateIndex
CREATE INDEX "Workspace_resellerId_idx" ON "Workspace"("resellerId");

-- AddForeignKey
ALTER TABLE "ResellerMembership" ADD CONSTRAINT "ResellerMembership_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerMembership" ADD CONSTRAINT "ResellerMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResellerDomain" ADD CONSTRAINT "ResellerDomain_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Reseller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
