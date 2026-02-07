-- CreateTable
CREATE TABLE "PortalToken" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalToken_token_key" ON "PortalToken"("token");

-- CreateIndex
CREATE INDEX "PortalToken_workspaceId_createdAt_idx" ON "PortalToken"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "PortalToken_workspaceId_revokedAt_idx" ON "PortalToken"("workspaceId", "revokedAt");

-- AddForeignKey
ALTER TABLE "PortalToken" ADD CONSTRAINT "PortalToken_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
